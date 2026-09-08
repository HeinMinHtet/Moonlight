import test from "node:test";
import assert from "node:assert/strict";

test("PostgreSQL Engine Integration", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("Skipping PostgreSQL integration test: DATABASE_URL is not set");
    return;
  }

  const { initDb, isPostgres, getPool } = await import("../lib/db.js");

  await t.test("Postgres is correctly detected", () => {
    assert.equal(isPostgres(), true);
  });

  await t.test("Initializes schema with debt-tracking columns", async () => {
    await initDb();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const colRes = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'supplier_withdrawals'
        AND column_name IN ('parent_withdrawal_id', 'original_amount');
      `);
      const cols = colRes.rows.map((r) => r.column_name);
      assert.ok(cols.includes("parent_withdrawal_id"), "supplier_withdrawals must have parent_withdrawal_id");
      assert.ok(cols.includes("original_amount"), "supplier_withdrawals must have original_amount");
    } finally {
      client.release();
    }
  });
});
