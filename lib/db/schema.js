import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { runMigrations } from "../migrations.js";
import { dataDir, defaultDb, getDbPath, getPool, isPostgres } from "./core.js";

export async function initDb() {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS supplier_services (
          id SERIAL PRIMARY KEY,
          type VARCHAR(100) UNIQUE NOT NULL,
          price NUMERIC(12, 2) NOT NULL DEFAULT 0,
          active BOOLEAN NOT NULL DEFAULT true,
          is_default BOOLEAN NOT NULL DEFAULT false
        );

        CREATE TABLE IF NOT EXISTS booster_prices (
          id SERIAL PRIMARY KEY,
          level VARCHAR(50) UNIQUE NOT NULL,
          price NUMERIC(12, 2) NOT NULL DEFAULT 0,
          active BOOLEAN NOT NULL DEFAULT true,
          is_default BOOLEAN NOT NULL DEFAULT false
        );

        ALTER TABLE supplier_services ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE booster_prices ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

        CREATE TABLE IF NOT EXISTS armor_types (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) UNIQUE NOT NULL,
          active BOOLEAN NOT NULL DEFAULT true,
          is_default BOOLEAN NOT NULL DEFAULT false
        );

        ALTER TABLE armor_types ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
        ALTER TABLE armor_types ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

        CREATE TABLE IF NOT EXISTS supplier_records (
          id VARCHAR(64) PRIMARY KEY,
          date VARCHAR(10) NOT NULL,
          buyer_name VARCHAR(255) NOT NULL,
          service_type VARCHAR(100) NOT NULL,
          quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
          armor_type VARCHAR(50) NOT NULL DEFAULT 'No stack',
          correct BOOLEAN NOT NULL DEFAULT false,
          paid BOOLEAN NOT NULL DEFAULT false,
          note TEXT NOT NULL DEFAULT '',
          rate_at_record NUMERIC(12, 2) NOT NULL DEFAULT 0,
          total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
          created_by_discord_id VARCHAR(64),
          created_by_name VARCHAR(255),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          paid_at TIMESTAMPTZ,
          paid_by_discord_id VARCHAR(64),
          paid_by_name VARCHAR(255),
          payment_batch_id VARCHAR(128),
          last_payment_batch_id VARCHAR(128),
          reopened_at TIMESTAMPTZ,
          reopened_by_discord_id VARCHAR(64),
          reopened_by_name VARCHAR(255)
        );

        CREATE INDEX IF NOT EXISTS idx_supplier_paid ON supplier_records(paid, correct);
        CREATE INDEX IF NOT EXISTS idx_supplier_batch ON supplier_records(payment_batch_id);
        CREATE INDEX IF NOT EXISTS idx_supplier_date ON supplier_records(date);

        CREATE TABLE IF NOT EXISTS booster_records (
          id VARCHAR(64) PRIMARY KEY,
          discord_id VARCHAR(64) NOT NULL,
          booster_name VARCHAR(255) NOT NULL,
          level VARCHAR(50) NOT NULL,
          quantity INT NOT NULL DEFAULT 1,
          note TEXT NOT NULL DEFAULT '',
          paid BOOLEAN NOT NULL DEFAULT false,
          rate_at_record NUMERIC(12, 2) NOT NULL DEFAULT 0,
          total_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          paid_at TIMESTAMPTZ,
          paid_by_discord_id VARCHAR(64),
          paid_by_name VARCHAR(255),
          booster_payment_batch_id VARCHAR(128)
        );

        CREATE INDEX IF NOT EXISTS idx_booster_paid ON booster_records(paid);
        CREATE INDEX IF NOT EXISTS idx_booster_discord_id ON booster_records(discord_id);

        CREATE TABLE IF NOT EXISTS booster_adjustments (
          id VARCHAR(64) PRIMARY KEY,
          discord_id VARCHAR(64) NOT NULL,
          booster_name VARCHAR(255) NOT NULL,
          type VARCHAR(16) NOT NULL,
          amount NUMERIC(12, 2) NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          date VARCHAR(10) NOT NULL,
          settled BOOLEAN NOT NULL DEFAULT false,
          settled_at TIMESTAMPTZ,
          settlement_batch_id VARCHAR(128),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by_discord_id VARCHAR(64),
          created_by_name VARCHAR(255),
          updated_at TIMESTAMPTZ
        );

        ALTER TABLE booster_adjustments ADD COLUMN IF NOT EXISTS settled BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE booster_adjustments ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;
        ALTER TABLE booster_adjustments ADD COLUMN IF NOT EXISTS settlement_batch_id VARCHAR(128);
        ALTER TABLE booster_adjustments ADD COLUMN IF NOT EXISTS parent_adjustment_id VARCHAR(64);
        ALTER TABLE booster_adjustments ADD COLUMN IF NOT EXISTS original_amount NUMERIC(12, 2);

        CREATE INDEX IF NOT EXISTS idx_booster_adjustments_discord ON booster_adjustments(discord_id);
        CREATE INDEX IF NOT EXISTS idx_booster_adjustments_date ON booster_adjustments(date);
        CREATE INDEX IF NOT EXISTS idx_booster_adjustments_settled ON booster_adjustments(settled);

        CREATE TABLE IF NOT EXISTS supplier_guilds (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) UNIQUE NOT NULL,
          active BOOLEAN NOT NULL DEFAULT true,
          is_default BOOLEAN NOT NULL DEFAULT false
        );

        ALTER TABLE supplier_guilds ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

        CREATE TABLE IF NOT EXISTS raid_note_titles (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) UNIQUE NOT NULL,
          active BOOLEAN NOT NULL DEFAULT true,
          is_default BOOLEAN NOT NULL DEFAULT false
        );

        CREATE TABLE IF NOT EXISTS buyer_purchase_types (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) UNIQUE NOT NULL,
          active BOOLEAN NOT NULL DEFAULT true,
          is_default BOOLEAN NOT NULL DEFAULT false
        );

        CREATE TABLE IF NOT EXISTS supplier_withdrawals (
          id VARCHAR(64) PRIMARY KEY,
          date VARCHAR(10) NOT NULL,
          char_name VARCHAR(255) NOT NULL,
          guild VARCHAR(100) NOT NULL,
          amount NUMERIC(12, 2) NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          settled BOOLEAN NOT NULL DEFAULT false,
          settled_at TIMESTAMPTZ,
          settlement_batch_id VARCHAR(128),
          created_by_discord_id VARCHAR(64),
          created_by_name VARCHAR(255),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ
        );

        ALTER TABLE supplier_withdrawals ADD COLUMN IF NOT EXISTS parent_withdrawal_id VARCHAR(64);
        ALTER TABLE supplier_withdrawals ADD COLUMN IF NOT EXISTS original_amount NUMERIC(12, 2);

        CREATE INDEX IF NOT EXISTS idx_supplier_withdrawals_settled ON supplier_withdrawals(settled);
        CREATE INDEX IF NOT EXISTS idx_supplier_withdrawals_date ON supplier_withdrawals(date);

        CREATE TABLE IF NOT EXISTS booster_cash_vault (
          id VARCHAR(64) PRIMARY KEY,
          discord_id VARCHAR(64) NOT NULL,
          booster_name VARCHAR(255) NOT NULL,
          type VARCHAR(16) NOT NULL,
          amount NUMERIC(14, 2) NOT NULL,
          gold_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
          rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
          date VARCHAR(10) NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          payment_method VARCHAR(64) NOT NULL DEFAULT '',
          settlement_batch_id VARCHAR(128),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by_discord_id VARCHAR(64),
          created_by_name VARCHAR(255)
        );

        CREATE INDEX IF NOT EXISTS idx_booster_vault_discord ON booster_cash_vault(discord_id);
        CREATE INDEX IF NOT EXISTS idx_booster_vault_date ON booster_cash_vault(date);

        CREATE TABLE IF NOT EXISTS external_expenses (
          id VARCHAR(64) PRIMARY KEY,
          date VARCHAR(10) NOT NULL,
          category VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          amount NUMERIC(14, 2) NOT NULL,
          recipient VARCHAR(255) NOT NULL DEFAULT '',
          note TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by_discord_id VARCHAR(64),
          created_by_name VARCHAR(255),
          updated_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS raid_notes (
          id VARCHAR(64) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          raid_date VARCHAR(10) NOT NULL,
          raid_time VARCHAR(50) NOT NULL DEFAULT '',
          color VARCHAR(30) NOT NULL DEFAULT 'default',
          pinned BOOLEAN NOT NULL DEFAULT false,
          archived BOOLEAN NOT NULL DEFAULT false,
          items JSONB NOT NULL DEFAULT '[]',
          created_by_discord_id VARCHAR(64),
          created_by_name VARCHAR(255),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS idx_raid_notes_date ON raid_notes(raid_date);
        CREATE INDEX IF NOT EXISTS idx_raid_notes_pinned ON raid_notes(pinned);
        CREATE INDEX IF NOT EXISTS idx_raid_notes_archived ON raid_notes(archived);

        CREATE TABLE IF NOT EXISTS sessions (
          id VARCHAR(64) PRIMARY KEY,
          role VARCHAR(32) NOT NULL,
          discord_id VARCHAR(64) NOT NULL,
          username VARCHAR(255) NOT NULL,
          csrf_token VARCHAR(64) NOT NULL,
          created_at BIGINT NOT NULL,
          expires_at BIGINT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
      `);

      // Seed supplier services if empty
      const servicesCount = await client.query("SELECT COUNT(*) FROM supplier_services");
      if (Number(servicesCount.rows[0].count) === 0) {
        for (const service of defaultDb.supplierServices) {
          await client.query(
            "INSERT INTO supplier_services (type, price, active) VALUES ($1, $2, $3) ON CONFLICT (type) DO NOTHING",
            [service.type, service.price, service.active]
          );
        }
      }

      // Seed booster prices if empty
      const boosterPricesCount = await client.query("SELECT COUNT(*) FROM booster_prices");
      if (Number(boosterPricesCount.rows[0].count) === 0) {
        for (const price of defaultDb.boosterPrices) {
          await client.query(
            "INSERT INTO booster_prices (level, price, active) VALUES ($1, $2, $3) ON CONFLICT (level) DO NOTHING",
            [price.level, price.price, price.active]
          );
        }
      }

      // Seed armor types if empty
      const armorTypesCount = await client.query("SELECT COUNT(*) FROM armor_types");
      if (Number(armorTypesCount.rows[0].count) === 0) {
        for (const armor of defaultDb.armorTypes) {
          await client.query(
            "INSERT INTO armor_types (name, active, is_default) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING",
            [armor.name, armor.active, Boolean(armor.isDefault)]
          );
        }
      }

      // Seed supplier guilds if empty
      const guildsCount = await client.query("SELECT COUNT(*) FROM supplier_guilds");
      if (Number(guildsCount.rows[0].count) === 0) {
        for (const guild of defaultDb.supplierGuilds) {
          await client.query(
            "INSERT INTO supplier_guilds (name, active, is_default) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING",
            [guild.name, guild.active, Boolean(guild.isDefault)]
          );
        }
      }

      // Seed raid note titles if empty
      const raidTitlesCount = await client.query("SELECT COUNT(*) FROM raid_note_titles");
      if (Number(raidTitlesCount.rows[0].count) === 0) {
        for (const title of defaultDb.raidNoteTitles) {
          await client.query(
            "INSERT INTO raid_note_titles (name, active, is_default) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING",
            [title.name, title.active, Boolean(title.isDefault)]
          );
        }
      }

      // Versioned, additive migrations on top of the baseline schema above.
      await runMigrations(client);

      console.log("PostgreSQL database initialized and verified.");
    } finally {
      client.release();
    }
  } else {
    // File-based fallback
    const targetDbPath = getDbPath();
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
    if (!existsSync(targetDbPath)) writeFileSync(targetDbPath, JSON.stringify(defaultDb, null, 2));
    console.log(`Using local JSON file storage (${targetDbPath}).`);
  }
}
