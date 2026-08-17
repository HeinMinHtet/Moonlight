import test from "node:test";
import assert from "node:assert/strict";
import { supplierReportFilename } from "../src/utils/exportSupplierReport.js";

test("sales export filename uses only verified record dates", () => {
  const filename = supplierReportFilename([
    { correct: true, date: "2026-08-14" },
    { correct: false, date: "2026-01-01" },
    { correct: true, date: "2026-08-02" }
  ]);
  assert.equal(filename, "Sale-2026-08-02-2026-08-14.png");
});

test("single-date sales export keeps the required range format", () => {
  const filename = supplierReportFilename([
    { correct: true, date: "2026-08-14" },
    { correct: true, date: "2026-08-14" }
  ]);
  assert.equal(filename, "Sale-2026-08-14-2026-08-14.png");
});
