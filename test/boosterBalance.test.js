import test from "node:test";
import assert from "node:assert/strict";
import { calculateBoosterBalances, validateAdjustmentPayload } from "../src/utils/boosterBalance.js";

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
