import { bangkokToday } from "../../bangkokDate.js";
import { validIsoDate } from "../../profitReport.js";
import { getExternalExpensesPayload, insertExternalExpense, getExternalExpenseById, updateExternalExpense, deleteExternalExpense } from "../../db.js";
import { canManageAdmin, requireCsrf } from "../auth.js";
import { notAllowed, readJson, sendJson } from "../http.js";
import { currentLedgerTag, incrementLedgerVersion } from "../ledgerVersion.js";

// Each route: match() decides whether it handles the request; handler() is the
// original handleApi branch, unchanged. Routes are tried in order.
export const expensesRoutes = [
  {
    // GET /api/external-expenses
    match: ({ pathname, req }) => pathname === "/api/external-expenses" && req.method === "GET",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can view external expenses.");
      const payload = await getExternalExpensesPayload();
      return sendJson(res, 200, payload, currentLedgerTag());
    }
  },
  {
    // POST /api/external-expenses
    match: ({ pathname, req }) => pathname === "/api/external-expenses" && req.method === "POST",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can record external expenses.");
      if (!requireCsrf(req, res, session)) return;
      const body = await readJson(req);
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return sendJson(res, 400, { error: "Amount must be a positive number." });
      }
      const title = String(body.title || "").trim();
      if (!title) {
        return sendJson(res, 400, { error: "Expense description or title is required." });
      }
      const category = String(body.category || "Raid payment").trim();
      const date = String(body.date || "").trim() || bangkokToday();
      if (!validIsoDate(date)) {
        return sendJson(res, 400, { error: "Choose a valid expense date." });
      }
      const recipient = String(body.recipient || "").trim();
      const note = String(body.note || "").trim();
  
      const record = await insertExternalExpense({
        date,
        category,
        title,
        amount,
        recipient,
        note
      }, session);
      incrementLedgerVersion();
      const payload = await getExternalExpensesPayload();
      return sendJson(res, 200, { expense: record, ...payload });
    }
  },
  {
    // PATCH /api/external-expenses/*
    match: ({ pathname, req }) => pathname.startsWith("/api/external-expenses/") && req.method === "PATCH",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can update external expenses.");
      if (!requireCsrf(req, res, session)) return;
      const id = pathname.split("/").pop();
      const existing = await getExternalExpenseById(id);
      if (!existing) return sendJson(res, 404, { error: "Expense not found." });
  
      const body = await readJson(req);
      const updates = {};
      if ("amount" in body) {
        const amount = Number(body.amount);
        if (!Number.isFinite(amount) || amount <= 0) return sendJson(res, 400, { error: "Amount must be a positive number." });
        updates.amount = amount;
      }
      if ("title" in body) {
        const title = String(body.title || "").trim();
        if (!title) return sendJson(res, 400, { error: "Expense description cannot be empty." });
        updates.title = title;
      }
      if ("category" in body) {
        const category = String(body.category || "").trim();
        if (!category) return sendJson(res, 400, { error: "Category cannot be empty." });
        updates.category = category;
      }
      if ("date" in body) {
        const date = String(body.date || "").trim();
        if (!validIsoDate(date)) return sendJson(res, 400, { error: "Choose a valid expense date." });
        updates.date = date;
      }
      if ("recipient" in body) {
        updates.recipient = String(body.recipient || "").trim();
      }
      if ("note" in body) {
        updates.note = String(body.note || "").trim();
      }
  
      const updated = await updateExternalExpense(id, updates);
      incrementLedgerVersion();
      const payload = await getExternalExpensesPayload();
      return sendJson(res, 200, { expense: updated, ...payload });
    }
  },
  {
    // DELETE /api/external-expenses/*
    match: ({ pathname, req }) => pathname.startsWith("/api/external-expenses/") && req.method === "DELETE",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can delete external expenses.");
      if (!requireCsrf(req, res, session)) return;
      const id = pathname.split("/").pop();
      const existing = await getExternalExpenseById(id);
      if (!existing) return sendJson(res, 404, { error: "Expense not found." });
  
      await deleteExternalExpense(id);
      incrementLedgerVersion();
      const payload = await getExternalExpensesPayload();
      return sendJson(res, 200, { deletedId: id, ...payload });
    }
  }
];
