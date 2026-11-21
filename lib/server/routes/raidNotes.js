import { bangkokToday } from "../../bangkokDate.js";
import { validIsoDate } from "../../profitReport.js";
import { getRaidNotesPayload, insertRaidNote, getRaidNoteById, updateRaidNote, deleteRaidNote } from "../../db.js";
import { canManageAdmin, requireCsrf } from "../auth.js";
import { notAllowed, readJson, sendJson } from "../http.js";
import { currentLedgerTag, incrementLedgerVersion } from "../ledgerVersion.js";

// Each route: match() decides whether it handles the request; handler() is the
// original handleApi branch, unchanged. Routes are tried in order.
export const raidNotesRoutes = [
  {
    // GET /api/raid-notes
    match: ({ pathname, req }) => pathname === "/api/raid-notes" && req.method === "GET",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can view raid notes.");
      const payload = await getRaidNotesPayload();
      return sendJson(res, 200, payload, currentLedgerTag());
    }
  },
  {
    // POST /api/raid-notes
    match: ({ pathname, req }) => pathname === "/api/raid-notes" && req.method === "POST",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can create raid notes.");
      if (!requireCsrf(req, res, session)) return;
      const body = await readJson(req);
      const title = String(body.title || "").trim();
      if (!title) return sendJson(res, 400, { error: "Raid note title is required." });
      const raidDate = String(body.raidDate || "").trim() || bangkokToday();
      if (!validIsoDate(raidDate)) return sendJson(res, 400, { error: "Choose a valid raid date." });
      const raidTime = String(body.raidTime || "").trim();
      const color = String(body.color || "default").trim();
      const pinned = Boolean(body.pinned);
      const items = Array.isArray(body.items) ? body.items : [];
  
      const record = await insertRaidNote({
        title,
        raidDate,
        raidTime,
        color,
        pinned,
        items
      }, session);
      incrementLedgerVersion();
      const payload = await getRaidNotesPayload();
      return sendJson(res, 201, { note: record, ...payload });
    }
  },
  {
    // PATCH /api/raid-notes/*
    match: ({ pathname, req }) => pathname.startsWith("/api/raid-notes/") && req.method === "PATCH",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can update raid notes.");
      if (!requireCsrf(req, res, session)) return;
      const id = pathname.split("/").pop();
      const existing = await getRaidNoteById(id);
      if (!existing) return sendJson(res, 404, { error: "Raid note not found." });
  
      const body = await readJson(req);
      const updates = {};
      if ("title" in body) {
        const title = String(body.title || "").trim();
        if (!title) return sendJson(res, 400, { error: "Raid note title cannot be empty." });
        updates.title = title;
      }
      if ("raidDate" in body) {
        const raidDate = String(body.raidDate || "").trim();
        if (!validIsoDate(raidDate)) return sendJson(res, 400, { error: "Choose a valid raid date." });
        updates.raidDate = raidDate;
      }
      if ("raidTime" in body) updates.raidTime = String(body.raidTime || "").trim();
      if ("color" in body) updates.color = String(body.color || "default").trim();
      if ("pinned" in body) updates.pinned = Boolean(body.pinned);
      if ("archived" in body) updates.archived = Boolean(body.archived);
      if ("items" in body && Array.isArray(body.items)) updates.items = body.items;
  
      const updated = await updateRaidNote(id, updates);
      incrementLedgerVersion();
      const payload = await getRaidNotesPayload();
      return sendJson(res, 200, { note: updated, ...payload });
    }
  },
  {
    // DELETE /api/raid-notes/*
    match: ({ pathname, req }) => pathname.startsWith("/api/raid-notes/") && req.method === "DELETE",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can delete raid notes.");
      if (!requireCsrf(req, res, session)) return;
      const id = pathname.split("/").pop();
      const existing = await getRaidNoteById(id);
      if (!existing) return sendJson(res, 404, { error: "Raid note not found." });
  
      await deleteRaidNote(id);
      incrementLedgerVersion();
      const payload = await getRaidNotesPayload();
      return sendJson(res, 200, { deletedId: id, ...payload });
    }
  }
];
