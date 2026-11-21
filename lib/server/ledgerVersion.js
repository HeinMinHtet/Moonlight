import { randomBytes } from "node:crypto";

export let ledgerVersion = 1;

// Changes on every restart, so a version number seen before a deploy can never
// match data from after it (ledgerVersion itself restarts at 1).
export const BOOT_ID = randomBytes(6).toString("base64url");

export function incrementLedgerVersion() {
  ledgerVersion += 1;
}

export function currentLedgerTag() {
  return `${BOOT_ID}-${ledgerVersion}`;
}
