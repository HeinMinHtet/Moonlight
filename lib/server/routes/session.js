import { getConfig } from "../../db.js";
import { clearSession, permissionsFor, publicUser, requireCsrf } from "../auth.js";
import { DISCORD_ADMIN_ROLE_IDS, DISCORD_BOOSTER_ROLE_IDS, DISCORD_GUILD_ID, discordReady } from "../config.js";
import { sendJson } from "../http.js";

// Each route: match() decides whether it handles the request; handler() is the
// original handleApi branch, unchanged. Routes are tried in order.
export const sessionRoutes = [
  {
    // GET /api/config
    match: ({ pathname, req }) => pathname === "/api/config" && req.method === "GET",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
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
  },
  {
    // POST /api/logout
    match: ({ pathname, req }) => pathname === "/api/logout" && req.method === "POST",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (session && !requireCsrf(req, res, session)) return;
      await clearSession(res, req);
      return sendJson(res, 200, { ok: true });
    }
  }
];
