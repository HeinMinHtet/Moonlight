import { bangkokToday } from "../../bangkokDate.js";
import { randomBytes } from "node:crypto";
import { validIsoDate } from "../../profitReport.js";
import { getBoosterRate, getBoosterPricesList, getBoosterRecordsPayload, insertBoosterRecord, getBoosterRecordById, updateBoosterRecord, deleteBoosterRecord, markBoosterRecordsPaid, settleBoosterBalance, getBoosterAdjustmentsPayload, insertBoosterAdjustment, getBoosterAdjustmentById, updateBoosterAdjustment, deleteBoosterAdjustment, getBoosterCashVaultPayload, withdrawBoosterVaultCash, lineTotal } from "../../db.js";
import { canDeleteBoosterRecord, canEditBoosterRecord, canManageAdmin, canUseBooster, requireCsrf } from "../auth.js";
import { notAllowed, readJson, sendJson } from "../http.js";
import { currentLedgerTag, incrementLedgerVersion } from "../ledgerVersion.js";

// Each route: match() decides whether it handles the request; handler() is the
// original handleApi branch, unchanged. Routes are tried in order.
export const boosterRoutes = [
  {
    // GET /api/booster-records
    match: ({ pathname, req }) => pathname === "/api/booster-records" && req.method === "GET",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canUseBooster(session)) return notAllowed(res, "Sign in with a Discord admin or booster role to view payout rows.");
      const payload = await getBoosterRecordsPayload(session, canManageAdmin(session));
      const { adjustments } = await getBoosterAdjustmentsPayload(session, canManageAdmin(session));
      const { vaultTransactions } = await getBoosterCashVaultPayload(session, canManageAdmin(session));
      return sendJson(res, 200, { ...payload, adjustments, vaultTransactions }, currentLedgerTag());
    }
  },
  {
    // POST /api/booster-records
    match: ({ pathname, req }) => pathname === "/api/booster-records" && req.method === "POST",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canUseBooster(session) || !session?.discordId) return sendJson(res, 403, { error: "Your Discord role cannot record booster payouts." });
      if (!requireCsrf(req, res, session)) return;
      const body = await readJson(req);
      if (!body.level || !body.quantity) return sendJson(res, 400, { error: "Mythic+ key level and run count are required." });
      const quantity = Number(body.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) return sendJson(res, 400, { error: "Quantity must be a whole number greater than 0." });
      if (!canManageAdmin(session) && quantity > 50) return sendJson(res, 400, { error: "Quantity cannot exceed 50 runs per entry." });
      const level = String(body.level || "").trim();
      const prices = await getBoosterPricesList();
      if (!prices.some((price) => price.active !== false && price.level === level)) return sendJson(res, 400, { error: "Choose an active Mythic+ key level." });
  
      const rateAtRecord = await getBoosterRate(level);
      let boosterName = session.username;
      let discordId = session.discordId;
      let createdAt = new Date().toISOString();
  
      if (canManageAdmin(session)) {
        const customName = String(body.boosterName || "").trim();
        if (customName) {
          boosterName = customName;
          if (customName !== session.username) {
            const { records } = await getBoosterRecordsPayload(session, true);
            const { adjustments } = await getBoosterAdjustmentsPayload(session, true);
            const matched = records.find((r) => r.boosterName === customName && r.discordId && !r.discordId.startsWith("outsourced"))
              || adjustments.find((a) => a.boosterName === customName && a.discordId && !a.discordId.startsWith("outsourced"));
            discordId = matched?.discordId || (body.discordId ? String(body.discordId).trim() : `outsourced:${customName}`);
          }
        }
        const rawDate = String(body.date || body.createdAt || "").trim();
        if (rawDate) {
          const isDateOnly = validIsoDate(rawDate);
          const isParsable = !Number.isNaN(Date.parse(rawDate));
          if (!isDateOnly && !isParsable) {
            return sendJson(res, 400, { error: "Choose a valid payout date." });
          }
          createdAt = isDateOnly ? `${rawDate}T00:00:00.000Z` : new Date(rawDate).toISOString();
        }
      }
  
      const record = {
        id: randomBytes(10).toString("base64url"),
        discordId,
        boosterName,
        level,
        quantity,
        note: String(body.note || "").trim(),
        paid: false,
        rateAtRecord,
        totalBalance: lineTotal(rateAtRecord, quantity),
        createdAt
      };
  
      await insertBoosterRecord(record);
      incrementLedgerVersion();
      return sendJson(res, 201, { record });
    }
  },
  {
    // POST /api/booster-records/mark-paid
    match: ({ pathname, req }) => pathname === "/api/booster-records/mark-paid" && req.method === "POST",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can mark booster payouts paid.");
      if (!requireCsrf(req, res, session)) return;
      const body = await readJson(req);
      const selectedIds = new Set(
        (Array.isArray(body.ids) ? body.ids : []).map((id) => String(id || "").trim()).filter(Boolean)
      );
      if (!selectedIds.size) return sendJson(res, 400, { error: "Select at least one open booster payout row." });
  
      const result = await markBoosterRecordsPaid(selectedIds, session);
      if (result.error) return sendJson(res, 400, { error: result.error });
      incrementLedgerVersion();
  
      const { records, summary } = await getBoosterRecordsPayload(session, true);
      const { adjustments } = await getBoosterAdjustmentsPayload(session, true);
      return sendJson(res, 200, {
        paidCount: result.paidCount,
        boosterPaymentBatchId: result.boosterPaymentBatchId,
        records,
        summary,
        adjustments
      });
    }
  },
  {
    // POST /api/booster-records/settle
    match: ({ pathname, req }) => pathname === "/api/booster-records/settle" && req.method === "POST",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can settle booster payouts.");
      if (!requireCsrf(req, res, session)) return;
      const body = await readJson(req);
      const discordId = String(body.discordId || "").trim();
      const boosterName = String(body.boosterName || "").trim();
      const rate = Number(body.rate) || 0;
      const action = body.action === "hold_cash" ? "hold_cash" : "pay_now";
      const date = String(body.date || "").trim();
      const note = String(body.note || "").trim();
  
      if (!discordId && !boosterName) {
        return sendJson(res, 400, { error: "Booster name or ID is required for settlement." });
      }
  
      const result = await settleBoosterBalance({ discordId, boosterName }, session, { rate, action, date, note });
      if (result.error) return sendJson(res, 400, { error: result.error });
      incrementLedgerVersion();
  
      const { records, summary } = await getBoosterRecordsPayload(session, true);
      const { adjustments } = await getBoosterAdjustmentsPayload(session, true);
      const { vaultTransactions } = await getBoosterCashVaultPayload(session, true);
      return sendJson(res, 200, {
        settledCount: result.settledCount,
        netPayoutAmount: result.netPayoutAmount,
        rate: result.rate,
        cashAmountMmk: result.cashAmountMmk,
        action: result.action,
        vaultTransaction: result.vaultTransaction,
        boosterPaymentBatchId: result.boosterPaymentBatchId,
        records,
        summary,
        adjustments,
        vaultTransactions
      });
    }
  },
  {
    // GET /api/booster-cash-vault
    match: ({ pathname, req }) => pathname === "/api/booster-cash-vault" && req.method === "GET",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canUseBooster(session)) return notAllowed(res, "Sign in with a Discord admin or booster role to view vault records.");
      const payload = await getBoosterCashVaultPayload(session, canManageAdmin(session));
      return sendJson(res, 200, payload, currentLedgerTag());
    }
  },
  {
    // POST /api/booster-cash-vault/withdraw
    match: ({ pathname, req }) => pathname === "/api/booster-cash-vault/withdraw" && req.method === "POST",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can release stored cash to boosters.");
      if (!requireCsrf(req, res, session)) return;
      const body = await readJson(req);
      const result = await withdrawBoosterVaultCash(body, session);
      if (result.error) return sendJson(res, 400, { error: result.error });
      incrementLedgerVersion();
  
      const { vaultTransactions } = await getBoosterCashVaultPayload(session, true);
      return sendJson(res, 200, { ...result, vaultTransactions });
    }
  },
  {
    // PATCH /api/booster-records/*
    match: ({ pathname, req }) => pathname.startsWith("/api/booster-records/") && req.method === "PATCH",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!requireCsrf(req, res, session)) return;
      const id = pathname.split("/").pop();
      const body = await readJson(req);
      const record = await getBoosterRecordById(id);
      if (!record) return sendJson(res, 404, { error: "Payout row not found." });
      if (!canEditBoosterRecord(session, record)) return notAllowed(res, "Boosters can only edit their own payout rows.");
  
      const updates = {};
      if ("paid" in body) {
        if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can mark booster payouts paid.");
        const paid = Boolean(body.paid);
        updates.paid = paid;
        updates.paidAt = paid ? new Date().toISOString() : null;
        updates.paidByDiscordId = paid ? session.discordId : null;
        updates.paidByName = paid ? session.username : null;
        updates.boosterPaymentBatchId = paid ? `bpb_${randomBytes(12).toString("base64url")}` : null;
      }
      if ("boosterName" in body) {
        if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can change the booster name.");
        const newBoosterName = String(body.boosterName || "").trim();
        if (!newBoosterName) return sendJson(res, 400, { error: "Booster name cannot be empty." });
        updates.boosterName = newBoosterName;
        if (newBoosterName !== record.boosterName) {
          const { records } = await getBoosterRecordsPayload(session, true);
          const { adjustments } = await getBoosterAdjustmentsPayload(session, true);
          const matched = records.find((r) => r.boosterName === newBoosterName && r.discordId && !r.discordId.startsWith("outsourced"))
            || adjustments.find((a) => a.boosterName === newBoosterName && a.discordId && !a.discordId.startsWith("outsourced"));
          updates.discordId = matched?.discordId || `outsourced:${newBoosterName}`;
        }
      }
      if ("level" in body) {
        const level = String(body.level || "").trim();
        const prices = await getBoosterPricesList();
        const levelExists = prices.some((price) => price.active !== false && price.level === level);
        if (!levelExists && level !== record.level) return sendJson(res, 400, { error: "Choose a valid Mythic+ key level." });
        updates.level = level;
        if (level !== record.level && !("rateAtRecord" in body)) {
          updates.rateAtRecord = await getBoosterRate(level);
        }
      }
      if ("quantity" in body) {
        const quantity = Number(body.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) return sendJson(res, 400, { error: "Runs completed must be a whole number greater than 0." });
        if (!canManageAdmin(session) && quantity > 50) return sendJson(res, 400, { error: "Quantity cannot exceed 50 runs per entry." });
        updates.quantity = quantity;
      }
      if ("createdAt" in body) {
        const createdAt = String(body.createdAt || "").trim();
        const isDateOnly = validIsoDate(createdAt);
        const isParsable = !Number.isNaN(Date.parse(createdAt));
        if (!createdAt || (!isDateOnly && !isParsable)) {
          return sendJson(res, 400, { error: "Choose a valid payout date." });
        }
        updates.createdAt = isDateOnly ? `${createdAt}T00:00:00.000Z` : new Date(createdAt).toISOString();
      }
      if ("rateAtRecord" in body) {
        if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can change saved payout rates.");
        const rateAtRecord = Number(body.rateAtRecord);
        if (!Number.isFinite(rateAtRecord) || rateAtRecord < 0) return sendJson(res, 400, { error: "Saved payout rate must be 0 or greater." });
        updates.rateAtRecord = rateAtRecord;
      }
      if ("note" in body) updates.note = String(body.note || "").trim();
  
      const updated = await updateBoosterRecord(id, updates);
      incrementLedgerVersion();
      return sendJson(res, 200, { record: updated });
    }
  },
  {
    // DELETE /api/booster-records/*
    match: ({ pathname, req }) => pathname.startsWith("/api/booster-records/") && req.method === "DELETE",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canUseBooster(session)) return notAllowed(res, "Sign in with a Discord admin or booster role to delete payout rows.");
      if (!requireCsrf(req, res, session)) return;
      const id = pathname.split("/").pop();
      const record = await getBoosterRecordById(id);
      if (!record) return sendJson(res, 404, { error: "Payout row not found." });
      if (!canDeleteBoosterRecord(session, record)) return notAllowed(res, "Boosters can only delete their own payout rows.");
      await deleteBoosterRecord(id);
      incrementLedgerVersion();
      return sendJson(res, 200, { record });
    }
  },
  {
    // GET /api/booster-adjustments
    match: ({ pathname, req }) => pathname === "/api/booster-adjustments" && req.method === "GET",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canUseBooster(session)) return notAllowed(res, "Sign in with a Discord admin or booster role to view adjustments.");
      const payload = await getBoosterAdjustmentsPayload(session, canManageAdmin(session));
      return sendJson(res, 200, payload, currentLedgerTag());
    }
  },
  {
    // POST /api/booster-adjustments
    match: ({ pathname, req }) => pathname === "/api/booster-adjustments" && req.method === "POST",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can create booster balance adjustments.");
      if (!requireCsrf(req, res, session)) return;
      const body = await readJson(req);
      const boosterName = String(body.boosterName || "").trim();
      const discordId = String(body.discordId || "").trim();
      const type = String(body.type || "").trim();
      const amount = Number(body.amount);
      const note = String(body.note || "").trim();
      const date = String(body.date || bangkokToday()).trim();
  
      if (!boosterName) return sendJson(res, 400, { error: "Booster name is required." });
      if (type !== "add" && type !== "deduct") return sendJson(res, 400, { error: "Adjustment type must be 'add' or 'deduct'." });
      if (isNaN(amount) || amount <= 0) return sendJson(res, 400, { error: "Adjustment amount must be greater than 0." });
      if (!note) return sendJson(res, 400, { error: "Reason / note is required for balance adjustments." });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return sendJson(res, 400, { error: "Date must be in YYYY-MM-DD format." });
  
      const adjustment = {
        id: `badj_${randomBytes(10).toString("base64url")}`,
        discordId,
        boosterName,
        type,
        amount,
        note,
        date,
        createdAt: new Date().toISOString(),
        createdByDiscordId: session.discordId,
        createdByName: session.username
      };
  
      await insertBoosterAdjustment(adjustment);
      incrementLedgerVersion();
      const { adjustments } = await getBoosterAdjustmentsPayload(session, true);
      return sendJson(res, 201, { adjustment, adjustments });
    }
  },
  {
    // PATCH /api/booster-adjustments/*
    match: ({ pathname, req }) => pathname.startsWith("/api/booster-adjustments/") && req.method === "PATCH",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can edit booster balance adjustments.");
      if (!requireCsrf(req, res, session)) return;
      const id = pathname.split("/").pop();
      const body = await readJson(req);
      const existing = await getBoosterAdjustmentById(id);
      if (!existing) return sendJson(res, 404, { error: "Adjustment not found." });
  
      const updates = {};
      if ("amount" in body) {
        const amount = Number(body.amount);
        if (isNaN(amount) || amount <= 0) return sendJson(res, 400, { error: "Adjustment amount must be greater than 0." });
        updates.amount = amount;
      }
      if ("note" in body) {
        const note = String(body.note || "").trim();
        if (!note) return sendJson(res, 400, { error: "Reason / note is required." });
        updates.note = note;
      }
      if ("date" in body) {
        const date = String(body.date || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return sendJson(res, 400, { error: "Date must be in YYYY-MM-DD format." });
        updates.date = date;
      }
      if ("type" in body) {
        const type = String(body.type || "").trim();
        if (type !== "add" && type !== "deduct") return sendJson(res, 400, { error: "Type must be 'add' or 'deduct'." });
        updates.type = type;
      }
  
      const updated = await updateBoosterAdjustment(id, updates);
      incrementLedgerVersion();
      const { adjustments } = await getBoosterAdjustmentsPayload(session, true);
      return sendJson(res, 200, { adjustment: updated, adjustments });
    }
  },
  {
    // DELETE /api/booster-adjustments/*
    match: ({ pathname, req }) => pathname.startsWith("/api/booster-adjustments/") && req.method === "DELETE",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can delete booster balance adjustments.");
      if (!requireCsrf(req, res, session)) return;
      const id = pathname.split("/").pop();
      const existing = await getBoosterAdjustmentById(id);
      if (!existing) return sendJson(res, 404, { error: "Adjustment not found." });
  
      await deleteBoosterAdjustment(id);
      incrementLedgerVersion();
      const { adjustments } = await getBoosterAdjustmentsPayload(session, true);
      return sendJson(res, 200, { deletedId: id, adjustments });
    }
  }
];
