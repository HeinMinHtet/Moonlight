import test from "node:test";
import assert from "node:assert/strict";
import {
  insertRaidSchedule,
  getRaidSchedulesPayload,
  getRaidScheduleById,
  updateRaidSchedule,
  deleteRaidSchedule
} from "../lib/db.js";

test("insertRaidSchedule, updateRaidSchedule, buyer assignment, and deleteRaidSchedule work correctly", async () => {
  const dummySession = { discordId: "123456", username: "AdminUser" };

  // 1. Create schedule run
  const created = await insertRaidSchedule({
    date: "2026-09-08",
    timeEst: "20:00",
    raid: "Liberation of Undermine",
    difficulty: "Heroic",
    loot: "Unsaved",
    maxBuyers: 6,
    buyers: ["BuyerOne-Illidan", "BuyerTwo-Area52"],
    lead: "Hein / Team Alpha",
    note: "Bring armor stack mail"
  }, dummySession);

  assert.ok(created.id);
  assert.equal(created.date, "2026-09-08");
  assert.equal(created.timeEst, "20:00");
  assert.equal(created.raid, "Liberation of Undermine");
  assert.equal(created.difficulty, "Heroic");
  assert.equal(created.loot, "Unsaved");
  assert.equal(created.maxBuyers, 6);
  assert.equal(created.buyers.length, 2);
  assert.equal(created.buyers[0], "BuyerOne-Illidan");
  assert.equal(created.lead, "Hein / Team Alpha");
  assert.equal(created.createdByName, "AdminUser");

  // 2. Fetch by ID
  const fetched = await getRaidScheduleById(created.id);
  assert.ok(fetched);
  assert.equal(fetched.id, created.id);
  assert.equal(fetched.raid, "Liberation of Undermine");

  // 3. Update schedule (add buyer, change loot to Saved, edit maxBuyers)
  const updated = await updateRaidSchedule(created.id, {
    loot: "Saved",
    maxBuyers: 8,
    buyers: [...fetched.buyers, "BuyerThree-Tichondrius"]
  });

  assert.ok(updated);
  assert.equal(updated.loot, "Saved");
  assert.equal(updated.maxBuyers, 8);
  assert.equal(updated.buyers.length, 3);
  assert.equal(updated.buyers[2], "BuyerThree-Tichondrius");

  // 4. Verify in payload list
  const payload = await getRaidSchedulesPayload();
  const found = payload.schedules.find((s) => s.id === created.id);
  assert.ok(found);
  assert.equal(found.loot, "Saved");
  assert.equal(found.maxBuyers, 8);

  // 5. Delete schedule
  const deleted = await deleteRaidSchedule(created.id);
  assert.equal(deleted, true);

  const afterDelete = await getRaidScheduleById(created.id);
  assert.equal(afterDelete, null);
});

test("insertRaidSchedule validates and sanitizes difficulty, loot, and maxBuyers bounds", async () => {
  // Invalid difficulty falls back to 'Heroic'
  // Invalid loot falls back to 'Unsaved'
  // maxBuyers clamped between 1 and 30
  const created = await insertRaidSchedule({
    date: "2026-09-09",
    timeEst: "22:00",
    raid: "Nerub-ar Palace",
    difficulty: "InvalidDifficulty",
    loot: "UnknownLoot",
    maxBuyers: -5
  });

  assert.equal(created.difficulty, "Heroic");
  assert.equal(created.loot, "Unsaved");
  assert.equal(created.maxBuyers, 1);

  await deleteRaidSchedule(created.id);
});
