import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getSessionFromDb, saveSessionToDb, deleteSessionFromDb, pruneExpiredSessions } from "../db.js";
import { SECURE_COOKIE, SESSION_MAX_AGE_MS, SESSION_SECRET } from "./config.js";
import { notAllowed, sendJson } from "./http.js";

export const sessions = new Map();

// Periodic pruning of in-memory and database sessions with crash guard
setInterval(() => {
  pruneExpiredSessions().catch((err) => {
    console.error("[CRON ERROR] Session pruning failed:", err.message);
  });
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now > Number(session.expiresAt || 0)) sessions.delete(id);
  }
}, 15 * 60 * 1000).unref();

export function sign(value) {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

export function makeCookie(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function readCookie(req, cookieName = "wow_ledger_session") {
  const header = req.headers.cookie || "";
  const cookies = Object.fromEntries(
    header.split(";").map((part) => {
      const [key, ...value] = part.trim().split("=");
      return [key, value.join("=")];
    }).filter(([key]) => key)
  );
  const raw = cookies[cookieName];
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

export async function setSession(res, session) {
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

export async function clearSession(res, req) {
  const cookie = readCookie(req);
  if (cookie?.id) {
    sessions.delete(cookie.id);
    await deleteSessionFromDb(cookie.id);
  }
  res.setHeader("Set-Cookie", `wow_ledger_session=; ${cookieOptions(0)}`);
}

export async function getSession(req) {
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

export function cookieOptions(maxAge) {
  return `HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${SECURE_COOKIE ? "; Secure" : ""}`;
}

export function canUseSupplier(session) {
  return session?.role === "admin";
}

export function canManageAdmin(session) {
  return session?.role === "admin";
}

export function canUseBooster(session) {
  return session?.role === "booster" || session?.role === "admin";
}

export function canDeleteBoosterRecord(session, record) {
  return canManageAdmin(session) || (canUseBooster(session) && !record?.paid && record?.discordId === session?.discordId);
}

export function canEditBoosterRecord(session, record) {
  return canDeleteBoosterRecord(session, record);
}

export function permissionsFor(session) {
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
    priceSettings: canManageAdmin(session),
    externalExpenses: canManageAdmin(session),
    raidNotes: canManageAdmin(session)
  };
}

export function requireCsrf(req, res, session) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return true;
  if (!session) {
    notAllowed(res, "Sign in with Discord before saving changes.");
    return false;
  }
  const clientToken = Buffer.from(String(req.headers["x-csrf-token"] || ""));
  const sessionToken = Buffer.from(String(session.csrfToken || ""));
  if (clientToken.length === 0 || clientToken.length !== sessionToken.length || !timingSafeEqual(clientToken, sessionToken)) {
    sendJson(res, 403, { error: "Your session changed. Refresh the page, then try again." });
    return false;
  }
  return true;
}

export function publicUser(session) {
  if (!session) return null;
  return {
    role: session.role,
    discordId: session.discordId,
    username: session.username,
    expiresAt: session.expiresAt
  };
}
