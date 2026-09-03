import test from "node:test";
import assert from "node:assert/strict";
import { calculateTieredDiscounts, formatCalculationOutput } from "../src/utils/priceCalculator.js";

test("calculateTieredDiscounts computes 10% and additional 10% discount accurately", () => {
  // Example from user request: 100 -> 90 -> 81
  const result = calculateTieredDiscounts(100, 10, 10);
  assert.equal(result.originalPrice, 100);
  assert.equal(result.discountedPrice1, 90);
  assert.equal(result.discount1Amount, 10);
  assert.equal(result.discountedPrice2, 81);
  assert.equal(result.discount2Amount, 9);
  assert.equal(result.totalDiscountAmount, 19);
});

test("calculateTieredDiscounts handles decimal and non-round values with 2-digit rounding", () => {
  const result = calculateTieredDiscounts(250000, 10, 10);
  assert.equal(result.originalPrice, 250000);
  assert.equal(result.discountedPrice1, 225000);
  assert.equal(result.discountedPrice2, 202500);

  const oddPrice = calculateTieredDiscounts(33.33, 10, 10);
  assert.equal(oddPrice.originalPrice, 33.33);
  assert.equal(oddPrice.discountedPrice1, 30);
  assert.equal(oddPrice.discountedPrice2, 27);
});

test("calculateTieredDiscounts handles 0, negative, or invalid price safely", () => {
  const zeroResult = calculateTieredDiscounts(0);
  assert.equal(zeroResult.originalPrice, 0);
  assert.equal(zeroResult.discountedPrice1, 0);
  assert.equal(zeroResult.discountedPrice2, 0);

  const invalidResult = calculateTieredDiscounts("abc");
  assert.equal(invalidResult.originalPrice, 0);
  assert.equal(invalidResult.discountedPrice1, 0);
  assert.equal(invalidResult.discountedPrice2, 0);

  const negResult = calculateTieredDiscounts(-50);
  assert.equal(negResult.originalPrice, 0);
});

test("formatCalculationOutput generates clean copyable text with only service name and final result", () => {
  const items = [
    { serviceName: "M+ 10", originalPrice: 100 },
    { serviceName: "Heroic Raid", originalPrice: 200 }
  ];

  const listText = formatCalculationOutput(items, { discount1Pct: 10, discount2Pct: 10, format: "list" });
  assert.equal(listText, "M+ 10: 81\nHeroic Raid: 162");

  const bulletText = formatCalculationOutput(items, { discount1Pct: 10, discount2Pct: 10, format: "bullet" });
  assert.equal(bulletText, "• M+ 10: 81\n• Heroic Raid: 162");

  const dashText = formatCalculationOutput(items, { discount1Pct: 10, discount2Pct: 10, format: "dash" });
  assert.equal(dashText, "M+ 10 - 81\nHeroic Raid - 162");

  const tableText = formatCalculationOutput(items, { discount1Pct: 10, discount2Pct: 10, format: "table" });
  assert.ok(tableText.includes("Service"));
  assert.ok(tableText.includes("Final Price"));
  assert.ok(tableText.includes("M+ 10"));
  assert.ok(tableText.includes("81"));
  assert.ok(!tableText.includes("%"));
});

test("formatCalculationOutput returns empty string for empty item lists", () => {
  assert.equal(formatCalculationOutput([]), "");
  assert.equal(formatCalculationOutput([{ serviceName: "", originalPrice: 0 }]), "");
});
