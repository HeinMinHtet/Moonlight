import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateSupplierNetBalance,
  validateWithdrawalPayload,
  reconcileWithdrawalSettlement
} from "../src/utils/supplierWithdrawals.js";

test("calculateSupplierNetBalance accurately computes active, settled, and net balance", () => {
  const withdrawals = [
    { id: "w1", amount: 100, settled: false },
    { id: "w2", amount: 250, settled: false },
    { id: "w3", amount: 500, settled: true },
    { id: "w4", amount: 0, settled: false }
  ];

  // Case 1: Positive net balance
  const res1 = calculateSupplierNetBalance(1000, withdrawals);
  assert.equal(res1.verifiedSalesTotal, 1000);
  assert.equal(res1.activeWithdrawalsTotal, 350);
  assert.equal(res1.settledWithdrawalsTotal, 500);
  assert.equal(res1.activeWithdrawalsCount, 2);
  assert.equal(res1.netBalance, 650);
  assert.equal(res1.isDeficit, false);

  // Case 2: Exact zero balance
  const res2 = calculateSupplierNetBalance(350, withdrawals);
  assert.equal(res2.netBalance, 0);
  assert.equal(res2.isDeficit, false);

  // Case 3: Deficit (negative balance supported)
  const res3 = calculateSupplierNetBalance(200, withdrawals);
  assert.equal(res3.netBalance, -150);
  assert.equal(res3.isDeficit, true);

  // Case 4: Zero sales with active withdrawals
  const res4 = calculateSupplierNetBalance(0, withdrawals);
  assert.equal(res4.netBalance, -350);
  assert.equal(res4.isDeficit, true);

  // Case 5: Empty withdrawals
  const res5 = calculateSupplierNetBalance(500, []);
  assert.equal(res5.activeWithdrawalsTotal, 0);
  assert.equal(res5.netBalance, 500);
  assert.equal(res5.isDeficit, false);
});

test("validateWithdrawalPayload validates required fields and types", () => {
  // Valid payload
  const valid = validateWithdrawalPayload({
    charName: "MainBanker",
    guild: "Main Guild",
    amount: 1500,
    date: "2026-08-27",
    note: "Gold restock"
  });
  assert.equal(valid.charName, "MainBanker");
  assert.equal(valid.guild, "Main Guild");
  assert.equal(valid.amount, 1500);
  assert.equal(valid.date, "2026-08-27");
  assert.equal(valid.note, "Gold restock");

  // Rejects empty charName
  assert.throws(() => {
    validateWithdrawalPayload({ charName: "", guild: "Main Guild", amount: 100, date: "2026-08-27" });
  }, /Character name is required/);

  // Rejects empty guild
  assert.throws(() => {
    validateWithdrawalPayload({ charName: "Banker", guild: "   ", amount: 100, date: "2026-08-27" });
  }, /Guild is required/);

  // Rejects zero or negative amount
  assert.throws(() => {
    validateWithdrawalPayload({ charName: "Banker", guild: "Main Guild", amount: 0, date: "2026-08-27" });
  }, /Withdrawal amount must be a positive number/);

  assert.throws(() => {
    validateWithdrawalPayload({ charName: "Banker", guild: "Main Guild", amount: -50, date: "2026-08-27" });
  }, /Withdrawal amount must be a positive number/);

  // Rejects invalid date format
  assert.throws(() => {
    validateWithdrawalPayload({ charName: "Banker", guild: "Main Guild", amount: 100, date: "27-08-2026" });
  }, /Date must be in YYYY-MM-DD format/);
});

test("reconcileWithdrawalSettlement handles full, partial, and deficit settlement in chronological order", () => {
  // Case 1: Full offset of all withdrawals
  const active1 = [
    { id: "w1", date: "2026-08-20", amount: 100, note: "First" },
    { id: "w2", date: "2026-08-21", amount: 200, note: "Second" }
  ];
  const res1 = reconcileWithdrawalSettlement(500, active1);
  assert.equal(res1.totalOffset, 300);
  assert.equal(res1.remainingSales, 200);
  assert.equal(res1.remainingDebt, 0);
  assert.equal(res1.settledWithdrawals.length, 2);
  assert.equal(res1.partiallySettledWithdrawal, null);
  assert.equal(res1.unsettledWithdrawals.length, 0);

  // Case 2: Partial offset
  // 250 sales vs w1 (100) + w2 (200) -> w1 fully settled (100), w2 partially offset by 150 (remaining 50)
  const res2 = reconcileWithdrawalSettlement(250, active1);
  assert.equal(res2.totalOffset, 250);
  assert.equal(res2.remainingSales, 0);
  assert.equal(res2.remainingDebt, 50);
  assert.equal(res2.settledWithdrawals.length, 1);
  assert.equal(res2.settledWithdrawals[0].id, "w1");
  assert.ok(res2.partiallySettledWithdrawal);
  assert.equal(res2.partiallySettledWithdrawal.id, "w2");
  assert.equal(res2.partiallySettledWithdrawal.offsetAmount, 150);
  assert.equal(res2.partiallySettledWithdrawal.remainingAmount, 50);
  assert.ok(res2.partiallySettledWithdrawal.note.includes("Partial offset applied"));

  // Case 3: Zero sales available
  const res3 = reconcileWithdrawalSettlement(0, active1);
  assert.equal(res3.totalOffset, 0);
  assert.equal(res3.remainingSales, 0);
  assert.equal(res3.remainingDebt, 300);
  assert.equal(res3.settledWithdrawals.length, 0);
  assert.equal(res3.partiallySettledWithdrawal, null);
  assert.equal(res3.unsettledWithdrawals.length, 2);
});

test("Database supplier guilds, armor types, and withdrawals CRUD methods", async () => {
  const {
    getSupplierGuildsList,
    updateSupplierGuilds,
    getArmorTypesList,
    updateArmorTypes,
    insertSupplierWithdrawal,
    getSupplierWithdrawalsPayload,
    getSupplierWithdrawalById,
    updateSupplierWithdrawal,
    deleteSupplierWithdrawal
  } = await import("../lib/db.js");

  // Armor Types
  const initialArmor = await getArmorTypesList();
  assert.ok(Array.isArray(initialArmor));
  assert.ok(initialArmor.length >= 1);

  const updatedArmor = await updateArmorTypes([
    { name: "Mail", active: true, isDefault: false },
    { name: "Plate", active: true, isDefault: true }
  ]);
  assert.equal(updatedArmor.length, 2);
  assert.equal(updatedArmor[1].name, "Plate");
  assert.equal(updatedArmor[1].isDefault, true);

  // Guilds
  const initialGuilds = await getSupplierGuildsList();
  assert.ok(Array.isArray(initialGuilds));
  assert.ok(initialGuilds.length >= 1);

  const updatedGuilds = await updateSupplierGuilds([
    { name: "Test Main Guild", active: true, isDefault: true },
    { name: "Test Alt Guild", active: true, isDefault: false }
  ]);
  assert.equal(updatedGuilds.length, 2);
  assert.equal(updatedGuilds[0].name, "Test Main Guild");
  assert.equal(updatedGuilds[0].isDefault, true);

  // Withdrawals CRUD
  const created = await insertSupplierWithdrawal({
    charName: "IntegrationBanker",
    guild: "Test Main Guild",
    amount: 1250,
    date: "2026-08-27",
    note: "Automated test withdrawal",
    createdByDiscordId: "admin-1",
    createdByName: "AdminUser"
  });
  assert.ok(created.id);
  assert.equal(created.charName, "IntegrationBanker");
  assert.equal(created.amount, 1250);
  assert.equal(created.settled, false);

  const fetched = await getSupplierWithdrawalById(created.id);
  assert.ok(fetched);
  assert.equal(fetched.charName, "IntegrationBanker");

  const updated = await updateSupplierWithdrawal(created.id, {
    amount: 1500,
    note: "Updated note"
  });
  assert.equal(updated.amount, 1500);
  assert.equal(updated.note, "Updated note");

  const payload = await getSupplierWithdrawalsPayload();
  assert.ok(Array.isArray(payload.withdrawals));
  assert.ok(payload.withdrawals.some((w) => w.id === created.id));

  await deleteSupplierWithdrawal(created.id);
  const afterDelete = await getSupplierWithdrawalById(created.id);
  assert.equal(afterDelete, null);
});

test("markSupplierRecordsPaid with settleWithdrawals true vs false", async () => {
  const {
    insertSupplierRecord,
    deleteSupplierRecord,
    insertSupplierWithdrawal,
    getSupplierWithdrawalById,
    deleteSupplierWithdrawal,
    markSupplierRecordsPaid,
    getSupplierRecordsPayload
  } = await import("../lib/db.js");

  const session = { discordId: "admin-1", username: "AdminUser" };

  // 1. Create a withdrawal
  const withdrawal = await insertSupplierWithdrawal({
    charName: "SettleTestBanker",
    guild: "Test Guild",
    amount: 500,
    date: "2026-08-28",
    note: "Settlement test"
  });

  // 2. Create first sales record
  const record1 = {
    id: "test-rec-settle-1",
    date: "2026-08-28",
    buyerName: "Buyer1",
    serviceType: "M+ 10",
    quantity: 2,
    armorType: "No stack",
    correct: true,
    paid: false,
    rateAtRecord: 300,
    totalCost: 600,
    createdAt: new Date().toISOString()
  };
  await insertSupplierRecord(record1);

  // Test: Mark paid WITHOUT settling withdrawals
  const markRes1 = await markSupplierRecordsPaid(new Set([record1.id]), session, { settleWithdrawals: false });
  assert.equal(markRes1.paidCount, 1);

  // Check withdrawal is still unsettled
  const wAfterFirstPay = await getSupplierWithdrawalById(withdrawal.id);
  assert.equal(wAfterFirstPay.settled, false);
  assert.equal(wAfterFirstPay.amount, 500);

  // 3. Create second sales record
  const record2 = {
    id: "test-rec-settle-2",
    date: "2026-08-28",
    buyerName: "Buyer2",
    serviceType: "M+ 10",
    quantity: 2,
    armorType: "No stack",
    correct: true,
    paid: false,
    rateAtRecord: 400,
    totalCost: 800,
    createdAt: new Date().toISOString()
  };
  await insertSupplierRecord(record2);

  // Test: Mark paid WITH settling withdrawals (default / settleWithdrawals: true)
  const markRes2 = await markSupplierRecordsPaid(new Set([record2.id]), session, { settleWithdrawals: true });
  assert.equal(markRes2.paidCount, 1);

  // Check withdrawal is now settled
  const wAfterSecondPay = await getSupplierWithdrawalById(withdrawal.id);
  assert.equal(wAfterSecondPay.settled, true);
  assert.equal(wAfterSecondPay.settlementBatchId, markRes2.paymentBatchId);

  // Cleanup
  await deleteSupplierRecord(record1.id);
  await deleteSupplierRecord(record2.id);
  await deleteSupplierWithdrawal(withdrawal.id);
});

