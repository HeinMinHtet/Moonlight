import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const root = resolve(".");

loadEnv();

export const PORT = Number(process.env.PORT || 3000);

export const SESSION_SECRET = process.env.SESSION_SECRET || "local-development-secret";

if (
  process.env.NODE_ENV === "production" &&
  (!process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET === "local-development-secret" ||
    process.env.SESSION_SECRET === "change-this-long-random-secret")
) {
  console.error(
    "[SECURITY CRITICAL] Running in production with an unset or default SESSION_SECRET. Set a strong random SESSION_SECRET in your environment before public launch. Exiting."
  );
  process.exit(1);
}

export const SESSION_MAX_AGE_MS = Number(process.env.SESSION_MAX_AGE_HOURS || 12) * 60 * 60 * 1000;

export const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;

export const SECURE_COOKIE = process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";

export const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

export const DISCORD_ADMIN_ROLE_IDS = parseIdList(process.env.DISCORD_ADMIN_ROLE_IDS);

export const DISCORD_BOOSTER_ROLE_IDS = parseIdList(process.env.DISCORD_BOOSTER_ROLE_IDS);

export function loadEnv() {
  // Tests must never pick up real credentials or a production DATABASE_URL from .env.
  if (process.env.NODE_ENV === "test" || process.env.LEDGER_TEST_ENV_LOCKED === "1") return;
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim();
  }
}

export function parseIdList(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

export function discordReady() {
  return Boolean(
    process.env.DISCORD_CLIENT_ID &&
    process.env.DISCORD_CLIENT_SECRET &&
    process.env.DISCORD_REDIRECT_URI &&
    DISCORD_GUILD_ID &&
    (DISCORD_ADMIN_ROLE_IDS.size || DISCORD_BOOSTER_ROLE_IDS.size)
  );
}
