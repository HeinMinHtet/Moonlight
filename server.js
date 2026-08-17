import { createHmac, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { createServer } from "node:http";
import { buildProfitReport, validIsoDate } from "./lib/profitReport.js";

const root = resolve(".");
const publicDir = join(root, "public");
const distDir = join(root, "dist");
const dataDir = join(root, "data");
const dbPath = join(dataDir, "database.json");
const useViteDevServer = process.argv.includes("--dev");

loadEnv();

const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET = process.env.SESSION_SECRET || "local-development-secret";
const SESSION_MAX_AGE_MS = Number(process.env.SESSION_MAX_AGE_HOURS || 12) * 60 * 60 * 1000;
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;
const SECURE_COOKIE = process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
const DISCORD_ADMIN_ROLE_IDS = parseIdList(process.env.DISCORD_ADMIN_ROLE_IDS);
const DISCORD_BOOSTER_ROLE_IDS = parseIdList(process.env.DISCORD_BOOSTER_ROLE_IDS);
const sessions = new Map();
const oauthStates = new Map();

const defaultDb = {
  supplierServices: [
    { type: "m6", price: 110 },
    { type: "m10", price: 140 },
    { type: "m12", price: 190 },
    { type: "Raid unsaved", price: 950 },
    { type: "m10 pug", price: 40 },
    { type: "13 pug", price: 60 },
    { type: "MOQ unsaved", price: 900 },
    { type: "Gold", price: 1000 },
    { type: "3 raids unsaved", price: 1400 },
    { type: "16 resil", price: 3000 }
  ],
  boosterPrices: [
    { level: "m6", price: 70 },
    { level: "m10", price: 95 },
    { level: "m12", price: 130 },
    { level: "m14", price: 170 },
    { level: "m16", price: 220 }
  ],
  armorTypes: ["Mail", "Cloth", "Leather", "Plate", "No stack"],
  supplierRecords: [],
  boosterRecords: []
};

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

function readDb() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  if (!existsSync(dbPath)) writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2));
  const db = JSON.parse(readFileSync(dbPath, "utf8"));
  return normalizeDb({ ...defaultDb, ...db });
}

function writeDb(db) {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const payload = JSON.stringify(db, null, 2);
  retryFileWrite(() => writeFileSync(dbPath, payload, { encoding: "utf8", flag: "w" }));
}

function retryFileWrite(writeOperation, attempts = 5) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      writeOperation();
      return;
    } catch (error) {
      lastError = error;
      if (!["EBADF", "EPERM", "EACCES", "EBUSY"].includes(error.code) || attempt === attempts - 1) break;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25 * (attempt + 1));
    }
  }
  throw lastError;
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
  if (sign(encoded) !== signature) return null;
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function setSession(res, session) {
  const id = randomBytes(24).toString("base64url");
  const now = Date.now();
  sessions.set(id, {
    ...session,
    csrfToken: randomBytes(24).toString("base64url"),
    createdAt: now,
    expiresAt: now + SESSION_MAX_AGE_MS
  });
  res.setHeader("Set-Cookie", `wow_ledger_session=${makeCookie({ id })}; ${cookieOptions(Math.floor(SESSION_MAX_AGE_MS / 1000))}`);
}

function clearSession(res, req) {
  const cookie = readCookie(req);
  if (cookie?.id) sessions.delete(cookie.id);
  res.setHeader("Set-Cookie", `wow_ledger_session=; ${cookieOptions(0)}`);
}

function getSession(req) {
  const cookie = readCookie(req);
  if (!cookie?.id) return null;
  const session = sessions.get(cookie.id) || null;
  if (!session) return null;
  if (Date.now() > Number(session.expiresAt || 0)) {
    sessions.delete(cookie.id);
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
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'");
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

function lineTotal(rate, quantity) {
  return Number(quantity || 0) * Number(rate || 0);
}

function supplierRate(db, serviceType) {
  const service = db.supplierServices.find((item) => item.type === serviceType);
  return Number(service?.price || 0);
}

function boosterRate(db, level) {
  const price = db.boosterPrices.find((item) => item.level === level);
  return Number(price?.price || 0);
}

function savedRate(record, totalKey, fallbackRate) {
  const explicitRate = Number(record.rateAtRecord);
  if (Number.isFinite(explicitRate) && explicitRate >= 0) return explicitRate;
  const quantity = Number(record.quantity || 0);
  const savedTotal = Number(record[totalKey]);
  if (Number.isFinite(savedTotal) && Number.isFinite(quantity) && quantity > 0) return savedTotal / quantity;
  return Number(fallbackRate || 0);
}

function paymentBatchIdFor(record) {
  if (record.paymentBatchId) return String(record.paymentBatchId);
  const legacyKey = String(record.paidAt || record.id || "unknown");
  return `legacy_${Buffer.from(legacyKey).toString("base64url")}`;
}

function normalizeDb(db) {
  const normalized = {
    ...db,
    supplierServices: (Array.isArray(db.supplierServices) ? db.supplierServices : defaultDb.supplierServices)
      .map((row) => ({ ...row, active: row.active !== false })),
    boosterPrices: (Array.isArray(db.boosterPrices) ? db.boosterPrices : defaultDb.boosterPrices)
      .map((row) => ({ ...row, active: row.active !== false })),
    armorTypes: Array.isArray(db.armorTypes) ? db.armorTypes : defaultDb.armorTypes,
    supplierRecords: Array.isArray(db.supplierRecords) ? db.supplierRecords : [],
    boosterRecords: Array.isArray(db.boosterRecords) ? db.boosterRecords : []
  };

  normalized.supplierRecords = normalized.supplierRecords.map((record) => {
    const quantity = Number(record.quantity || 0);
    const rateAtRecord = savedRate(record, "totalCost", supplierRate(normalized, record.serviceType));
    return {
      ...record,
      quantity,
      paid: Boolean(record.paid),
      paymentBatchId: record.paid ? paymentBatchIdFor(record) : null,
      rateAtRecord,
      totalCost: lineTotal(rateAtRecord, quantity)
    };
  });

  normalized.boosterRecords = normalized.boosterRecords.map((record) => {
    const quantity = Number(record.quantity || 0);
    const rateAtRecord = savedRate(record, "totalBalance", boosterRate(normalized, record.level));
    return {
      ...record,
      quantity,
      paid: Boolean(record.paid),
      rateAtRecord,
      totalBalance: lineTotal(rateAtRecord, quantity)
    };
  });

  return normalized;
}

function supplierSummary(db) {
  const rowsByServiceAndRate = new Map();
  for (const record of db.supplierRecords) {
    if (!record.correct || record.paid) continue;
    const type = record.serviceType || "Unknown service";
    const rateAtRecord = Number(record.rateAtRecord || 0);
    const key = `${type}\u0000${rateAtRecord}`;
    const existing = rowsByServiceAndRate.get(key) || {
      type,
      price: rateAtRecord,
      totalQty: 0,
      totalCost: 0
    };
    existing.totalQty += Number(record.quantity || 0);
    existing.totalCost += Number(record.totalCost || lineTotal(rateAtRecord, record.quantity));
    rowsByServiceAndRate.set(key, existing);
  }

  return [...rowsByServiceAndRate.values()]
    .filter((row) => Number(row.totalQty || 0) > 0)
    .sort((a, b) => a.type.localeCompare(b.type) || Number(a.price || 0) - Number(b.price || 0));
}

function boosterSummary(records) {
  const rowsByBooster = new Map();
  for (const record of records) {
    if (record.paid) continue;
    const key = record.discordId || record.boosterName || "unknown";
    const existing = rowsByBooster.get(key) || {
      discordId: record.discordId,
      boosterName: record.boosterName || "Unknown booster",
      openCount: 0,
      openTotal: 0
    };
    existing.openCount += 1;
    existing.openTotal += Number(record.totalBalance || 0);
    rowsByBooster.set(key, existing);
  }
  return [...rowsByBooster.values()].sort((a, b) => b.openTotal - a.openTotal);
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
  const db = readDb();
  const session = getSession(req);

  if (pathname === "/api/config" && req.method === "GET") {
    const permissions = permissionsFor(session);
    return sendJson(res, 200, {
      discordConfigured: discordReady(),
      discordOAuthConfigured: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && process.env.DISCORD_REDIRECT_URI),
      discordRolesConfigured: Boolean(DISCORD_GUILD_ID && (DISCORD_ADMIN_ROLE_IDS.size || DISCORD_BOOSTER_ROLE_IDS.size)),
      user: publicUser(session),
      csrfToken: session?.csrfToken || null,
      permissions,
      supplierServices: permissions.supplierRecords ? db.supplierServices : [],
      boosterPrices: permissions.priceSettings
        ? db.boosterPrices
        : db.boosterPrices.filter((row) => row.active !== false).map(({ level }) => ({ level, price: 0, active: true })),
      armorTypes: db.armorTypes
    });
  }

  if (pathname === "/api/logout" && req.method === "POST") {
    if (session && !requireCsrf(req, res, session)) return;
    clearSession(res, req);
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === "/api/supplier-records" && req.method === "GET") {
    if (!canUseSupplier(session)) return notAllowed(res, "Only Discord admins can view the sales ledger.");
    const records = db.supplierRecords.filter((record) => !record.paid);
    const paidRecords = db.supplierRecords
      .filter((record) => record.paid)
      .sort((a, b) => String(b.paidAt || "").localeCompare(String(a.paidAt || "")));
    return sendJson(res, 200, { records, paidRecords, summary: supplierSummary(db) });
  }

  if (pathname === "/api/profit-report" && req.method === "GET") {
    if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can view profit reporting.");
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const groupBy = searchParams.get("groupBy") || "daily";
    if (!validIsoDate(from) || !validIsoDate(to)) return sendJson(res, 400, { error: "Choose a valid profit report date range." });
    if (from > to) return sendJson(res, 400, { error: "Profit report start date must be before the end date." });
    if (!["daily", "monthly"].includes(groupBy)) return sendJson(res, 400, { error: "Profit reports can be grouped daily or monthly." });
    return sendJson(res, 200, buildProfitReport(db, from, to, groupBy));
  }

  if (pathname === "/api/supplier-records" && req.method === "POST") {
    if (!canUseSupplier(session)) return notAllowed(res, "Only Discord admins can add sales records.");
    if (!requireCsrf(req, res, session)) return;
    const body = await readJson(req);
    if (!body.buyerName || !body.serviceType || !body.quantity) return sendJson(res, 400, { error: "Buyer character, service, and quantity are required." });
    const quantity = Number(body.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return sendJson(res, 400, { error: "Quantity must be greater than 0." });
    const serviceType = String(body.serviceType || "").trim();
    if (!db.supplierServices.some((service) => service.active !== false && service.type === serviceType)) return sendJson(res, 400, { error: "Choose an active service for this sales record." });
    const armorType = String(body.armorType || "No stack").trim();
    if (!db.armorTypes.includes(armorType)) return sendJson(res, 400, { error: "Choose a valid armor stack." });
    const record = {
      id: randomBytes(10).toString("base64url"),
      date: body.date || new Date().toISOString().slice(0, 10),
      buyerName: String(body.buyerName).trim(),
      serviceType,
      quantity,
      armorType,
      correct: false,
      paid: false,
      note: String(body.note || "").trim(),
      rateAtRecord: supplierRate(db, serviceType),
      createdByDiscordId: session.discordId,
      createdByName: session.username,
      createdAt: new Date().toISOString()
    };
    record.totalCost = lineTotal(record.rateAtRecord, quantity);
    db.supplierRecords.unshift(record);
    writeDb(db);
    return sendJson(res, 201, { record, summary: supplierSummary(db) });
  }

  if (pathname === "/api/supplier-records/mark-paid" && req.method === "POST") {
    if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can mark supplier payments paid.");
    if (!requireCsrf(req, res, session)) return;
    const body = await readJson(req);
    const selectedIds = Array.isArray(body.ids)
      ? new Set(body.ids.map((id) => String(id || "").trim()).filter(Boolean))
      : null;
    const payableRecords = db.supplierRecords.filter((record) => {
      if (!record.correct || record.paid) return false;
      return selectedIds ? selectedIds.has(record.id) : true;
    });
    if (selectedIds && payableRecords.length !== selectedIds.size) return sendJson(res, 400, { error: "Some selected sales records are no longer verified and unpaid. Refresh, then try again." });
    if (!payableRecords.length) return sendJson(res, 400, { error: "There are no verified unpaid sales records to mark paid." });
    const paidAt = new Date().toISOString();
    const paymentBatchId = `spb_${randomBytes(12).toString("base64url")}`;
    for (const record of payableRecords) {
      record.paid = true;
      record.paidAt = paidAt;
      record.paidByDiscordId = session.discordId;
      record.paidByName = session.username;
      record.paymentBatchId = paymentBatchId;
    }
    writeDb(db);
    const records = db.supplierRecords.filter((record) => !record.paid);
    const paidRecords = db.supplierRecords
      .filter((record) => record.paid)
      .sort((a, b) => String(b.paidAt || "").localeCompare(String(a.paidAt || "")));
    return sendJson(res, 200, { paidCount: payableRecords.length, paymentBatchId, records, paidRecords, summary: supplierSummary(db) });
  }

  if (pathname.startsWith("/api/supplier-payment-batches/") && pathname.endsWith("/reopen") && req.method === "POST") {
    if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can reopen supplier payments.");
    if (!requireCsrf(req, res, session)) return;
    const pathParts = pathname.split("/").filter(Boolean);
    const paymentBatchId = decodeURIComponent(pathParts[2] || "");
    const paidRecordsToReopen = db.supplierRecords.filter(
      (record) => record.paid && paymentBatchIdFor(record) === paymentBatchId
    );
    if (!paymentBatchId || !paidRecordsToReopen.length) return sendJson(res, 404, { error: "Paid supplier batch not found. Refresh, then try again." });
    const reopenedAt = new Date().toISOString();
    for (const record of paidRecordsToReopen) {
      record.paid = false;
      record.lastPaymentBatchId = paymentBatchIdFor(record);
      record.reopenedAt = reopenedAt;
      record.reopenedByDiscordId = session.discordId;
      record.reopenedByName = session.username;
      record.paidAt = null;
      record.paidByDiscordId = null;
      record.paidByName = null;
      record.paymentBatchId = null;
    }
    writeDb(db);
    const records = db.supplierRecords.filter((record) => !record.paid);
    const paidRecords = db.supplierRecords
      .filter((record) => record.paid)
      .sort((a, b) => String(b.paidAt || "").localeCompare(String(a.paidAt || "")));
    return sendJson(res, 200, { reopenedCount: paidRecordsToReopen.length, records, paidRecords, summary: supplierSummary(db) });
  }

  if (pathname.startsWith("/api/supplier-records/") && req.method === "PATCH") {
    if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can update sales records.");
    if (!requireCsrf(req, res, session)) return;
    const id = pathname.split("/").pop();
    const body = await readJson(req);
    const record = db.supplierRecords.find((item) => item.id === id);
    if (!record) return sendJson(res, 404, { error: "Sales record not found." });
    if ("date" in body) record.date = String(body.date || "").trim() || record.date;
    if ("buyerName" in body) {
      const buyerName = String(body.buyerName || "").trim();
      if (!buyerName) return sendJson(res, 400, { error: "Buyer character is required." });
      record.buyerName = buyerName;
    }
    if ("serviceType" in body) {
      const serviceType = String(body.serviceType || "").trim();
      const serviceExists = db.supplierServices.some((service) => service.active !== false && service.type === serviceType);
      if (!serviceExists && serviceType !== record.serviceType) return sendJson(res, 400, { error: "Choose a valid service for this sales record." });
      record.serviceType = serviceType;
    }
    if ("quantity" in body) {
      const quantity = Number(body.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) return sendJson(res, 400, { error: "Quantity must be greater than 0." });
      record.quantity = quantity;
    }
    if ("armorType" in body) {
      const armorType = String(body.armorType || "").trim();
      if (!db.armorTypes.includes(armorType) && armorType !== record.armorType) return sendJson(res, 400, { error: "Choose a valid armor stack." });
      record.armorType = armorType;
    }
    if ("rateAtRecord" in body) {
      const rateAtRecord = Number(body.rateAtRecord);
      if (!Number.isFinite(rateAtRecord) || rateAtRecord < 0) return sendJson(res, 400, { error: "Saved rate must be 0 or greater." });
      record.rateAtRecord = rateAtRecord;
    }
    if ("note" in body) record.note = String(body.note || "").trim();
    for (const key of ["correct"]) {
      if (key in body) record[key] = Boolean(body[key]);
    }
    if ("paid" in body) {
      const paid = Boolean(body.paid);
      if (paid && !record.correct) return sendJson(res, 400, { error: "Verify this sales record before marking it paid." });
      record.paid = paid;
      record.paidAt = paid ? new Date().toISOString() : null;
      record.paidByDiscordId = paid ? session.discordId : null;
      record.paidByName = paid ? session.username : null;
      record.paymentBatchId = paid ? `spb_${randomBytes(12).toString("base64url")}` : null;
    }
    record.totalCost = lineTotal(record.rateAtRecord, record.quantity);
    writeDb(db);
    return sendJson(res, 200, { record, summary: supplierSummary(db) });
  }

  if (pathname.startsWith("/api/supplier-records/") && req.method === "DELETE") {
    if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can delete sales records.");
    if (!requireCsrf(req, res, session)) return;
    const id = pathname.split("/").pop();
    const index = db.supplierRecords.findIndex((item) => item.id === id);
    if (index === -1) return sendJson(res, 404, { error: "Sales record not found." });
    const [record] = db.supplierRecords.splice(index, 1);
    writeDb(db);
    return sendJson(res, 200, { record, summary: supplierSummary(db) });
  }

  if (pathname === "/api/booster-records" && req.method === "GET") {
    if (!canUseBooster(session)) return notAllowed(res, "Sign in with a Discord admin or booster role to view payout rows.");
    const records = canManageAdmin(session)
      ? db.boosterRecords
      : db.boosterRecords.filter((record) => record.discordId === session.discordId);
    return sendJson(res, 200, { records, summary: boosterSummary(records) });
  }

  if (pathname === "/api/booster-records" && req.method === "POST") {
    if (!canUseBooster(session) || !session?.discordId) return sendJson(res, 403, { error: "Your Discord role cannot record booster payouts." });
    if (!requireCsrf(req, res, session)) return;
    const body = await readJson(req);
    if (!body.level || !body.quantity) return sendJson(res, 400, { error: "Mythic+ key level and run count are required." });
    const quantity = Number(body.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) return sendJson(res, 400, { error: "Quantity must be a whole number greater than 0." });
    const level = String(body.level || "").trim();
    if (!db.boosterPrices.some((price) => price.active !== false && price.level === level)) return sendJson(res, 400, { error: "Choose an active Mythic+ key level." });
    const record = {
      id: randomBytes(10).toString("base64url"),
      discordId: session.discordId,
      boosterName: session.username,
      level,
      quantity,
      note: String(body.note || "").trim(),
      paid: false,
      rateAtRecord: boosterRate(db, level),
      createdAt: new Date().toISOString()
    };
    record.totalBalance = lineTotal(record.rateAtRecord, quantity);
    db.boosterRecords.unshift(record);
    writeDb(db);
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
    const payableRecords = db.boosterRecords.filter((record) => !record.paid && selectedIds.has(record.id));
    if (payableRecords.length !== selectedIds.size) return sendJson(res, 400, { error: "Some selected booster rows are already paid or no longer available. Refresh, then try again." });
    const paidAt = new Date().toISOString();
    const boosterPaymentBatchId = `bpb_${randomBytes(12).toString("base64url")}`;
    for (const record of payableRecords) {
      record.paid = true;
      record.paidAt = paidAt;
      record.paidByDiscordId = session.discordId;
      record.paidByName = session.username;
      record.boosterPaymentBatchId = boosterPaymentBatchId;
    }
    writeDb(db);
    return sendJson(res, 200, {
      paidCount: payableRecords.length,
      boosterPaymentBatchId,
      records: db.boosterRecords,
      summary: boosterSummary(db.boosterRecords)
    });
  }

  if (pathname.startsWith("/api/booster-records/") && req.method === "PATCH") {
    if (!requireCsrf(req, res, session)) return;
    const id = pathname.split("/").pop();
    const body = await readJson(req);
    const record = db.boosterRecords.find((item) => item.id === id);
    if (!record) return sendJson(res, 404, { error: "Payout row not found." });
    if (!canEditBoosterRecord(session, record)) return notAllowed(res, "Boosters can only edit their own payout rows.");
    if ("paid" in body) {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can mark booster payouts paid.");
      const paid = Boolean(body.paid);
      record.paid = paid;
      record.paidAt = paid ? new Date().toISOString() : null;
      record.paidByDiscordId = paid ? session.discordId : null;
      record.paidByName = paid ? session.username : null;
      record.boosterPaymentBatchId = paid ? `bpb_${randomBytes(12).toString("base64url")}` : null;
    }
    if ("level" in body) {
      const level = String(body.level || "").trim();
      const levelExists = db.boosterPrices.some((price) => price.active !== false && price.level === level);
      if (!levelExists && level !== record.level) return sendJson(res, 400, { error: "Choose a valid Mythic+ key level." });
      const levelChanged = level !== record.level;
      record.level = level;
      if (levelChanged && !canManageAdmin(session)) record.rateAtRecord = boosterRate(db, level);
    }
    if ("quantity" in body) {
      const quantity = Number(body.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) return sendJson(res, 400, { error: "Runs completed must be a whole number greater than 0." });
      record.quantity = quantity;
    }
    if ("createdAt" in body) {
      const createdAt = String(body.createdAt || "").trim();
      if (!createdAt) return sendJson(res, 400, { error: "Payout date is required." });
      record.createdAt = createdAt;
    }
    if ("rateAtRecord" in body) {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can change saved payout rates.");
      const rateAtRecord = Number(body.rateAtRecord);
      if (!Number.isFinite(rateAtRecord) || rateAtRecord < 0) return sendJson(res, 400, { error: "Saved payout rate must be 0 or greater." });
      record.rateAtRecord = rateAtRecord;
    }
    if ("note" in body) record.note = String(body.note || "").trim();
    record.totalBalance = lineTotal(record.rateAtRecord, record.quantity);
    writeDb(db);
    return sendJson(res, 200, { record });
  }

  if (pathname.startsWith("/api/booster-records/") && req.method === "DELETE") {
    if (!canUseBooster(session)) return notAllowed(res, "Sign in with a Discord admin or booster role to delete payout rows.");
    if (!requireCsrf(req, res, session)) return;
    const id = pathname.split("/").pop();
    const index = db.boosterRecords.findIndex((item) => item.id === id);
    if (index === -1) return sendJson(res, 404, { error: "Payout row not found." });
    const record = db.boosterRecords[index];
    if (!canDeleteBoosterRecord(session, record)) return notAllowed(res, "Boosters can only delete their own payout rows.");
    db.boosterRecords.splice(index, 1);
    writeDb(db);
    return sendJson(res, 200, { record });
  }

  if (pathname === "/api/prices/supplier" && req.method === "PUT") {
    if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can change rates.");
    if (!requireCsrf(req, res, session)) return;
    const body = await readJson(req);
    db.supplierServices = cleanPriceRows(body.rows, "type");
    writeDb(db);
    return sendJson(res, 200, { supplierServices: db.supplierServices, summary: supplierSummary(db) });
  }

  if (pathname === "/api/prices/booster" && req.method === "PUT") {
    if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can change rates.");
    if (!requireCsrf(req, res, session)) return;
    const body = await readJson(req);
    db.boosterPrices = cleanPriceRows(body.rows, "level");
    writeDb(db);
    return sendJson(res, 200, { boosterPrices: db.boosterPrices });
  }

  sendJson(res, 404, { error: "Not found." });
}

function cleanPriceRows(rows, key) {
  if (!Array.isArray(rows) || !rows.length) {
    throw Object.assign(new Error("Keep at least one rate row. Archive rates that should no longer be used."), { statusCode: 400 });
  }
  const cleaned = rows
    .map((row) => ({ [key]: String(row[key] || "").trim(), price: Number(row.price), active: row.active !== false }));
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

      setSession(res, { role, discordId: user.id, username: user.global_name || user.username });
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
