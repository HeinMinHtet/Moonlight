import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { createServer } from "node:http";
import { validIsoDate } from "./lib/profitReport.js";
import {
  initDb,
  getConfig,
  getSupplierRate,
  getBoosterRate,
  getSupplierServicesList,
  getBoosterPricesList,
  getArmorTypesList,
  getSupplierGuildsList,
  updateSupplierGuilds,
  getSupplierWithdrawalsPayload,
  insertSupplierWithdrawal,
  getSupplierWithdrawalById,
  updateSupplierWithdrawal,
  deleteSupplierWithdrawal,
  getSupplierRecordsPayload,
  insertSupplierRecord,
  updateSupplierRecord,
  deleteSupplierRecord,
  verifyAllSupplierRecords,
  markSupplierRecordsPaid,
  reopenSupplierPaymentBatch,
  getBoosterRecordsPayload,
  insertBoosterRecord,
  getBoosterRecordById,
  updateBoosterRecord,
  deleteBoosterRecord,
  markBoosterRecordsPaid,
  settleBoosterBalance,
  getBoosterAdjustmentsPayload,
  insertBoosterAdjustment,
  getBoosterAdjustmentById,
  updateBoosterAdjustment,
  deleteBoosterAdjustment,
  updateSupplierServices,
  updateBoosterPrices,
  getProfitReportData,
  getSessionFromDb,
  saveSessionToDb,
  deleteSessionFromDb,
  pruneExpiredSessions,
  lineTotal
} from "./lib/db.js";

const root = resolve(".");
const publicDir = join(root, "public");
const distDir = join(root, "dist");
const useViteDevServer = process.argv.includes("--dev");

loadEnv();

const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET = process.env.SESSION_SECRET || "local-development-secret";
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET === "local-development-secret" ||
    process.env.SESSION_SECRET === "change-this-long-random-secret")
) {
  console.warn(
    "[SECURITY WARNING] Running in production with an unset or default SESSION_SECRET. Set a strong random SESSION_SECRET in your environment before public launch."
  );
}
const SESSION_MAX_AGE_MS = Number(process.env.SESSION_MAX_AGE_HOURS || 12) * 60 * 60 * 1000;
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;
const SECURE_COOKIE = process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
const DISCORD_ADMIN_ROLE_IDS = parseIdList(process.env.DISCORD_ADMIN_ROLE_IDS);
const DISCORD_BOOSTER_ROLE_IDS = parseIdList(process.env.DISCORD_BOOSTER_ROLE_IDS);
const sessions = new Map();
const oauthStates = new Map();

// Periodic pruning of in-memory and database sessions
setInterval(() => {
  pruneExpiredSessions();
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now > Number(session.expiresAt || 0)) sessions.delete(id);
  }
}, 15 * 60 * 1000).unref();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function loadEnv() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim();
  }
}

function parseIdList(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function discordReady() {
  return Boolean(
    process.env.DISCORD_CLIENT_ID &&
    process.env.DISCORD_CLIENT_SECRET &&
    process.env.DISCORD_REDIRECT_URI &&
    DISCORD_GUILD_ID &&
    (DISCORD_ADMIN_ROLE_IDS.size || DISCORD_BOOSTER_ROLE_IDS.size)
  );
}

function sign(value) {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function makeCookie(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function readCookie(req) {
  const header = req.headers.cookie || "";
  const cookies = Object.fromEntries(
    header.split(";").map((part) => {
      const [key, ...value] = part.trim().split("=");
      return [key, value.join("=")];
    }).filter(([key]) => key)
  );
  const raw = cookies.wow_ledger_session;
  if (!raw || !raw.includes(".")) return null;
  const [encoded, signature] = raw.split(".");
  const expectedSig = Buffer.from(sign(encoded));
  const actualSig = Buffer.from(signature || "");
  if (expectedSig.length !== actualSig.length || !timingSafeEqual(expectedSig, actualSig)) return null;
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

async function setSession(res, session) {
  const id = randomBytes(24).toString("base64url");
  const now = Date.now();
  const sessionObj = {
    ...session,
    csrfToken: randomBytes(24).toString("base64url"),
    createdAt: now,
    expiresAt: now + SESSION_MAX_AGE_MS
  };
  sessions.set(id, sessionObj);
  await saveSessionToDb(id, sessionObj);
  res.setHeader("Set-Cookie", `wow_ledger_session=${makeCookie({ id })}; ${cookieOptions(Math.floor(SESSION_MAX_AGE_MS / 1000))}`);
}

async function clearSession(res, req) {
  const cookie = readCookie(req);
  if (cookie?.id) {
    sessions.delete(cookie.id);
    await deleteSessionFromDb(cookie.id);
  }
  res.setHeader("Set-Cookie", `wow_ledger_session=; ${cookieOptions(0)}`);
}

async function getSession(req) {
  const cookie = readCookie(req);
  if (!cookie?.id) return null;
  let session = sessions.get(cookie.id) || null;
  if (!session) {
    session = await getSessionFromDb(cookie.id);
    if (session) sessions.set(cookie.id, session);
  }
  if (!session) return null;
  if (Date.now() > Number(session.expiresAt || 0)) {
    sessions.delete(cookie.id);
    await deleteSessionFromDb(cookie.id);
    return null;
  }
  return session;
}

function cookieOptions(maxAge) {
  return `HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${SECURE_COOKIE ? "; Secure" : ""}`;
}

function canUseSupplier(session) {
  return session?.role === "admin";
}

function canManageAdmin(session) {
  return session?.role === "admin";
}

function canUseBooster(session) {
  return session?.role === "booster" || session?.role === "admin";
}

function canDeleteBoosterRecord(session, record) {
  return canManageAdmin(session) || (canUseBooster(session) && !record?.paid && record?.discordId === session?.discordId);
}

function canEditBoosterRecord(session, record) {
  return canDeleteBoosterRecord(session, record);
}

function permissionsFor(session) {
  return {
    supplierRecords: canUseSupplier(session),
    boosterRecords: canUseBooster(session),
    supplierStatus: canManageAdmin(session),
    supplierPaid: canManageAdmin(session),
    supplierDelete: canManageAdmin(session),
    allBoosterRecords: canManageAdmin(session),
    boosterPaid: canManageAdmin(session),
    boosterDelete: canUseBooster(session),
    profitReport: canManageAdmin(session),
    priceSettings: canManageAdmin(session)
  };
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) throw Object.assign(new Error("Request body is too large."), { statusCode: 413 });
  }
  if (!body) return {};
  return JSON.parse(body);
}

function sendJson(res, status, payload) {
  setSecurityHeaders(res);
  res.setHeader("Cache-Control", "no-store");
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; connect-src 'self'; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; script-src 'self' 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"
  );
}

function notAllowed(res, error = "You do not have access to this action.") {
  sendJson(res, 403, { error });
}

function requireCsrf(req, res, session) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return true;
  if (!session) {
    notAllowed(res, "Sign in with Discord before saving changes.");
    return false;
  }
  if (req.headers["x-csrf-token"] !== session.csrfToken) {
    sendJson(res, 403, { error: "Your session changed. Refresh the page, then try again." });
    return false;
  }
  return true;
}

function publicUser(session) {
  if (!session) return null;
  return {
    role: session.role,
    discordId: session.discordId,
    username: session.username,
    expiresAt: session.expiresAt
  };
}

async function handleApi(req, res, url) {
  const { pathname, searchParams } = url;
  const session = await getSession(req);

  if (pathname === "/api/config" && req.method === "GET") {
    const permissions = permissionsFor(session);
    const config = await getConfig(session, permissions);
    return sendJson(res, 200, {
      discordConfigured: discordReady(),
      discordOAuthConfigured: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && process.env.DISCORD_REDIRECT_URI),
      discordRolesConfigured: Boolean(DISCORD_GUILD_ID && (DISCORD_ADMIN_ROLE_IDS.size || DISCORD_BOOSTER_ROLE_IDS.size)),
      user: publicUser(session),
      csrfToken: session?.csrfToken || null,
      permissions,
      ...config
    });
  }

  if (pathname === "/api/logout" && req.method === "POST") {
    if (session && !requireCsrf(req, res, session)) return;
    await clearSession(res, req);
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === "/api/supplier-records" && req.method === "GET") {
    if (!canUseSupplier(session)) return notAllowed(res, "Only Discord admins can view the sales ledger.");
    const payload = await getSupplierRecordsPayload();
    return sendJson(res, 200, payload);
  }

  if (pathname === "/api/profit-report" && req.method === "GET") {
    if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can view profit reporting.");
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const groupBy = searchParams.get("groupBy") || "daily";
    if (!validIsoDate(from) || !validIsoDate(to)) return sendJson(res, 400, { error: "Choose a valid profit report date range." });
    if (from > to) return sendJson(res, 400, { error: "Profit report start date must be before the end date." });
    if (!["daily", "monthly"].includes(groupBy)) return sendJson(res, 400, { error: "Profit reports can be grouped daily or monthly." });
    const report = await getProfitReportData(from, to, groupBy);
    return sendJson(res, 200, report);
  }

  if (pathname === "/api/supplier-records" && req.method === "POST") {
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
    const armorType = String(body.armorType || "No stack").trim();
    if (!armorTypes.includes(armorType)) return sendJson(res, 400, { error: "Choose a valid armor stack." });

    const date = String(body.date || "").trim() || new Date().toISOString().slice(0, 10);
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
    const { summary } = await getSupplierRecordsPayload();
    return sendJson(res, 201, { record, summary });
  }

  if (pathname === "/api/supplier-records/verify-all" && req.method === "POST") {
    if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can verify sales records.");
    if (!requireCsrf(req, res, session)) return;
    const body = await readJson(req);
    const selectedIds = Array.isArray(body.ids)
      ? new Set(body.ids.map((id) => String(id || "").trim()).filter(Boolean))
      : null;

    const result = await verifyAllSupplierRecords(selectedIds);
    if (result.error) return sendJson(res, 400, { error: result.error });

    const { records, paidRecords, summary, withdrawals } = await getSupplierRecordsPayload();
    return sendJson(res, 200, { verifiedCount: result.verifiedCount, records, paidRecords, summary, withdrawals });
  }

  if (pathname === "/api/supplier-records/mark-paid" && req.method === "POST") {
    if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can mark supplier payments paid.");
    if (!requireCsrf(req, res, session)) return;
    const body = await readJson(req);
    const selectedIds = Array.isArray(body.ids)
      ? new Set(body.ids.map((id) => String(id || "").trim()).filter(Boolean))
      : null;

    const result = await markSupplierRecordsPaid(selectedIds, session);
    if (result.error) return sendJson(res, 400, { error: result.error });

    const { records, paidRecords, summary, withdrawals } = await getSupplierRecordsPayload();
    return sendJson(res, 200, { paidCount: result.paidCount, paymentBatchId: result.paymentBatchId, records, paidRecords, summary, withdrawals });
  }

  if (pathname.startsWith("/api/supplier-payment-batches/") && pathname.endsWith("/reopen") && req.method === "POST") {
    if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can reopen supplier payments.");
    if (!requireCsrf(req, res, session)) return;
    const pathParts = pathname.split("/").filter(Boolean);
    const paymentBatchId = decodeURIComponent(pathParts[2] || "");

    const result = await reopenSupplierPaymentBatch(paymentBatchId, session);
    if (result.error) return sendJson(res, 404, { error: result.error });

    const { records, paidRecords, summary, withdrawals } = await getSupplierRecordsPayload();
    return sendJson(res, 200, { reopenedCount: result.reopenedCount, records, paidRecords, summary, withdrawals });
  }

  if (pathname === "/api/supplier-withdrawals" && req.method === "GET") {
    if (!canUseSupplier(session)) return notAllowed(res, "Only Discord admins can view supplier withdrawals.");
    const payload = await getSupplierWithdrawalsPayload();
    return sendJson(res, 200, payload);
  }

  if (pathname === "/api/supplier-withdrawals" && req.method === "POST") {
    if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can create supplier pre-withdrawals.");
    if (!requireCsrf(req, res, session)) return;
    const body = await readJson(req);
    const charName = String(body.charName || "").trim();
    const guild = String(body.guild || "").trim();
    const amount = Number(body.amount);
    const note = String(body.note || "").trim();
    const date = String(body.date || new Date().toISOString().slice(0, 10)).trim();

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
    const { withdrawals } = await getSupplierWithdrawalsPayload();
    return sendJson(res, 201, { withdrawal, withdrawals });
  }

  if (pathname.startsWith("/api/supplier-withdrawals/") && req.method === "PATCH") {
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
    const { withdrawals } = await getSupplierWithdrawalsPayload();
    return sendJson(res, 200, { withdrawal: updated, withdrawals });
  }

  if (pathname.startsWith("/api/supplier-withdrawals/") && req.method === "DELETE") {
    if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can delete supplier pre-withdrawals.");
    if (!requireCsrf(req, res, session)) return;
    const id = pathname.split("/").pop();
    const existing = await getSupplierWithdrawalById(id);
    if (!existing) return sendJson(res, 404, { error: "Withdrawal record not found." });

    await deleteSupplierWithdrawal(id);
    const { withdrawals } = await getSupplierWithdrawalsPayload();
    return sendJson(res, 200, { deletedId: id, withdrawals });
  }

  if (pathname.startsWith("/api/supplier-records/") && req.method === "PATCH") {
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
      const serviceExists = services.some((service) => service.active !== false && service.type === serviceType);
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
      if (!armorTypes.includes(armorType)) return sendJson(res, 400, { error: "Choose a valid armor stack." });
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

    const { summary } = await getSupplierRecordsPayload();
    return sendJson(res, 200, { record: updated, summary });
  }

  if (pathname.startsWith("/api/supplier-records/") && req.method === "DELETE") {
    if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can delete sales records.");
    if (!requireCsrf(req, res, session)) return;
    const id = pathname.split("/").pop();
    const record = await deleteSupplierRecord(id);
    if (!record) return sendJson(res, 404, { error: "Sales record not found." });
    const { summary } = await getSupplierRecordsPayload();
    return sendJson(res, 200, { record, summary });
  }

  if (pathname === "/api/booster-records" && req.method === "GET") {
    if (!canUseBooster(session)) return notAllowed(res, "Sign in with a Discord admin or booster role to view payout rows.");
    const payload = await getBoosterRecordsPayload(session, canManageAdmin(session));
    const { adjustments } = await getBoosterAdjustmentsPayload(session, canManageAdmin(session));
    return sendJson(res, 200, { ...payload, adjustments });
  }

  if (pathname === "/api/booster-records" && req.method === "POST") {
    if (!canUseBooster(session) || !session?.discordId) return sendJson(res, 403, { error: "Your Discord role cannot record booster payouts." });
    if (!requireCsrf(req, res, session)) return;
    const body = await readJson(req);
    if (!body.level || !body.quantity) return sendJson(res, 400, { error: "Mythic+ key level and run count are required." });
    const quantity = Number(body.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) return sendJson(res, 400, { error: "Quantity must be a whole number greater than 0." });
    const level = String(body.level || "").trim();
    const prices = await getBoosterPricesList();
    if (!prices.some((price) => price.active !== false && price.level === level)) return sendJson(res, 400, { error: "Choose an active Mythic+ key level." });

    const rateAtRecord = await getBoosterRate(level);
    const record = {
      id: randomBytes(10).toString("base64url"),
      discordId: session.discordId,
      boosterName: session.username,
      level,
      quantity,
      note: String(body.note || "").trim(),
      paid: false,
      rateAtRecord,
      totalBalance: lineTotal(rateAtRecord, quantity),
      createdAt: new Date().toISOString()
    };

    await insertBoosterRecord(record);
    return sendJson(res, 201, { record });
  }

  if (pathname === "/api/booster-records/mark-paid" && req.method === "POST") {
    if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can mark booster payouts paid.");
    if (!requireCsrf(req, res, session)) return;
    const body = await readJson(req);
    const selectedIds = new Set(
      (Array.isArray(body.ids) ? body.ids : []).map((id) => String(id || "").trim()).filter(Boolean)
    );
    if (!selectedIds.size) return sendJson(res, 400, { error: "Select at least one open booster payout row." });

    const result = await markBoosterRecordsPaid(selectedIds, session);
    if (result.error) return sendJson(res, 400, { error: result.error });

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

  if (pathname === "/api/booster-records/settle" && req.method === "POST") {
    if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can settle booster payouts.");
    if (!requireCsrf(req, res, session)) return;
    const body = await readJson(req);
    const discordId = String(body.discordId || "").trim();
    const boosterName = String(body.boosterName || "").trim();
    if (!discordId && !boosterName) {
      return sendJson(res, 400, { error: "Booster name or ID is required for settlement." });
    }

    const result = await settleBoosterBalance({ discordId, boosterName }, session);
    if (result.error) return sendJson(res, 400, { error: result.error });

    const { records, summary } = await getBoosterRecordsPayload(session, true);
    const { adjustments } = await getBoosterAdjustmentsPayload(session, true);
    return sendJson(res, 200, {
      settledCount: result.settledCount,
      netPayoutAmount: result.netPayoutAmount,
      boosterPaymentBatchId: result.boosterPaymentBatchId,
      records,
      summary,
      adjustments
    });
  }

  if (pathname.startsWith("/api/booster-records/") && req.method === "PATCH") {
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
    return sendJson(res, 200, { record: updated });
  }

  if (pathname.startsWith("/api/booster-records/") && req.method === "DELETE") {
    if (!canUseBooster(session)) return notAllowed(res, "Sign in with a Discord admin or booster role to delete payout rows.");
    if (!requireCsrf(req, res, session)) return;
    const id = pathname.split("/").pop();
    const record = await getBoosterRecordById(id);
    if (!record) return sendJson(res, 404, { error: "Payout row not found." });
    if (!canDeleteBoosterRecord(session, record)) return notAllowed(res, "Boosters can only delete their own payout rows.");
    await deleteBoosterRecord(id);
    return sendJson(res, 200, { record });
  }

  if (pathname === "/api/booster-adjustments" && req.method === "GET") {
    if (!canUseBooster(session)) return notAllowed(res, "Sign in with a Discord admin or booster role to view adjustments.");
    const payload = await getBoosterAdjustmentsPayload(session, canManageAdmin(session));
    return sendJson(res, 200, payload);
  }

  if (pathname === "/api/booster-adjustments" && req.method === "POST") {
    if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can create booster balance adjustments.");
    if (!requireCsrf(req, res, session)) return;
    const body = await readJson(req);
    const boosterName = String(body.boosterName || "").trim();
    const discordId = String(body.discordId || "").trim();
    const type = String(body.type || "").trim();
    const amount = Number(body.amount);
    const note = String(body.note || "").trim();
    const date = String(body.date || new Date().toISOString().slice(0, 10)).trim();

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
    const { adjustments } = await getBoosterAdjustmentsPayload(session, true);
    return sendJson(res, 201, { adjustment, adjustments });
  }

  if (pathname.startsWith("/api/booster-adjustments/") && req.method === "PATCH") {
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
    const { adjustments } = await getBoosterAdjustmentsPayload(session, true);
    return sendJson(res, 200, { adjustment: updated, adjustments });
  }

  if (pathname.startsWith("/api/booster-adjustments/") && req.method === "DELETE") {
    if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can delete booster balance adjustments.");
    if (!requireCsrf(req, res, session)) return;
    const id = pathname.split("/").pop();
    const existing = await getBoosterAdjustmentById(id);
    if (!existing) return sendJson(res, 404, { error: "Adjustment not found." });

    await deleteBoosterAdjustment(id);
    const { adjustments } = await getBoosterAdjustmentsPayload(session, true);
    return sendJson(res, 200, { deletedId: id, adjustments });
  }

  if (pathname === "/api/prices/supplier" && req.method === "PUT") {
    if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can change rates.");
    if (!requireCsrf(req, res, session)) return;
    const body = await readJson(req);
    const cleaned = cleanPriceRows(body.rows, "type");
    const supplierServices = await updateSupplierServices(cleaned);
    const { summary } = await getSupplierRecordsPayload();
    return sendJson(res, 200, { supplierServices, summary });
  }

  if (pathname === "/api/prices/booster" && req.method === "PUT") {
    if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can change rates.");
    if (!requireCsrf(req, res, session)) return;
    const body = await readJson(req);
    const cleaned = cleanPriceRows(body.rows, "level");
    const boosterPrices = await updateBoosterPrices(cleaned);
    return sendJson(res, 200, { boosterPrices });
  }

  if (pathname === "/api/prices/supplier-guilds" && req.method === "PUT") {
    if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can change supplier guilds.");
    if (!requireCsrf(req, res, session)) return;
    const body = await readJson(req);
    const cleaned = cleanGuildRows(body.rows);
    const supplierGuilds = await updateSupplierGuilds(cleaned);
    return sendJson(res, 200, { supplierGuilds });
  }

  sendJson(res, 404, { error: "Not found." });
}

function cleanGuildRows(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    throw Object.assign(new Error("Keep at least one guild. Archive guilds that should no longer be used."), { statusCode: 400 });
  }
  const cleaned = rows.map((row) => ({
    name: String(row.name || "").trim(),
    active: row.active !== false,
    isDefault: Boolean(row.isDefault)
  }));
  if (cleaned.some((row) => !row.name)) {
    throw Object.assign(new Error("Every guild needs a name."), { statusCode: 400 });
  }
  const seen = new Set();
  for (const row of cleaned) {
    const normalizedName = row.name.toLocaleLowerCase();
    if (seen.has(normalizedName)) {
      throw Object.assign(new Error("Duplicate guild names are not allowed."), { statusCode: 400 });
    }
    seen.add(normalizedName);
  }
  return cleaned;
}

function cleanPriceRows(rows, key) {
  if (!Array.isArray(rows) || !rows.length) {
    throw Object.assign(new Error("Keep at least one rate row. Archive rates that should no longer be used."), { statusCode: 400 });
  }
  const cleaned = rows
    .map((row) => ({
      [key]: String(row[key] || "").trim(),
      price: Number(row.price),
      active: row.active !== false,
      isDefault: Boolean(row.isDefault)
    }));
  if (cleaned.some((row) => !row[key] || !Number.isFinite(row.price) || row.price < 0)) {
    throw Object.assign(new Error("Every rate needs a name and a value of 0 or greater."), { statusCode: 400 });
  }
  const seen = new Set();
  for (const row of cleaned) {
    const normalizedName = row[key].toLocaleLowerCase();
    if (seen.has(normalizedName)) {
      throw Object.assign(new Error(`Duplicate ${key === "type" ? "service" : "key level"} names are not allowed.`), { statusCode: 400 });
    }
    seen.add(normalizedName);
  }
  return cleaned;
}

async function handleDiscord(req, res, url) {
  if (!discordReady()) return redirectWithAuthError(res, "Discord login is not configured yet. Add OAuth, server, and role IDs.");

  if (url.pathname === "/auth/discord") {
    pruneOAuthStates();
    const state = randomBytes(16).toString("base64url");
    oauthStates.set(state, Date.now() + OAUTH_STATE_MAX_AGE_MS);
    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      redirect_uri: process.env.DISCORD_REDIRECT_URI,
      response_type: "code",
      scope: "identify guilds.members.read",
      state
    });
    res.writeHead(302, { Location: `https://discord.com/oauth2/authorize?${params}` });
    return res.end();
  }

  if (url.pathname === "/auth/discord/callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const stateExpiresAt = oauthStates.get(state);
    if (!code || !state || !stateExpiresAt || Date.now() > stateExpiresAt) return redirectWithAuthError(res, "Discord sign-in expired. Try again.");
    oauthStates.delete(state);

    try {
      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID,
          client_secret: process.env.DISCORD_CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: process.env.DISCORD_REDIRECT_URI
        })
      });
      if (!tokenResponse.ok) return redirectWithAuthError(res, "Discord did not accept the sign-in code.");
      const token = await tokenResponse.json();
      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${token.access_token}` }
      });
      if (!userResponse.ok) return redirectWithAuthError(res, "Could not read your Discord profile.");
      const user = await userResponse.json();

      const memberResponse = await fetch(`https://discord.com/api/users/@me/guilds/${DISCORD_GUILD_ID}/member`, {
        headers: { Authorization: `Bearer ${token.access_token}` }
      });
      if (!memberResponse.ok) return redirectWithAuthError(res, "This Discord account is not in the configured server.");
      const member = await memberResponse.json();
      const role = roleFromDiscordMember(member);
      if (!role) return redirectWithAuthError(res, "Your Discord account does not have an allowed admin or booster role.");

      await setSession(res, { role, discordId: user.id, username: user.global_name || user.username });
      res.writeHead(302, { Location: "/" });
      return res.end();
    } catch (error) {
      console.error("Discord OAuth request failed:", error.cause?.code || error.code || error.message);
      return redirectWithAuthError(res, "Could not connect to Discord. Check the server network or firewall, then try again.");
    }
  }

  sendJson(res, 404, { error: "Not found." });
}

function roleFromDiscordMember(member) {
  const roles = new Set(Array.isArray(member.roles) ? member.roles : []);
  if ([...DISCORD_ADMIN_ROLE_IDS].some((id) => roles.has(id))) return "admin";
  if ([...DISCORD_BOOSTER_ROLE_IDS].some((id) => roles.has(id))) return "booster";
  return null;
}

function pruneOAuthStates() {
  const now = Date.now();
  for (const [state, expiresAt] of oauthStates.entries()) {
    if (now > expiresAt) oauthStates.delete(state);
  }
}

function redirectWithAuthError(res, message) {
  res.writeHead(302, { Location: `/?authError=${encodeURIComponent(message)}` });
  res.end();
}

function serveStatic(res, pathname) {
  const file = pathname === "/" ? "index.html" : pathname.slice(1);
  const target = resolve(existsSync(distDir) ? distDir : publicDir, file);
  const fallbackTarget = resolve(publicDir, file);
  const staticRoot = target.startsWith(distDir) && existsSync(distDir) ? distDir : publicDir;
  const resolvedTarget = existsSync(target) ? target : fallbackTarget;
  if (!resolvedTarget.startsWith(staticRoot) && !resolvedTarget.startsWith(publicDir)) return sendJson(res, 400, { error: "Bad path." });
  if (!existsSync(resolvedTarget)) return sendJson(res, 404, { error: "Not found." });
  setSecurityHeaders(res);
  res.writeHead(200, { "Content-Type": mimeTypes[extname(resolvedTarget)] || "application/octet-stream" });
  res.end(readFileSync(resolvedTarget));
}

const vite = useViteDevServer ? await createViteMiddleware() : null;

async function createViteMiddleware() {
  try {
    const { createServer: createViteServer } = await import("vite");
    return createViteServer({
      configLoader: "runner",
      server: {
        middlewareMode: true,
        hmr: { port: Number(process.env.VITE_HMR_PORT || PORT + 10000) }
      },
      appType: "spa"
    });
  } catch (error) {
    console.error("Vite development middleware could not start.", error);
    return null;
  }
}

// Initialize database schema and seeds
await initDb();

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    if (url.pathname.startsWith("/auth/discord")) return await handleDiscord(req, res, url);
    if (vite) {
      return vite.middlewares(req, res, (error) => {
        if (error) {
          vite.ssrFixStacktrace(error);
          console.error(error);
          return sendJson(res, error.statusCode || 500, { error: error.statusCode ? error.message : "Something went wrong." });
        }
        if (!res.writableEnded) return serveStatic(res, url.pathname);
      });
    }
    return serveStatic(res, url.pathname);
  } catch (error) {
    vite?.ssrFixStacktrace(error);
    console.error(error);
    return sendJson(res, error.statusCode || 500, { error: error.statusCode ? error.message : "Something went wrong." });
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the existing server or set a different PORT, then try again.`);
    process.exitCode = 1;
    return;
  }
  throw error;
});

server.listen(PORT, () => {
  console.log(`WoW Ledger running at http://localhost:${PORT}`);
});
