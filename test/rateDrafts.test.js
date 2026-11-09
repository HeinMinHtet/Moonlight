import test from "node:test";
import assert from "node:assert/strict";
import { dirtyRateSections, markRatesSaved, rateBaselineFrom, restoreRateBaseline } from "../src/utils/rateDrafts.js";

const serverConfig = {
  supplierServices: [{ type: "m10", price: 140, active: true }],
  boosterPrices: [{ level: "m10", price: 95, active: true }],
  supplierGuilds: [],
  armorTypes: [{ name: "Plate", active: true, isDefault: false }],
  raidNoteTitles: [],
  buyerPurchaseTypes: []
};

test("a fresh baseline has no unsaved sections", () => {
  const data = { ...serverConfig, savedRates: rateBaselineFrom(serverConfig) };
  assert.deepEqual(dirtyRateSections(data, data.savedRates), []);
});

test("editing a price marks only that section as unsaved, and reverting clears it", () => {
  const baseline = rateBaselineFrom(serverConfig);
  const edited = { ...serverConfig, supplierServices: [{ type: "m10", price: 150, active: true }] };
  assert.deepEqual(dirtyRateSections(edited, baseline).map((s) => s.label), ["Supplier rates"]);
  const reverted = { ...edited, supplierServices: [{ type: "m10", price: 140, active: true }] };
  assert.deepEqual(dirtyRateSections(reverted, baseline), []);
});

test("saving a section updates its baseline without touching other drafts", () => {
  const current = {
    ...serverConfig,
    supplierServices: [{ type: "m10", price: 150, active: true }],
    boosterPrices: [{ level: "m10", price: 99, active: true }],
    savedRates: rateBaselineFrom(serverConfig)
  };
  const next = markRatesSaved(current, { supplierServices: [{ type: "m10", price: 150, active: true }] });
  assert.deepEqual(dirtyRateSections(next, next.savedRates).map((s) => s.key), ["boosterPrices"]);
});

test("discarding restores every section to its saved values", () => {
  const current = {
    ...serverConfig,
    armorTypes: [],
    savedRates: rateBaselineFrom(serverConfig)
  };
  const restored = restoreRateBaseline(current);
  assert.deepEqual(restored.armorTypes, serverConfig.armorTypes);
  assert.deepEqual(dirtyRateSections(restored, restored.savedRates), []);
});

test("no baseline yet means nothing is reported as unsaved", () => {
  assert.deepEqual(dirtyRateSections(serverConfig, {}), []);
});
