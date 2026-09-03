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

test("profit report includes settled booster bonuses and penalty deductions", () => {
  const dbWithAdjs = {
    supplierRecords: [
      { paid: true, paidAt: "2026-08-05T10:00:00.000Z", date: "2026-08-05", totalCost: 1000 }
    ],
    boosterRecords: [
      { paid: true, paidAt: "2026-08-05T10:00:00.000Z", createdAt: "2026-08-05", totalBalance: 400 }
    ],
    boosterAdjustments: [
      { settled: true, settledAt: "2026-08-05T10:00:00.000Z", type: "add", amount: 50 },
      { settled: true, settledAt: "2026-08-05T10:00:00.000Z", type: "deduct", amount: 20 },
      { settled: false, settledAt: null, type: "add", amount: 100 } // Unsettled should be ignored
    ],
    externalExpenses: []
  };

  const report = buildProfitReport(dbWithAdjs, "2026-08-05", "2026-08-05", "daily");
  assert.equal(report.totals.supplierPaidTotal, 1000);
  // boosterPayoutTotal = 400 (runs) + 50 (bonus) - 20 (penalty) = 430
  assert.equal(report.totals.boosterPayoutTotal, 430);
  // netProfit = 1000 - 430 = 570
  assert.equal(report.totals.netProfit, 570);
});

test("profit report respects Thailand timezone for late-night UTC timestamps", () => {
  const dbTz = {
    supplierRecords: [
      // 18:30 UTC on Aug 31 is 01:30 AM on Sept 1 in Bangkok (UTC+7)
      { paid: true, paidAt: "2026-08-31T18:30:00.000Z", date: "2026-08-31", totalCost: 600 }
    ],
    boosterRecords: [],
    externalExpenses: [
      { id: "e1", date: "2026-09-01", category: "Raid", amount: 100 }
    ]
  };

  const reportSept = buildProfitReport(dbTz, "2026-09-01", "2026-09-01", "daily");
  assert.equal(reportSept.totals.supplierPaidTotal, 600);
  assert.equal(reportSept.totals.externalExpenseTotal, 100);
  assert.equal(reportSept.totals.netProfit, 500);
  assert.equal(reportSept.rows[0].period, "2026-09-01");
});

test("date validation rejects impossible calendar dates", () => {
  assert.equal(validIsoDate("2026-08-17"), true);
  assert.equal(validIsoDate("2026-02-30"), false);
  assert.equal(validIsoDate("08/17/2026"), false);
  assert.equal(validIsoDate(""), false);
  assert.equal(validIsoDate(null), false);
});

