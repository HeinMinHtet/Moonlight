import test from "node:test";
import assert from "node:assert/strict";
import {
  externalExpensesSummary,
  insertExternalExpense,
  getExternalExpenseById,
  updateExternalExpense,
  deleteExternalExpense,
  getExternalExpensesPayload
} from "../lib/db.js";

test("externalExpensesSummary calculates total, raid, outsource, and other totals correctly", () => {
  const expenses = [
    { category: "Raid payment", amount: 950 },
    { category: "M+ outsource payment", amount: 130 },
    { category: "M+ outsource payment", amount: 70 },
    { category: "Other", amount: 50 }
  ];

  const summary = externalExpensesSummary(expenses);
  assert.equal(summary.totalAmount, 1200);
  assert.equal(summary.totalCount, 4);
  assert.equal(summary.raidPaymentTotal, 950);
  assert.equal(summary.outsourcePaymentTotal, 200);
  assert.equal(summary.otherTotal, 50);
});

test("insertExternalExpense, updateExternalExpense, and deleteExternalExpense work correctly", async () => {
  const dummySession = { discordId: "123456", username: "AdminUser" };
  const created = await insertExternalExpense({
    date: "2026-08-15",
    category: "Raid payment",
    title: "Mythic Raid Split",
    amount: 1400,
    recipient: "RaidLeader",
    note: "Paid in gold"
  }, dummySession);

  assert.ok(created.id);
  assert.equal(created.category, "Raid payment");
  assert.equal(created.amount, 1400);
  assert.equal(created.recipient, "RaidLeader");
  assert.equal(created.createdByName, "AdminUser");

  const fetched = await getExternalExpenseById(created.id);
  assert.ok(fetched);
  assert.equal(fetched.title, "Mythic Raid Split");

  const updated = await updateExternalExpense(created.id, {
    amount: 1500,
    note: "Updated note"
  });
  assert.equal(updated.amount, 1500);
  assert.equal(updated.note, "Updated note");

  const payload = await getExternalExpensesPayload();
  const existsInPayload = payload.expenses.some((e) => e.id === created.id);
  assert.equal(existsInPayload, true);

  const deleted = await deleteExternalExpense(created.id);
  assert.equal(deleted, true);

  const afterDelete = await getExternalExpenseById(created.id);
  assert.equal(afterDelete, null);
});
