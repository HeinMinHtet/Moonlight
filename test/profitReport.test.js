import test from "node:test";
import assert from "node:assert/strict";
import { buildProfitReport, validIsoDate } from "../lib/profitReport.js";

const db = {
  supplierRecords: [
    { paid: true, paidAt: "2026-08-01T15:00:00.000Z", date: "2026-07-20", totalCost: 500 },
    { paid: true, paidAt: "2026-08-02T02:00:00.000Z", date: "2026-08-30", totalCost: 300 },
    { paid: false, paidAt: null, date: "2026-08-01", totalCost: 999 }
  ],
  boosterRecords: [
    { paid: true, paidAt: "2026-08-01T16:00:00.000Z", createdAt: "2026-07-15", totalBalance: 200 },
    { paid: true, paidAt: "2026-09-01T00:00:00.000Z", createdAt: "2026-08-01", totalBalance: 100 },
    { paid: false, paidAt: null, createdAt: "2026-08-01", totalBalance: 999 }
  ],
  externalExpenses: [
    { id: "exp_1", date: "2026-08-01", category: "Raid payment", title: "Heroic Raid Team 1", amount: 150 },
    { id: "exp_2", date: "2026-08-02", category: "M+ outsource payment", title: "Outsource key 14", amount: 50 },
    { id: "exp_3", date: "2026-09-02", category: "Raid payment", title: "Raid 2", amount: 200 }
  ]
};

test("weekly profit groups paid rows and external expenses by their week starting Monday", () => {
  const report = buildProfitReport(db, "2026-07-25", "2026-08-10", "weekly");
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].period, "2026-07-27");
  assert.equal(report.totals.supplierPaidTotal, 800);
  assert.equal(report.totals.boosterPayoutTotal, 200);
  assert.equal(report.totals.externalExpenseTotal, 200);
  assert.equal(report.totals.raidPaymentTotal, 150);
  assert.equal(report.totals.outsourcePaymentTotal, 50);
  assert.equal(report.totals.netProfit, 400); // 800 - 200 - 200 = 400
  assert.equal(report.totals.externalExpenseCount, 2);
});

test("daily profit fallback uses paid timestamps and external expenses on that date", () => {
  const report = buildProfitReport(db, "2026-08-01", "2026-08-01", "daily");
  assert.deepEqual(report.totals, {
    supplierPaidTotal: 500,
    boosterPayoutTotal: 200,
    externalExpenseTotal: 150,
    raidPaymentTotal: 150,
    outsourcePaymentTotal: 0,
    netProfit: 150, // 500 - 200 - 150 = 150
    supplierRecordCount: 1,
    boosterRecordCount: 1,
    externalExpenseCount: 1
  });
  assert.equal(report.rows[0].period, "2026-08-01");
});

test("monthly profit groups every paid row and expense in the selected month", () => {
  const report = buildProfitReport(db, "2026-08-01", "2026-08-31", "monthly");
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].period, "2026-08");
  assert.equal(report.totals.supplierPaidTotal, 800);
  assert.equal(report.totals.boosterPayoutTotal, 200);
  assert.equal(report.totals.externalExpenseTotal, 200);
  assert.equal(report.totals.raidPaymentTotal, 150);
  assert.equal(report.totals.outsourcePaymentTotal, 50);
  assert.equal(report.totals.netProfit, 400);
});

test("date validation rejects impossible calendar dates", () => {
  assert.equal(validIsoDate("2026-08-17"), true);
  assert.equal(validIsoDate("2026-02-30"), false);
  assert.equal(validIsoDate("08/17/2026"), false);
  assert.equal(validIsoDate(""), false);
  assert.equal(validIsoDate(null), false);
});

