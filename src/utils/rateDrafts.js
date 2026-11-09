// Tracks which Default rates sections have edits that are not saved yet.
// The baseline is a JSON snapshot of each list as last received from the server.

export const RATE_SECTIONS = [
  { key: "supplierServices", label: "Supplier rates" },
  { key: "boosterPrices", label: "Booster rates" },
  { key: "supplierGuilds", label: "Supplier guilds" },
  { key: "armorTypes", label: "Armor stacks" },
  { key: "raidNoteTitles", label: "Raid note titles" },
  { key: "buyerPurchaseTypes", label: "Buyer purchase types" }
];

const RATE_KEYS = RATE_SECTIONS.map((section) => section.key);

export function serializeRateRows(rows) {
  return JSON.stringify(Array.isArray(rows) ? rows : []);
}

export function rateBaselineFrom(source = {}) {
  return Object.fromEntries(RATE_KEYS.map((key) => [key, serializeRateRows(source[key])]));
}

export function markRatesSaved(current, patch) {
  const savedRates = { ...(current.savedRates || {}) };
  for (const [key, rows] of Object.entries(patch)) savedRates[key] = serializeRateRows(rows);
  return { ...current, ...patch, savedRates };
}

export function dirtyRateSections(data = {}, baseline = {}) {
  return RATE_SECTIONS.filter(({ key }) => baseline[key] !== undefined && serializeRateRows(data[key]) !== baseline[key]);
}

export function restoreRateBaseline(current) {
  const baseline = current.savedRates || {};
  const restored = {};
  for (const key of RATE_KEYS) {
    if (baseline[key] !== undefined) restored[key] = JSON.parse(baseline[key]);
  }
  return { ...current, ...restored };
}
