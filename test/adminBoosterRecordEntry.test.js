import test from "node:test";
import assert from "node:assert/strict";
import { calculateBoosterBalances } from "../src/utils/boosterBalance.js";
import { boosterSummary } from "../lib/db.js";
import { buildProfitReport } from "../lib/profitReport.js";

test("calculateBoosterBalances correctly computes balances for outsourced boosters without Discord ID", () => {
  const records = [
    { id: "r1", discordId: "outsourced:PugTank-Illidan", boosterName: "PugTank-Illidan", totalBalance: 150, paid: false },
    { id: "r2", discordId: "outsourced:PugTank-Illidan", boosterName: "PugTank-Illidan", totalBalance: 150, paid: false },
    { id: "r3", discordId: "outsourced:Team-Alpha", boosterName: "Team-Alpha", totalBalance: 300, paid: true },
    { id: "r4", discordId: "123456789", boosterName: "GuildBooster1", totalBalance: 200, paid: false }
  ];

  const adjustments = [
    { id: "a1", discordId: "outsourced:PugTank-Illidan", boosterName: "PugTank-Illidan", type: "deduct", amount: 50, settled: false, note: "Advance" }
  ];

  const balances = calculateBoosterBalances(records, adjustments);

  // PugTank-Illidan: Open runs = 300, Adjustments = -50 => Current balance = 250
  const pugTank = balances.find((b) => b.boosterName === "PugTank-Illidan");
  assert.ok(pugTank);
  assert.equal(pugTank.openRunsCount, 2);
  assert.equal(pugTank.openRunsTotal, 300);
  assert.equal(pugTank.adjustmentsTotal, -50);
  assert.equal(pugTank.currentBalance, 250);

  // Team-Alpha: Paid runs = 300, Open runs = 0 => Current balance = 0
  const teamAlpha = balances.find((b) => b.boosterName === "Team-Alpha");
  assert.ok(teamAlpha);
  assert.equal(teamAlpha.openRunsCount, 0);
  assert.equal(teamAlpha.paidRunsCount, 1);
  assert.equal(teamAlpha.paidRunsTotal, 300);
  assert.equal(teamAlpha.currentBalance, 0);
});

test("boosterSummary includes open runs for outsourced boosters", () => {
  const records = [
    { id: "r1", discordId: "outsourced:ExtBooster", boosterName: "ExtBooster", totalBalance: 220, paid: false },
    { id: "r2", discordId: "123456", boosterName: "InternalBooster", totalBalance: 180, paid: false },
    { id: "r3", discordId: "outsourced:ExtBooster", boosterName: "ExtBooster", totalBalance: 220, paid: true }
  ];

  const summary = boosterSummary(records);
  assert.equal(summary.length, 2);

  const extSummary = summary.find((s) => s.boosterName === "ExtBooster");
  assert.ok(extSummary);
  assert.equal(extSummary.openCount, 1);
  assert.equal(extSummary.openTotal, 220);
});

test("buildProfitReport includes paid outsourced booster payouts in profit calculations", () => {
  const db = {
    supplierRecords: [
      { id: "s1", totalCost: 1000, paid: true, paidAt: "2026-08-31T10:00:00.000Z" },
      { id: "s2", totalCost: 500, paid: true, paidAt: "2026-08-31T12:00:00.000Z" }
    ],
    boosterRecords: [
      // Internal booster payout
      { id: "b1", totalBalance: 300, paid: true, paidAt: "2026-08-31T11:00:00.000Z", boosterName: "InternalBooster" },
      // Outsourced booster payout
      { id: "b2", totalBalance: 400, paid: true, paidAt: "2026-08-31T14:00:00.000Z", boosterName: "OutsourcedTeam-X" },
      // Unpaid outsourced run (should not be counted in paid profit report yet)
      { id: "b3", totalBalance: 200, paid: false, boosterName: "OutsourcedTeam-X" }
    ]
  };

  const report = buildProfitReport(db, "2026-08-31", "2026-08-31", "daily");

  assert.equal(report.totals.supplierPaidTotal, 1500);
  assert.equal(report.totals.boosterPayoutTotal, 700); // 300 + 400
  assert.equal(report.totals.netProfit, 800); // 1500 - 700
  assert.equal(report.totals.boosterRecordCount, 2);
});
