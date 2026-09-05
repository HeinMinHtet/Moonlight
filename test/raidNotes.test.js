import test from "node:test";
import assert from "node:assert/strict";
import {
  insertRaidNote,
  getRaidNotesPayload,
  getRaidNoteById,
  updateRaidNote,
  deleteRaidNote
} from "../lib/db.js";

test("insertRaidNote, updateRaidNote, item toggle, and deleteRaidNote work correctly", async () => {
  const dummySession = { discordId: "123456", username: "AdminUser" };

  // 1. Create note
  const created = await insertRaidNote({
    title: "Heroic 8/8 10 am",
    raidDate: "2026-09-05",
    raidTime: "10:00 AM",
    color: "blue",
    pinned: true,
    items: [
      { text: "Veliandina-tichondrius", completed: false },
      { text: "Squatchlace-Tichondrius", completed: false }
    ]
  }, dummySession);

  assert.ok(created.id);
  assert.equal(created.title, "Heroic 8/8 10 am");
  assert.equal(created.raidDate, "2026-09-05");
  assert.equal(created.raidTime, "10:00 AM");
  assert.equal(created.color, "blue");
  assert.equal(created.pinned, true);
  assert.equal(created.items.length, 2);
  assert.equal(created.items[0].text, "Veliandina-tichondrius");
  assert.equal(created.items[0].completed, false);
  assert.equal(created.createdByName, "AdminUser");

  // 2. Fetch by ID
  const fetched = await getRaidNoteById(created.id);
  assert.ok(fetched);
  assert.equal(fetched.title, "Heroic 8/8 10 am");

  // 3. Update note (toggle item completed + change title)
  const updatedItems = [
    { ...fetched.items[0], completed: true },
    fetched.items[1],
    { text: "silverdaddy-illidan", completed: false }
  ];

  const updated = await updateRaidNote(created.id, {
    title: "Heroic 8/8 10:00 AM (Updated)",
    items: updatedItems
  });

  assert.equal(updated.title, "Heroic 8/8 10:00 AM (Updated)");
  assert.equal(updated.items.length, 3);
  assert.equal(updated.items[0].completed, true);
  assert.equal(updated.items[2].text, "silverdaddy-illidan");

  // 4. Verify in payload list
  const payload = await getRaidNotesPayload();
  const found = payload.notes.find((n) => n.id === created.id);
  assert.ok(found);
  assert.equal(found.title, "Heroic 8/8 10:00 AM (Updated)");

  // 5. Delete note
  const deleted = await deleteRaidNote(created.id);
  assert.equal(deleted, true);

  const afterDelete = await getRaidNoteById(created.id);
  assert.equal(afterDelete, null);
});
