import test from "node:test";
import assert from "node:assert/strict";
import {
  initDb,
  insertSupplierRecord,
  updateSupplierRecord,
  deleteSupplierRecord,
  getArmorTypesList
} from "../lib/db.js";

test("Supplier sales records creation and editing with armor types", async () => {
  await initDb();
  const armorTypes = await getArmorTypesList();
  assert.ok(Array.isArray(armorTypes));
  assert.ok(armorTypes.length >= 1);
  assert.ok(typeof armorTypes[0] === "object" && "name" in armorTypes[0]);

  const defaultArmor = armorTypes.find((a) => a.isDefault)?.name || armorTypes[0]?.name || "No stack";
  const chosenArmor = armorTypes.find((a) => a.name !== defaultArmor)?.name || defaultArmor;

  const newRecord = {
    id: "test-rec-1",
    date: "2026-08-28",
    buyerName: "TestBuyer",
    serviceType: "M+ 10",
    quantity: 2,
    armorType: defaultArmor,
    correct: false,
    paid: false,
    note: "Initial test note",
    rateAtRecord: 500,
    totalCost: 1000,
    createdByDiscordId: "admin-1",
    createdByName: "AdminUser",
    createdAt: new Date().toISOString()
  };

  await insertSupplierRecord(newRecord);

  // Edit / Patch record with changed armor stack
  const updated = await updateSupplierRecord(newRecord.id, {
    buyerName: "UpdatedBuyer",
    armorType: chosenArmor,
    quantity: 3,
    note: "Updated note"
  });

  assert.ok(updated);
  assert.equal(updated.buyerName, "UpdatedBuyer");
  assert.equal(updated.armorType, chosenArmor);
  assert.equal(updated.quantity, 3);
  assert.equal(updated.totalCost, 1500);

  // Validate armor stack check logic
  const armorExists = armorTypes.some((armor) => (typeof armor === "object" ? armor.name : armor) === chosenArmor);
  assert.equal(armorExists, true);

  const invalidArmor = "NonExistentArmorStack";
  const invalidArmorExists = armorTypes.some((armor) => (typeof armor === "object" ? armor.name : armor) === invalidArmor);
  assert.equal(invalidArmorExists, false);

  // Cleanup
  await deleteSupplierRecord(newRecord.id);
});
