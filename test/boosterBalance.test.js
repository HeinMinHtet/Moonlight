import test from "node:test";
import assert from "node:assert/strict";
import { calculateBoosterBalances, calculateBoosterSettlement, validateAdjustmentPayload } from "../src/utils/boosterBalance.js";

test("calculateBoosterBalances accurately sums open runs, paid runs, and adjustments", () => {
  const mockRecords = [
    { id: "r1", discordId: "d1", boosterName: "Alice", totalBalance: 100, paid: false },
    { id: "r2", discordId: "d1", boosterName: "Alice", totalBalance: 150, paid: false },
    { id: "r3", discordId: "d1", boosterName: "Alice", totalBalance: 200, paid: true },
    { id: "r4", discordId: "d2", boosterName: "Bob", totalBalance: 80, paid: false }
  ];

  const mockAdjustments = [
    { id: "a1", discordId: "d1", boosterName: "Alice", type: "add", amount: 50, note: "Weekly Bonus" },
    { id: "a2", discordId: "d1", boosterName: "Alice", type: "deduct", amount: 20, note: "Key penalty" },
    { id: "a3", discordId: "d2", boosterName: "Bob", type: "deduct", amount: 100, note: "Advance" }
  ];

  const balances = calculateBoosterBalances(mockRecords, mockAdjustments);

  // Alice: Open runs = 250, Paid runs = 200, Adjustments = +50 -20 = +30
  // Current Balance = 250 + 30 = 280
  // Lifetime Earned = 250 + 200 + 50 = 500
  const alice = balances.find((b) => b.discordId === "d1");
  assert.ok(alice);
  assert.equal(alice.openRunsTotal, 250);
  assert.equal(alice.paidRunsTotal, 200);
  assert.equal(alice.adjustmentsTotal, 30);
  assert.equal(alice.currentBalance, 280);
  assert.equal(alice.lifetimeEarned, 500);

  // Bob: Open runs = 80, Paid runs = 0, Adjustments = -100
  // Current Balance = 80 - 100 = -20 (negative balance supported)
  const bob = balances.find((b) => b.discordId === "d2");
  assert.ok(bob);
  assert.equal(bob.openRunsTotal, 80);
  assert.equal(bob.adjustmentsTotal, -100);
  assert.equal(bob.currentBalance, -20);
});

test("validateAdjustmentPayload accepts valid data and rejects invalid inputs", () => {
  // Valid payload
  assert.doesNotThrow(() => {
    validateAdjustmentPayload({
      boosterName: "Alice",
      type: "add",
      amount: 50,
      note: "Good run",
      date: "2026-08-18"
    });
  });

  // Rejects missing booster name
  assert.throws(() => {
    validateAdjustmentPayload({
      boosterName: "",
      type: "add",
      amount: 50,
      note: "Good run"
    });
  }, /Booster name is required/);

  // Rejects invalid type
  assert.throws(() => {
    validateAdjustmentPayload({
      boosterName: "Alice",
      type: "invalid",
      amount: 50,
      note: "Good run"
    });
  }, /Adjustment type must be 'add' or 'deduct'/);

  // Rejects negative or zero amount
  assert.throws(() => {
    validateAdjustmentPayload({
      boosterName: "Alice",
      type: "deduct",
      amount: -10,
      note: "Penalty"
    });
  }, /Adjustment amount must be a positive number/);

  assert.throws(() => {
    validateAdjustmentPayload({
      boosterName: "Alice",
      type: "deduct",
      amount: 0,
      note: "Penalty"
    });
  }, /Adjustment amount must be a positive number/);

  // Rejects empty note
  assert.throws(() => {
    validateAdjustmentPayload({
      boosterName: "Alice",
      type: "deduct",
      amount: 50,
      note: "   "
    });
  }, /Reason \/ note is required/);

  // Rejects invalid date format
  assert.throws(() => {
    validateAdjustmentPayload({
      boosterName: "Alice",
      type: "deduct",
      amount: 50,
      note: "Penalty",
      date: "18-08-2026"
    });
  }, /Date must be in YYYY-MM-DD format/);
});

test("calculateBoosterBalances excludes settled adjustments from current balance but retains them in lifetime earned", () => {
  const records = [
    { id: "r1", discordId: "d1", boosterName: "Alice", totalBalance: 100, paid: false }
  ];
  const adjustments = [
    { id: "a1", discordId: "d1", boosterName: "Alice", type: "add", amount: 50, settled: true, note: "Old bonus" },
    { id: "a2", discordId: "d1", boosterName: "Alice", type: "deduct", amount: 30, settled: true, note: "Old loan" },
    { id: "a3", discordId: "d1", boosterName: "Alice", type: "deduct", amount: 20, settled: false, note: "Active penalty" }
  ];

  const balances = calculateBoosterBalances(records, adjustments);
  const alice = balances.find((b) => b.discordId === "d1");
  assert.ok(alice);
  // Open runs = 100, Active adjustments = -20. Current balance = 80
  assert.equal(alice.openRunsTotal, 100);
  assert.equal(alice.adjustmentsTotal, -20);
  assert.equal(alice.currentBalance, 80);
  assert.equal(alice.adjustmentsCount, 1);
  // Lifetime earned = 100 (open runs) + 50 (lifetime credit adjustments) = 150
  assert.equal(alice.lifetimeEarned, 150);
});

test("calculateBoosterSettlement handles positive balance and deficit settlement correctly", () => {
  // Case 1: Positive balance (100k runs, -30k debt, +10k bonus => Net Payout = 80k)
  const openRuns1 = [
    { id: "r1", totalBalance: 60 },
    { id: "r2", totalBalance: 40 }
  ];
  const adjustments1 = [
    { id: "a1", type: "deduct", amount: 30, settled: false },
    { id: "a2", type: "add", amount: 10, settled: false }
  ];
  const res1 = calculateBoosterSettlement({ boosterName: "Alex" }, openRuns1, adjustments1);
  assert.equal(res1.openRunsTotal, 100);
  assert.equal(res1.addAdjustmentsTotal, 10);
  assert.equal(res1.deductAdjustmentsTotal, 30);
  assert.equal(res1.netAdjustmentsTotal, -20);
  assert.equal(res1.currentBalance, 80);
  assert.equal(res1.isDeficit, false);
  assert.equal(res1.netPayoutAmount, 80);
  assert.equal(res1.debtOffsetAmount, 30);
  assert.equal(res1.remainingDebt, 0);

  // Case 2: Deficit (40k runs, -100k debt => Net Payout = 0, Debt offset = 40k, Remaining debt = 60k)
  const openRuns2 = [
    { id: "r3", totalBalance: 40 }
  ];
  const adjustments2 = [
    { id: "a3", type: "deduct", amount: 100, settled: false }
  ];
  const res2 = calculateBoosterSettlement({ boosterName: "Sarah" }, openRuns2, adjustments2);
  assert.equal(res2.openRunsTotal, 40);
  assert.equal(res2.netAdjustmentsTotal, -100);
  assert.equal(res2.currentBalance, -60);
  assert.equal(res2.isDeficit, true);
  assert.equal(res2.netPayoutAmount, 0);
  assert.equal(res2.debtOffsetAmount, 40);
  assert.equal(res2.remainingDebt, 60);
});

test("calculateBoosterBalances unifies outsourced booster runs and named adjustments under one account without splitting", () => {
  const records = [
    { id: "r1", discordId: "outsourced:PugTank", boosterName: "PugTank", totalBalance: 120, paid: false }
  ];
  const adjustments = [
    { id: "a1", discordId: "PugTank", boosterName: "PugTank", type: "deduct", amount: 20, settled: false }
  ];

  const balances = calculateBoosterBalances(records, adjustments);
  assert.equal(balances.length, 1);
  assert.equal(balances[0].boosterName, "PugTank");
  assert.equal(balances[0].openRunsTotal, 120);
  assert.equal(balances[0].deductAdjustmentsTotal, 20);
  assert.equal(balances[0].currentBalance, 100);
});


