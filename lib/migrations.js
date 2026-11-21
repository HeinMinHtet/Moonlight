// Versioned, additive Postgres migrations.
//
// initDb() still runs the original idempotent CREATE TABLE / ALTER TABLE block first
// (that is the "baseline" every existing Railway database already has). Then the
// migrations below run in order, each exactly once, recorded in schema_migrations.
//
// Rules for adding a migration:
//   - Append to MIGRATIONS with a new, sortable id. Never edit or reorder an applied one.
//   - Additive only: new tables, new columns with defaults, new indexes/constraints.
//   - Never make a constraint that existing rows could violate without checking first
//     (see addCheckIfClean), so a deploy can never be blocked by an old row.
//   - Each migration runs inside its own transaction, under an advisory lock, so two
//     instances starting at the same time cannot apply the same migration twice.

const MIGRATION_LOCK_KEY = 72_727_001;

function legacySupplierBatchId(paidAt, id) {
  // Must produce exactly the id mapSupplierRecordFromRow() in lib/db.js has been showing
  // for paid rows without a stored batch id (it stringifies the raw pg paid_at value),
  // so existing batch groupings in the UI stay identical after the backfill.
  return `legacy_${Buffer.from(String(paidAt || id)).toString("base64url")}`;
}

function batchKindFor(id) {
  if (String(id).startsWith("spb_")) return "supplier";
  if (String(id).startsWith("bpb_")) return "booster";
  return "legacy";
}

async function constraintExists(client, name) {
  const res = await client.query("SELECT 1 FROM pg_constraint WHERE conname = $1", [name]);
  return res.rowCount > 0;
}

// Adds a CHECK constraint only when no existing row violates it; otherwise logs and skips,
// so old data can never stop the app from starting or block edits to old rows.
async function addCheckIfClean(client, table, name, condition, log) {
  if (await constraintExists(client, name)) return "exists";
  const violations = await client.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE NOT (${condition})`);
  const count = violations.rows[0].n;
  if (count > 0) {
    log(`[MIGRATION] Skipped ${name}: ${count} existing ${table} row(s) do not satisfy (${condition}).`);
    return "skipped";
  }
  await client.query(`ALTER TABLE ${table} ADD CONSTRAINT ${name} CHECK (${condition})`);
  return "added";
}

export const MIGRATIONS = [
  {
    id: "20261121_01_payment_batches_and_users",
    async up(client) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS payment_batches (
          id VARCHAR(128) PRIMARY KEY,
          kind VARCHAR(16) NOT NULL DEFAULT 'legacy',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by_discord_id VARCHAR(64),
          created_by_name VARCHAR(255),
          CONSTRAINT chk_payment_batches_kind CHECK (kind IN ('supplier', 'booster', 'legacy'))
        );

        CREATE TABLE IF NOT EXISTS users (
          discord_id VARCHAR(64) PRIMARY KEY,
          display_name VARCHAR(255) NOT NULL,
          role VARCHAR(32),
          first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_login_at TIMESTAMPTZ
        );
      `);

      // Paid sales rows from before batch ids existed: store the same "legacy_..." id the
      // app already shows for them, so the value is real data instead of computed on read.
      const legacyRows = await client.query(
        "SELECT id, paid_at FROM supplier_records WHERE paid = true AND (payment_batch_id IS NULL OR payment_batch_id = '')"
      );
      for (const row of legacyRows.rows) {
        await client.query("UPDATE supplier_records SET payment_batch_id = $1 WHERE id = $2", [
          legacySupplierBatchId(row.paid_at, row.id),
          row.id
        ]);
      }

      // Every batch id referenced anywhere becomes a payment_batches row.
      const referenced = await client.query(`
        SELECT batch_id, MIN(at) AS created_at FROM (
          SELECT payment_batch_id AS batch_id, paid_at AS at FROM supplier_records WHERE payment_batch_id IS NOT NULL
          UNION ALL SELECT last_payment_batch_id, reopened_at FROM supplier_records WHERE last_payment_batch_id IS NOT NULL
          UNION ALL SELECT booster_payment_batch_id, paid_at FROM booster_records WHERE booster_payment_batch_id IS NOT NULL
          UNION ALL SELECT settlement_batch_id, settled_at FROM booster_adjustments WHERE settlement_batch_id IS NOT NULL
          UNION ALL SELECT settlement_batch_id, settled_at FROM supplier_withdrawals WHERE settlement_batch_id IS NOT NULL
          UNION ALL SELECT settlement_batch_id, created_at FROM booster_cash_vault WHERE settlement_batch_id IS NOT NULL
        ) refs
        WHERE batch_id <> ''
        GROUP BY batch_id
      `);
      for (const row of referenced.rows) {
        await client.query(
          "INSERT INTO payment_batches (id, kind, created_at) VALUES ($1, $2, COALESCE($3, NOW())) ON CONFLICT (id) DO NOTHING",
          [row.batch_id, batchKindFor(row.batch_id), row.created_at]
        );
      }

      // Booster directory from existing rows (real Discord ids only; "outsourced..." ids are not users).
      await client.query(`
        INSERT INTO users (discord_id, display_name, first_seen_at)
        SELECT DISTINCT ON (discord_id) discord_id, booster_name, first_seen
        FROM (
          SELECT discord_id, booster_name, created_at AS first_seen FROM booster_records
          UNION ALL SELECT discord_id, booster_name, created_at FROM booster_adjustments
          UNION ALL SELECT discord_id, booster_name, created_at FROM booster_cash_vault
        ) people
        WHERE discord_id ~ '^[0-9]+$' AND COALESCE(booster_name, '') <> ''
        ORDER BY discord_id, first_seen DESC
        ON CONFLICT (discord_id) DO NOTHING
      `);
      await client.query(`
        INSERT INTO users (discord_id, display_name, role, last_login_at)
        SELECT DISTINCT ON (discord_id) discord_id, username, role, to_timestamp(created_at / 1000.0)
        FROM sessions
        WHERE discord_id ~ '^[0-9]+$'
        ORDER BY discord_id, created_at DESC
        ON CONFLICT (discord_id) DO UPDATE SET role = EXCLUDED.role, last_login_at = EXCLUDED.last_login_at
      `);
    }
  },
  {
    id: "20261121_02_payment_batch_foreign_keys",
    async up(client, log) {
      const links = [
        ["supplier_records", "payment_batch_id", "fk_supplier_records_payment_batch"],
        ["booster_records", "booster_payment_batch_id", "fk_booster_records_payment_batch"]
      ];
      for (const [table, column, name] of links) {
        if (await constraintExists(client, name)) continue;
        // NOT VALID first (instant, enforces new writes), then validate old rows if they are clean.
        await client.query(
          `ALTER TABLE ${table} ADD CONSTRAINT ${name} FOREIGN KEY (${column}) REFERENCES payment_batches(id) NOT VALID`
        );
        const orphans = await client.query(
          `SELECT COUNT(*)::int AS n FROM ${table} t WHERE t.${column} IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM payment_batches b WHERE b.id = t.${column})`
        );
        if (orphans.rows[0].n === 0) {
          await client.query(`ALTER TABLE ${table} VALIDATE CONSTRAINT ${name}`);
        } else {
          log(`[MIGRATION] ${name} left NOT VALID: ${orphans.rows[0].n} old row(s) reference unknown batches.`);
        }
      }
    }
  },
  {
    id: "20261121_03_check_constraints",
    async up(client, log) {
      const isoDate = "~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'";
      const checks = [
        ["supplier_records", "chk_supplier_records_quantity", "quantity > 0"],
        ["supplier_records", "chk_supplier_records_rate", "rate_at_record >= 0"],
        ["supplier_records", "chk_supplier_records_date", `date ${isoDate}`],
        ["booster_records", "chk_booster_records_quantity", "quantity > 0"],
        ["booster_records", "chk_booster_records_rate", "rate_at_record >= 0"],
        ["booster_adjustments", "chk_booster_adjustments_type", "type IN ('add', 'deduct')"],
        ["booster_adjustments", "chk_booster_adjustments_amount", "amount >= 0"],
        ["booster_adjustments", "chk_booster_adjustments_date", `date ${isoDate}`],
        ["booster_cash_vault", "chk_booster_cash_vault_type", "type IN ('deposit', 'withdraw', 'direct_payout')"],
        ["booster_cash_vault", "chk_booster_cash_vault_amount", "amount >= 0"],
        ["booster_cash_vault", "chk_booster_cash_vault_date", `date ${isoDate}`],
        ["supplier_withdrawals", "chk_supplier_withdrawals_amount", "amount >= 0"],
        ["supplier_withdrawals", "chk_supplier_withdrawals_date", `date ${isoDate}`],
        ["external_expenses", "chk_external_expenses_amount", "amount >= 0"],
        ["external_expenses", "chk_external_expenses_date", `date ${isoDate}`],
        ["raid_notes", "chk_raid_notes_date", `raid_date ${isoDate}`]
      ];
      for (const [table, name, condition] of checks) {
        await addCheckIfClean(client, table, name, condition, log);
      }
    }
  },
  {
    id: "20261121_04_partial_indexes",
    async up(client) {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_supplier_records_unpaid ON supplier_records (created_at DESC) WHERE paid = false;
        CREATE INDEX IF NOT EXISTS idx_supplier_records_paid_at ON supplier_records (paid_at DESC) WHERE paid = true;
        CREATE INDEX IF NOT EXISTS idx_booster_records_unpaid_by_booster ON booster_records (discord_id) WHERE paid = false;
        CREATE INDEX IF NOT EXISTS idx_booster_adjustments_open_by_booster ON booster_adjustments (discord_id) WHERE settled = false;
        CREATE INDEX IF NOT EXISTS idx_supplier_withdrawals_open ON supplier_withdrawals (date, created_at) WHERE settled = false;
        CREATE INDEX IF NOT EXISTS idx_booster_records_batch ON booster_records (booster_payment_batch_id);
      `);
    }
  }
];

export async function runMigrations(client, { log = console.log } = {}) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(128) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const applied = [];
  for (const migration of MIGRATIONS) {
    await client.query("BEGIN");
    try {
      await client.query("SELECT pg_advisory_xact_lock($1)", [MIGRATION_LOCK_KEY]);
      const done = await client.query("SELECT 1 FROM schema_migrations WHERE id = $1", [migration.id]);
      if (!done.rowCount) {
        await migration.up(client, log);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [migration.id]);
        applied.push(migration.id);
        log(`[MIGRATION] Applied ${migration.id}`);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      error.message = `Migration ${migration.id} failed: ${error.message}`;
      throw error;
    }
  }
  return applied;
}
