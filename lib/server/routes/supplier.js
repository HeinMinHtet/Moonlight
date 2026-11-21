import { bangkokToday } from "../../bangkokDate.js";
import { randomBytes } from "node:crypto";
import { validIsoDate } from "../../profitReport.js";
import { getSupplierRate, getSupplierServicesList, getArmorTypesList, getSupplierWithdrawalsPayload, insertSupplierWithdrawal, getSupplierWithdrawalById, updateSupplierWithdrawal, deleteSupplierWithdrawal, getSupplierRecordsPayload, insertSupplierRecord, updateSupplierRecord, deleteSupplierRecord, verifyAllSupplierRecords, unverifyAllSupplierRecords, markSupplierRecordsPaid, reopenSupplierPaymentBatch, lineTotal } from "../../db.js";
import { canManageAdmin, canUseSupplier, requireCsrf } from "../auth.js";
import { notAllowed, readJson, sendJson } from "../http.js";
import { currentLedgerTag, incrementLedgerVersion } from "../ledgerVersion.js";

// Each route: match() decides whether it handles the request; handler() is the
// original handleApi branch, unchanged. Routes are tried in order.
export const supplierRoutes = [
  {
    // GET /api/supplier-records
    match: ({ pathname, req }) => pathname === "/api/supplier-records" && req.method === "GET",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canUseSupplier(session)) return notAllowed(res, "Only Discord admins can view the sales ledger.");
      const payload = await getSupplierRecordsPayload();
      return sendJson(res, 200, payload, currentLedgerTag());
    }
  },
  {
    // POST /api/supplier-records
    match: ({ pathname, req }) => pathname === "/api/supplier-records" && req.method === "POST",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canUseSupplier(session)) return notAllowed(res, "Only Discord admins can add sales records.");
      if (!requireCsrf(req, res, session)) return;
      const body = await readJson(req);
      if (!body.buyerName || !body.serviceType || !body.quantity) return sendJson(res, 400, { error: "Buyer character, service, and quantity are required." });
      const quantity = Number(body.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) return sendJson(res, 400, { error: "Quantity must be greater than 0." });
      const serviceType = String(body.serviceType || "").trim();
      const services = await getSupplierServicesList();
      if (!services.some((service) => service.active !== false && service.type === serviceType)) {
        return sendJson(res, 400, { error: "Choose an active service for this sales record." });
      }
      const armorTypes = await getArmorTypesList();
      const defaultArmor = armorTypes.find((item) => item.isDefault)?.name || armorTypes.find((item) => item.active !== false)?.name || "No stack";
      const armorType = String(body.armorType || defaultArmor).trim();
      const armorExists = armorTypes.some((armor) => (typeof armor === "object" ? armor.name : armor) === armorType && (typeof armor === "object" ? armor.active !== false : true));
      if (!armorExists) return sendJson(res, 400, { error: "Choose a valid armor stack." });
  
      const date = String(body.date || "").trim() || bangkokToday();
      if (!validIsoDate(date)) return sendJson(res, 400, { error: "Choose a valid sales record date." });
  
      const rateAtRecord = await getSupplierRate(serviceType);
      const record = {
        id: randomBytes(10).toString("base64url"),
        date,
        buyerName: String(body.buyerName).trim(),
        serviceType,
        quantity,
        armorType,
        correct: false,
        paid: false,
        note: String(body.note || "").trim(),
        rateAtRecord,
        totalCost: lineTotal(rateAtRecord, quantity),
        createdByDiscordId: session.discordId,
        createdByName: session.username,
        createdAt: new Date().toISOString()
      };
  
      await insertSupplierRecord(record);
      incrementLedgerVersion();
      const { summary } = await getSupplierRecordsPayload();
      return sendJson(res, 201, { record, summary });
    }
  },
  {
    // POST /api/supplier-records/verify-all
    match: ({ pathname, req }) => pathname === "/api/supplier-records/verify-all" && req.method === "POST",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can verify sales records.");
      if (!requireCsrf(req, res, session)) return;
      const body = await readJson(req);
      const selectedIds = Array.isArray(body.ids)
        ? new Set(body.ids.map((id) => String(id || "").trim()).filter(Boolean))
        : null;
  
      const result = await verifyAllSupplierRecords(selectedIds);
      if (result.error) return sendJson(res, 400, { error: result.error });
      incrementLedgerVersion();
  
      const { records, paidRecords, summary, withdrawals } = await getSupplierRecordsPayload();
      return sendJson(res, 200, { verifiedCount: result.verifiedCount, records, paidRecords, summary, withdrawals });
    }
  },
  {
    // POST /api/supplier-records/unverify-all
    match: ({ pathname, req }) => pathname === "/api/supplier-records/unverify-all" && req.method === "POST",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can unverify sales records.");
      if (!requireCsrf(req, res, session)) return;
      const body = await readJson(req);
      const selectedIds = Array.isArray(body.ids)
        ? new Set(body.ids.map((id) => String(id || "").trim()).filter(Boolean))
        : null;
  
      const result = await unverifyAllSupplierRecords(selectedIds);
      if (result.error) return sendJson(res, 400, { error: result.error });
      incrementLedgerVersion();
  
      const { records, paidRecords, summary, withdrawals } = await getSupplierRecordsPayload();
      return sendJson(res, 200, { unverifiedCount: result.unverifiedCount, records, paidRecords, summary, withdrawals });
    }
  },
  {
    // POST /api/supplier-records/mark-paid
    match: ({ pathname, req }) => pathname === "/api/supplier-records/mark-paid" && req.method === "POST",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can mark supplier payments paid.");
      if (!requireCsrf(req, res, session)) return;
      const body = await readJson(req);
      const selectedIds = Array.isArray(body.ids)
        ? new Set(body.ids.map((id) => String(id || "").trim()).filter(Boolean))
        : null;
      const settleWithdrawals = body.settleWithdrawals !== false;
  
      const result = await markSupplierRecordsPaid(selectedIds, session, { settleWithdrawals });
      if (result.error) return sendJson(res, 400, { error: result.error });
      incrementLedgerVersion();
  
      const { records, paidRecords, summary, withdrawals } = await getSupplierRecordsPayload();
      return sendJson(res, 200, { paidCount: result.paidCount, paymentBatchId: result.paymentBatchId, records, paidRecords, summary, withdrawals });
    }
  },
  {
    // POST /api/supplier-payment-batches/*
    match: ({ pathname, req }) => pathname.startsWith("/api/supplier-payment-batches/") && pathname.endsWith("/reopen") && req.method === "POST",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can reopen supplier payments.");
      if (!requireCsrf(req, res, session)) return;
      const pathParts = pathname.split("/").filter(Boolean);
      const paymentBatchId = decodeURIComponent(pathParts[2] || "");
  
      const result = await reopenSupplierPaymentBatch(paymentBatchId, session);
      if (result.error) return sendJson(res, 404, { error: result.error });
      incrementLedgerVersion();
  
      const { records, paidRecords, summary, withdrawals } = await getSupplierRecordsPayload();
      return sendJson(res, 200, { reopenedCount: result.reopenedCount, records, paidRecords, summary, withdrawals });
    }
  },
  {
    // GET /api/supplier-withdrawals
    match: ({ pathname, req }) => pathname === "/api/supplier-withdrawals" && req.method === "GET",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canUseSupplier(session)) return notAllowed(res, "Only Discord admins can view supplier withdrawals.");
      const payload = await getSupplierWithdrawalsPayload();
      return sendJson(res, 200, payload, currentLedgerTag());
    }
  },
  {
    // POST /api/supplier-withdrawals
    match: ({ pathname, req }) => pathname === "/api/supplier-withdrawals" && req.method === "POST",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can create supplier pre-withdrawals.");
      if (!requireCsrf(req, res, session)) return;
      const body = await readJson(req);
      const charName = String(body.charName || "").trim();
      const guild = String(body.guild || "").trim();
      const amount = Number(body.amount);
      const note = String(body.note || "").trim();
      const date = String(body.date || bangkokToday()).trim();
  
      if (!charName) return sendJson(res, 400, { error: "Character name is required." });
      if (!guild) return sendJson(res, 400, { error: "Guild is required." });
      if (isNaN(amount) || amount <= 0) return sendJson(res, 400, { error: "Withdrawal amount must be greater than 0." });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return sendJson(res, 400, { error: "Date must be in YYYY-MM-DD format." });
  
      const withdrawal = {
        id: `sw_${randomBytes(10).toString("base64url")}`,
        date,
        charName,
        guild,
        amount,
        note,
        settled: false,
        settledAt: null,
        settlementBatchId: null,
        createdByDiscordId: session.discordId,
        createdByName: session.username,
        createdAt: new Date().toISOString()
      };
  
      await insertSupplierWithdrawal(withdrawal);
      incrementLedgerVersion();
      const { withdrawals } = await getSupplierWithdrawalsPayload();
      return sendJson(res, 201, { withdrawal, withdrawals });
    }
  },
  {
    // PATCH /api/supplier-withdrawals/*
    match: ({ pathname, req }) => pathname.startsWith("/api/supplier-withdrawals/") && req.method === "PATCH",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can edit supplier pre-withdrawals.");
      if (!requireCsrf(req, res, session)) return;
      const id = pathname.split("/").pop();
      const body = await readJson(req);
      const existing = await getSupplierWithdrawalById(id);
      if (!existing) return sendJson(res, 404, { error: "Withdrawal record not found." });
  
      const updates = {};
      if ("charName" in body) {
        const charName = String(body.charName || "").trim();
        if (!charName) return sendJson(res, 400, { error: "Character name is required." });
        updates.charName = charName;
      }
      if ("guild" in body) {
        const guild = String(body.guild || "").trim();
        if (!guild) return sendJson(res, 400, { error: "Guild is required." });
        updates.guild = guild;
      }
      if ("amount" in body) {
        const amount = Number(body.amount);
        if (isNaN(amount) || amount <= 0) return sendJson(res, 400, { error: "Withdrawal amount must be greater than 0." });
        updates.amount = amount;
      }
      if ("date" in body) {
        const date = String(body.date || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return sendJson(res, 400, { error: "Date must be in YYYY-MM-DD format." });
        updates.date = date;
      }
      if ("note" in body) updates.note = String(body.note || "").trim();
  
      const updated = await updateSupplierWithdrawal(id, updates);
      incrementLedgerVersion();
      const { withdrawals } = await getSupplierWithdrawalsPayload();
      return sendJson(res, 200, { withdrawal: updated, withdrawals });
    }
  },
  {
    // DELETE /api/supplier-withdrawals/*
    match: ({ pathname, req }) => pathname.startsWith("/api/supplier-withdrawals/") && req.method === "DELETE",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can delete supplier pre-withdrawals.");
      if (!requireCsrf(req, res, session)) return;
      const id = pathname.split("/").pop();
      const existing = await getSupplierWithdrawalById(id);
      if (!existing) return sendJson(res, 404, { error: "Withdrawal record not found." });
  
      await deleteSupplierWithdrawal(id);
      incrementLedgerVersion();
      const { withdrawals } = await getSupplierWithdrawalsPayload();
      return sendJson(res, 200, { deletedId: id, withdrawals });
    }
  },
  {
    // PATCH /api/supplier-records/*
    match: ({ pathname, req }) => pathname.startsWith("/api/supplier-records/") && req.method === "PATCH",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can update sales records.");
      if (!requireCsrf(req, res, session)) return;
      const id = pathname.split("/").pop();
      const body = await readJson(req);
  
      const updates = {};
      if ("date" in body) {
        const date = String(body.date || "").trim();
        if (!validIsoDate(date)) return sendJson(res, 400, { error: "Choose a valid sales record date." });
        updates.date = date;
      }
      if ("buyerName" in body) {
        const buyerName = String(body.buyerName || "").trim();
        if (!buyerName) return sendJson(res, 400, { error: "Buyer character is required." });
        updates.buyerName = buyerName;
      }
      if ("serviceType" in body) {
        const serviceType = String(body.serviceType || "").trim();
        const services = await getSupplierServicesList();
        const serviceExists = services.some((service) => (typeof service === "object" ? service.type : service) === serviceType);
        if (!serviceExists) return sendJson(res, 400, { error: "Choose a valid service for this sales record." });
        updates.serviceType = serviceType;
      }
      if ("quantity" in body) {
        const quantity = Number(body.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) return sendJson(res, 400, { error: "Quantity must be greater than 0." });
        updates.quantity = quantity;
      }
      if ("armorType" in body) {
        const armorType = String(body.armorType || "").trim();
        const armorTypes = await getArmorTypesList();
        const armorExists = armorTypes.some((armor) => (typeof armor === "object" ? armor.name : armor) === armorType);
        if (!armorExists) return sendJson(res, 400, { error: "Choose a valid armor stack." });
        updates.armorType = armorType;
      }
      if ("rateAtRecord" in body) {
        const rateAtRecord = Number(body.rateAtRecord);
        if (!Number.isFinite(rateAtRecord) || rateAtRecord < 0) return sendJson(res, 400, { error: "Saved rate must be 0 or greater." });
        updates.rateAtRecord = rateAtRecord;
      }
      if ("note" in body) updates.note = String(body.note || "").trim();
      if ("correct" in body) updates.correct = Boolean(body.correct);
      if ("paid" in body) {
        const paid = Boolean(body.paid);
        updates.paid = paid;
        updates.paidAt = paid ? new Date().toISOString() : null;
        updates.paidByDiscordId = paid ? session.discordId : null;
        updates.paidByName = paid ? session.username : null;
        updates.paymentBatchId = paid ? `spb_${randomBytes(12).toString("base64url")}` : null;
      }
  
      const updated = await updateSupplierRecord(id, updates);
      if (!updated) return sendJson(res, 404, { error: "Sales record not found." });
  
      incrementLedgerVersion();
      const { summary } = await getSupplierRecordsPayload();
      return sendJson(res, 200, { record: updated, summary });
    }
  },
  {
    // DELETE /api/supplier-records/*
    match: ({ pathname, req }) => pathname.startsWith("/api/supplier-records/") && req.method === "DELETE",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can delete sales records.");
      if (!requireCsrf(req, res, session)) return;
      const id = pathname.split("/").pop();
      const record = await deleteSupplierRecord(id);
      if (!record) return sendJson(res, 404, { error: "Sales record not found." });
      incrementLedgerVersion();
      const { summary } = await getSupplierRecordsPayload();
      return sendJson(res, 200, { record, summary });
    }
  }
];
