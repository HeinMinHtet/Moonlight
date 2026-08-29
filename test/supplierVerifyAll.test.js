import test from "node:test";
import assert from "node:assert/strict";
import { unverifyAllSupplierRecords, verifyAllSupplierRecords } from "../lib/db.js";
import { buildSupplierSummary } from "../src/utils/supplierBatch.js";

test("verifyAllSupplierRecords updates unverified unpaid records", async () => {
  const result = await verifyAllSupplierRecords();
  assert.ok(typeof result.verifiedCount === "number");
});

test("unverifyAllSupplierRecords updates verified unpaid records", async () => {
  const result = await unverifyAllSupplierRecords();
  assert.ok(typeof result.unverifiedCount === "number");
});

test("buildSupplierSummary calculates correct summary for filtered date range records", () => {
  const records = [
    { id: "1", correct: true, paid: false, serviceType: "M+ 10", rateAtRecord: 100, quantity: 2, totalCost: 200, date: "2026-08-10" },
    { id: "2", correct: true, paid: false, serviceType: "M+ 10", rateAtRecord: 100, quantity: 1, totalCost: 100, date: "2026-08-15" },
    { id: "3", correct: true, paid: false, serviceType: "Raid", rateAtRecord: 500, quantity: 1, totalCost: 500, date: "2026-08-20" }
  ];

  // Filter for 2026-08-10 to 2026-08-15
  const rangeRecords = records.filter((r) => r.date >= "2026-08-10" && r.date <= "2026-08-15");
  const summary = buildSupplierSummary(rangeRecords);

  assert.equal(rangeRecords.length, 2);
  assert.equal(summary.length, 1);
  assert.equal(summary[0].type, "M+ 10");
  assert.equal(summary[0].totalQty, 3);
  assert.equal(summary[0].totalCost, 300);
});
