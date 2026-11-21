// Loads .env and validates config before any other module reads process.env.
import "./lib/server/config.js";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { createServer } from "node:http";
import { initDb, recordUserLogin } from "./lib/db.js";
import { cookieOptions, getSession, makeCookie, readCookie, setSession } from "./lib/server/auth.js";
import { DISCORD_ADMIN_ROLE_IDS, DISCORD_BOOSTER_ROLE_IDS, DISCORD_GUILD_ID, OAUTH_STATE_MAX_AGE_MS, PORT, discordReady, root } from "./lib/server/config.js";
import { sendJson, setSecurityHeaders } from "./lib/server/http.js";
import { currentLedgerTag } from "./lib/server/ledgerVersion.js";
import { apiRoutes } from "./lib/server/routes/index.js";

const publicDir = join(root, "public");

const distDir = join(root, "dist");

const useViteDevServer = process.argv.includes("--dev");

process.on("unhandledRejection", (reason) => {
  console.error("[CRITICAL] Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[CRITICAL] Uncaught Exception:", error);
});

// In-memory sliding-window rate limiting
const rateLimitBuckets = new Map();

const RATE_LIMIT_WINDOW_MS = 60 * 1000;

const RATE_LIMIT_MAX_AUTH = 30;

const RATE_LIMIT_MAX_MUTATIONS = 120;

function getClientIp(req) {
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) return String(forwarded).split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "127.0.0.1";
}

function checkRateLimit(ip, category, maxRequests) {
  const key = `${category}:${ip}`;
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key) || [];
  const active = bucket.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
  if (active.length >= maxRequests) {
    return false;
  }
  active.push(now);
  rateLimitBuckets.set(key, active);
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitBuckets.entries()) {
    const fresh = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (fresh.length === 0) rateLimitBuckets.delete(key);
    else rateLimitBuckets.set(key, fresh);
  }
}, 5 * 60 * 1000).unref();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json"
};

async function handleApi(req, res, url) {
  const { pathname, searchParams } = url;

  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip, "mutation", RATE_LIMIT_MAX_MUTATIONS)) {
      return sendJson(res, 429, { error: "Too many requests. Please slow down and try again shortly." });
    }
  }

  // Cheap change check for the UI's background polling: no session or database work.
  if (pathname === "/api/ledger-version" && req.method === "GET") {
    return sendJson(res, 200, { version: currentLedgerTag() });
  }

  if (req.method === "GET" && req.headers["if-none-match"] === `"${currentLedgerTag()}"`) {
    if (["/api/supplier-records", "/api/booster-records", "/api/external-expenses", "/api/raid-notes"].includes(pathname)) {
      setSecurityHeaders(res);
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("ETag", `"${currentLedgerTag()}"`);
      res.writeHead(304);
      return res.end();
    }
  }

  const session = await getSession(req);

  // Route handlers live in lib/server/routes/<domain>.js.
  const context = { req, res, url, pathname, searchParams, session };
  for (const route of apiRoutes) {
    if (!route.match(context)) continue;
    await route.handler(context);
    if (res.writableEnded) return;
  }

  sendJson(res, 404, { error: "Not found." });
}

async function handleDiscord(req, res, url) {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, "auth", RATE_LIMIT_MAX_AUTH)) {
    return redirectWithAuthError(res, "Too many authentication requests. Please wait a minute and try again.");
  }
  if (!discordReady()) return redirectWithAuthError(res, "Discord login is not configured yet. Add OAuth, server, and role IDs.");

  if (url.pathname === "/auth/discord") {
    const state = randomBytes(16).toString("base64url");
    res.setHeader("Set-Cookie", `wow_ledger_oauth_state=${makeCookie({ state })}; ${cookieOptions(Math.floor(OAUTH_STATE_MAX_AGE_MS / 1000))}`);
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
    const stateCookie = readCookie(req, "wow_ledger_oauth_state");
    res.setHeader("Set-Cookie", `wow_ledger_oauth_state=; ${cookieOptions(0)}`);
    if (!code || !state || !stateCookie || state !== stateCookie.state) return redirectWithAuthError(res, "Discord sign-in expired or invalid. Try again.");

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
      try {
        await recordUserLogin({ discordId: user.id, username: user.global_name || user.username, role });
      } catch (error) {
        console.error("[USERS] Could not update the users directory:", error.message);
      }
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

function redirectWithAuthError(res, message) {
  res.writeHead(302, { Location: `/?authError=${encodeURIComponent(message)}` });
  res.end();
}

function serveStatic(req, res, pathname) {
  const file = pathname === "/" ? "index.html" : pathname.slice(1);
  const target = resolve(existsSync(distDir) ? distDir : publicDir, file);
  const fallbackTarget = resolve(publicDir, file);
  const staticRoot = target.startsWith(distDir) && existsSync(distDir) ? distDir : publicDir;
  const resolvedTarget = existsSync(target) ? target : fallbackTarget;
  if (!resolvedTarget.startsWith(staticRoot) && !resolvedTarget.startsWith(publicDir)) return sendJson(res, 400, { error: "Bad path." });
  if (!existsSync(resolvedTarget)) return sendJson(res, 404, { error: "Not found." });
  const stats = statSync(resolvedTarget);
  if (!stats.isFile()) return sendJson(res, 404, { error: "Not found." });
  const etag = `W/"${stats.size.toString(36)}-${Math.floor(stats.mtimeMs).toString(36)}"`;
  setSecurityHeaders(res);
  res.setHeader("ETag", etag);
  res.setHeader("Last-Modified", stats.mtime.toUTCString());
  res.setHeader("Cache-Control", cacheControlFor(pathname));
  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304);
    return res.end();
  }
  res.writeHead(200, { "Content-Type": mimeTypes[extname(resolvedTarget).toLowerCase()] || "application/octet-stream" });
  if (req.method === "HEAD") return res.end();
  res.end(readFileSync(resolvedTarget));
}

// Vite puts content-hashed files in /assets/, so they can be cached forever.
// Everything else (index.html, styles.css, images in public/) keeps the same name
// across deploys, so browsers must revalidate it (cheap 304 thanks to the ETag).
function cacheControlFor(pathname) {
  if (pathname.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  return "no-cache";
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
        if (!res.writableEnded) return serveStatic(req, res, url.pathname);
      });
    }
    return serveStatic(req, res, url.pathname);
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

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    console.log(`WoW Ledger running at http://localhost:${PORT}`);
  });
}

export { server };
export { incrementLedgerVersion } from "./lib/server/ledgerVersion.js";
export { currentLedgerTag } from "./lib/server/ledgerVersion.js";
