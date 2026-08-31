import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateBoosterVaultBalances,
  calculateBoosterSettlement,
  validateVaultWithdrawalPayload
} from "../src/utils/boosterBalance.js";
import { mmk } from "../src/utils/format.js";
import {
  insertBoosterRecord,
  deleteBoosterRecord,
  settleBoosterBalance,
  withdrawBoosterVaultCash,
  getBoosterCashVaultPayload
} from "../lib/db.js";

test("calculateBoosterVaultBalances aggregates deposits, withdrawals, and net stored MMK", () => {
  const transactions = [
    { id: "t1", discordId: "d1", boosterName: "Alice", type: "deposit", amount: 90000 },
    { id: "t2", discordId: "d1", boosterName: "Alice", type: "withdraw", amount: 30000 },
    { id: "t3", discordId: "d1", boosterName: "Alice", type: "deposit", amount: 50000 },
    { id: "t4", discordId: "d2", boosterName: "Bob", type: "deposit", amount: 120000 }
  ];

  const vaultBalances = calculateBoosterVaultBalances(transactions);
  assert.equal(vaultBalances.length, 2);

  // Alice: Deposited = 90k + 50k = 140k, Withdrawn = 30k => Balance = 110k
  const alice = vaultBalances.find((v) => v.discordId === "d1");
  assert.ok(alice);
  assert.equal(alice.totalDeposited, 140000);
  assert.equal(alice.totalWithdrawn, 30000);
  assert.equal(alice.currentVaultBalance, 110000);
  assert.equal(alice.transactionsCount, 3);

  // Bob: Deposited = 120k, Withdrawn = 0 => Balance = 120k
  const bob = vaultBalances.find((v) => v.discordId === "d2");
  assert.ok(bob);
  assert.equal(bob.totalDeposited, 120000);
  assert.equal(bob.totalWithdrawn, 0);
  assert.equal(bob.currentVaultBalance, 120000);
});

test("calculateBoosterSettlement calculates MMK converted amount with rate", () => {
  const openRuns = [
    { id: "r1", totalBalance: 300 },
    { id: "r2", totalBalance: 200 }
  ];
  const adjustments = [
    { id: "a1", type: "add", amount: 50, settled: false }
  ];

  // Net gold payout = 500 + 50 = 550 gold. Rate = 180 MMK / gold => 99,000 MMK
  const res = calculateBoosterSettlement({ boosterName: "Alice" }, openRuns, adjustments, 180);
  assert.equal(res.openRunsTotal, 500);
  assert.equal(res.netPayoutAmount, 550);
  assert.equal(res.rate, 180);
  assert.equal(res.cashAmountMmk, 99000);
});

test("validateVaultWithdrawalPayload validates inputs correctly", () => {
  // Valid payload
  assert.doesNotThrow(() => {
    validateVaultWithdrawalPayload({
      boosterName: "Alice",
      amount: 50000,
      currentVaultBalance: 90000,
      note: "Sent via KBZPay",
      date: "2026-08-31"
    });
  });

  // Rejects missing booster name
  assert.throws(() => {
    validateVaultWithdrawalPayload({
      boosterName: "",
      amount: 50000,
      currentVaultBalance: 90000,
      note: "Sent via KPay"
    });
  }, /Booster name is required/);

  // Rejects zero or negative amount
  assert.throws(() => {
    validateVaultWithdrawalPayload({
      boosterName: "Alice",
      amount: 0,
      currentVaultBalance: 90000,
      note: "Sent via KPay"
    });
  }, /Withdrawal amount must be a positive number/);

  // Rejects amount exceeding current vault balance
  assert.throws(() => {
    validateVaultWithdrawalPayload({
      boosterName: "Alice",
      amount: 100000,
      currentVaultBalance: 90000,
      note: "Sent via KPay"
    });
  }, /exceed the stored cash vault balance/);

  // Rejects empty note
  assert.throws(() => {
    validateVaultWithdrawalPayload({
      boosterName: "Alice",
      amount: 50000,
      currentVaultBalance: 90000,
      note: "   "
    });
  }, /Payment note or channel reference is required/);
});

test("mmk formatter formats numbers with MMK suffix", () => {
  assert.equal(mmk(90000), "90,000 MMK");
  assert.equal(mmk(0), "0 MMK");
  assert.equal(mmk(1250000), "1,250,000 MMK");
});

test("settleBoosterBalance with action 'hold_cash' stores converted MMK in vault and withdrawBoosterVaultCash releases it", async () => {
  const session = { discordId: "admin_test", username: "AdminTest", role: "admin" };
  const testBoosterName = `VaultTester_${Date.now()}`;
  const testDiscordId = `discord_${Date.now()}`;

  // Insert a test open run (500 gold balance)
  const testRun = {
    id: `r_test_${Date.now()}`,
    discordId: testDiscordId,
    boosterName: testBoosterName,
    level: "m10",
    quantity: 5,
    note: "Test runs for vault",
    paid: false,
    rateAtRecord: 100,
    totalBalance: 500,
    createdAt: new Date().toISOString()
  };
  await insertBoosterRecord(testRun);

  // 1. Settle with action 'hold_cash' at rate 180 => 500 * 180 = 90,000 MMK
  const settleRes = await settleBoosterBalance(
    { discordId: testDiscordId, boosterName: testBoosterName },
    session,
    { rate: 180, action: "hold_cash", note: "Vault hold test" }
  );

  assert.equal(settleRes.settledCount, 1);
  assert.equal(settleRes.netPayoutAmount, 500);
  assert.equal(settleRes.rate, 180);
  assert.equal(settleRes.cashAmountMmk, 90000);
  assert.equal(settleRes.action, "hold_cash");
  assert.ok(settleRes.vaultTransaction);
  assert.equal(settleRes.vaultTransaction.amount, 90000);
  assert.equal(settleRes.vaultTransaction.rate, 180);
  assert.equal(settleRes.vaultTransaction.type, "deposit");

  // Verify vault payload
  const vaultPayload = await getBoosterCashVaultPayload(session, true);
  const boosterTx = vaultPayload.vaultTransactions.find((tx) => tx.discordId === testDiscordId);
  assert.ok(boosterTx);
  assert.equal(boosterTx.amount, 90000);

  // 2. Withdraw 30,000 MMK from the vault
  const withdrawRes = await withdrawBoosterVaultCash({
    discordId: testDiscordId,
    boosterName: testBoosterName,
    amount: 30000,
    paymentMethod: "KBZPay",
    note: "Partial cashout to KPay",
    date: "2026-08-31"
  }, session);

  assert.ok(!withdrawRes.error);
  assert.equal(withdrawRes.remainingVaultBalance, 60000);
  assert.equal(withdrawRes.transaction.amount, 30000);
  assert.equal(withdrawRes.transaction.type, "withdraw");

  // 3. Attempting to withdraw 70,000 MMK (exceeding 60,000 MMK balance) should fail
  const overWithdrawRes = await withdrawBoosterVaultCash({
    discordId: testDiscordId,
    boosterName: testBoosterName,
    amount: 70000,
    paymentMethod: "KBZPay",
    note: "Overdraft attempt"
  }, session);

  assert.ok(overWithdrawRes.error);
  assert.match(overWithdrawRes.error, /exceeds current stored cash balance/);

  // Clean up test run
  await deleteBoosterRecord(testRun.id);
});
