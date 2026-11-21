import test from "node:test";
import assert from "node:assert/strict";

// Runs only against a throwaway Postgres: TEST_DATABASE_URL=postgres://... npm test
// It drops and recreates the migration-owned tables, so never point it at real data.
test("Postgres migrations are additive, idempotent and keep legacy data working", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("Skipping migration test: set TEST_DATABASE_URL to a throwaway Postgres database");
    return;
  }

  const db = await import("../lib/db.js");
  const { MIGRATIONS } = await import("../lib/migrations.js");
  const pool = db.getPool();
  t.after(() => pool.end());

  await db.initDb();

  // Simulate a production database from before the migrations existed.
  await pool.query(`
    DELETE FROM schema_migrations;
    ALTER TABLE supplier_records DROP CONSTRAINT IF EXISTS fk_supplier_records_payment_batch;
    ALTER TABLE booster_records DROP CONSTRAINT IF EXISTS fk_booster_records_payment_batch;
    DROP TABLE IF EXISTS payment_batches;
    DROP TABLE IF EXISTS users;
  `);
  const checks = await pool.query("SELECT conrelid::regclass::text AS tbl, conname FROM pg_constraint WHERE conname LIKE 'chk_%' AND conname <> 'chk_payment_batches_kind'");
  for (const row of checks.rows) await pool.query(`ALTER TABLE ${row.tbl} DROP CONSTRAINT ${row.conname}`);

  const paidAt = new Date("2025-03-04T05:06:07.000Z");
  await pool.query(`
    INSERT INTO supplier_records (id, date, buyer_name, service_type, quantity, armor_type, correct, paid, rate_at_record, total_cost, paid_at, payment_batch_id)
    VALUES ('mig-legacy-paid', '2025-03-04', 'Legacy', 'm6', 1, 'No stack', true, true, 100, 100, $1, NULL),
           ('mig-bad-qty', '2025-03-05', 'ZeroQty', 'm6', 0, 'No stack', false, false, 100, 0, NULL, NULL)
    ON CONFLICT (id) DO UPDATE SET payment_batch_id = NULL, paid = EXCLUDED.paid, quantity = EXCLUDED.quantity, paid_at = EXCLUDED.paid_at
  `, [paidAt]);
  await pool.query(`
    INSERT INTO booster_records (id, discord_id, booster_name, level, quantity, paid, rate_at_record, total_balance, booster_payment_batch_id, paid_at)
    VALUES ('mig-booster', '123456789012345678', 'BoosterOne', 'm10', 2, true, 95, 190, 'bpb_oldbatch', NOW())
    ON CONFLICT (id) DO NOTHING
  `);

  // What the old code showed for the legacy row, before the migration.
  const before = (await db.getSupplierRecordsPayload()).paidRecords.find((r) => r.id === "mig-legacy-paid");
  assert.match(before.paymentBatchId, /^legacy_/);

  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(" "));
  try {
    await db.initDb();
    await db.initDb(); // second run must be a no-op
  } finally {
    console.log = originalLog;
  }

  const applied = await pool.query("SELECT id FROM schema_migrations ORDER BY id");
  assert.deepEqual(applied.rows.map((r) => r.id), MIGRATIONS.map((m) => m.id));
  assert.equal(logs.filter((line) => line.startsWith("[MIGRATION] Applied")).length, MIGRATIONS.length, "each migration applied exactly once");

  // The legacy batch id is now stored, and it is the same id the UI already showed.
  const after = (await db.getSupplierRecordsPayload()).paidRecords.find((r) => r.id === "mig-legacy-paid");
  assert.equal(after.paymentBatchId, before.paymentBatchId);
  const stored = await pool.query("SELECT payment_batch_id FROM supplier_records WHERE id = 'mig-legacy-paid'");
  assert.equal(stored.rows[0].payment_batch_id, before.paymentBatchId);

  // ...which makes reopening that legacy batch work.
  const reopened = await db.reopenSupplierPaymentBatch(before.paymentBatchId, { discordId: "admin", username: "Admin" });
  assert.equal(reopened.reopenedCount, 1);

  // Batches and users were backfilled; foreign keys are validated.
  const batch = await pool.query("SELECT kind FROM payment_batches WHERE id = 'bpb_oldbatch'");
  assert.equal(batch.rows[0].kind, "booster");
  const user = await pool.query("SELECT display_name FROM users WHERE discord_id = '123456789012345678'");
  assert.equal(user.rows[0].display_name, "BoosterOne");
  const fks = await pool.query("SELECT conname, convalidated FROM pg_constraint WHERE conname LIKE 'fk_%_payment_batch' ORDER BY conname");
  assert.deepEqual(fks.rows.map((r) => [r.conname, r.convalidated]), [
    ["fk_booster_records_payment_batch", true],
    ["fk_supplier_records_payment_batch", true]
  ]);

  // A check that an old row violates is skipped (logged), never forced.
  assert.ok(logs.some((line) => line.includes("Skipped chk_supplier_records_quantity")));
  const qtyCheck = await pool.query("SELECT 1 FROM pg_constraint WHERE conname = 'chk_supplier_records_quantity'");
  assert.equal(qtyCheck.rowCount, 0);
  // ...so that old row can still be edited.
  const edited = await db.updateSupplierRecord("mig-bad-qty", { note: "still editable" });
  assert.equal(edited.note, "still editable");
  // Clean checks were added and are enforced for new writes.
  await assert.rejects(
    () => pool.query("INSERT INTO booster_adjustments (id, discord_id, booster_name, type, amount, date) VALUES ('mig-bad-adj', '1', 'x', 'bogus', 1, '2026-01-01')"),
    /chk_booster_adjustments_type/
  );

  // Paying a row through the normal PATCH path still works with the foreign key in place.
  const marked = await db.updateBoosterRecord("mig-booster", { paid: true, boosterPaymentBatchId: "bpb_brand_new_single_row" });
  assert.equal(marked.boosterPaymentBatchId, "bpb_brand_new_single_row");
  const newBatch = await pool.query("SELECT kind FROM payment_batches WHERE id = 'bpb_brand_new_single_row'");
  assert.equal(newBatch.rows[0].kind, "booster");

  // Users directory on login.
  await db.recordUserLogin({ discordId: "123456789012345678", username: "Renamed", role: "booster" });
  const renamed = await pool.query("SELECT display_name, role FROM users WHERE discord_id = '123456789012345678'");
  assert.deepEqual(renamed.rows[0], { display_name: "Renamed", role: "booster" });

  await pool.query("DELETE FROM supplier_records WHERE id IN ('mig-legacy-paid', 'mig-bad-qty')");
  await pool.query("DELETE FROM booster_records WHERE id = 'mig-booster'");
});
