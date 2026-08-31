import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { buildProfitReport } from "./profitReport.js";

const { Pool } = pg;

const root = resolve(".");
const dataDir = join(root, "data");
const dbPath = join(dataDir, "database.json");

export const defaultDb = {
  supplierServices: [
    { type: "m6", price: 110, active: true },
    { type: "m10", price: 140, active: true },
    { type: "m12", price: 190, active: true },
    { type: "Raid unsaved", price: 950, active: true },
    { type: "m10 pug", price: 40, active: true },
    { type: "13 pug", price: 60, active: true },
    { type: "MOQ unsaved", price: 900, active: true },
    { type: "Gold", price: 1000, active: true },
    { type: "3 raids unsaved", price: 1400, active: true },
    { type: "16 resil", price: 3000, active: true }
  ],
  boosterPrices: [
    { level: "m6", price: 70, active: true },
    { level: "m10", price: 95, active: true },
    { level: "m12", price: 130, active: true },
    { level: "m14", price: 170, active: true },
    { level: "m16", price: 220, active: true }
  ],
  armorTypes: [
    { name: "Mail", active: true, isDefault: false },
    { name: "Cloth", active: true, isDefault: false },
    { name: "Leather", active: true, isDefault: false },
    { name: "Plate", active: true, isDefault: false },
    { name: "No stack", active: true, isDefault: true }
  ],
  supplierGuilds: [
    { name: "Main Guild", active: true, isDefault: true },
    { name: "Alt Guild", active: true, isDefault: false }
  ],
  supplierRecords: [],
  supplierWithdrawals: [],
  boosterRecords: [],
  boosterAdjustments: [],
  boosterCashVault: []
};

let pool = null;

export function isPostgres() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool() {
  if (!isPostgres()) return null;
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
    pool = new Pool({
      connectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
    pool.on("error", (err) => {
      console.error("Unexpected PostgreSQL error on idle client", err);
    });
  }
  return pool;
}

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

      console.log("PostgreSQL database initialized and verified.");
    } finally {
      client.release();
    }
  } else {
    // File-based fallback
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
    if (!existsSync(dbPath)) writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2));
    console.log("Using local JSON file storage (data/database.json).");
  }
}

// -------------------------------------------------------------
// Pure Helpers
// -------------------------------------------------------------

export function lineTotal(rate, quantity) {
  return Number(quantity || 0) * Number(rate || 0);
}

export function paymentBatchIdFor(record) {
  if (record.paymentBatchId) return String(record.paymentBatchId);
  const legacyKey = String(record.paidAt || record.id || "unknown");
  return `legacy_${Buffer.from(legacyKey).toString("base64url")}`;
}

export function supplierSummary(records) {
  const rowsByServiceAndRate = new Map();
  for (const record of records) {
    if (!record.correct || record.paid) continue;
    const type = record.serviceType || "Unknown service";
    const rateAtRecord = Number(record.rateAtRecord || 0);
    const key = `${type}\u0000${rateAtRecord}`;
    const existing = rowsByServiceAndRate.get(key) || {
      type,
      price: rateAtRecord,
      totalQty: 0,
      totalCost: 0
    };
    existing.totalQty += Number(record.quantity || 0);
    existing.totalCost += Number(record.totalCost || lineTotal(rateAtRecord, record.quantity));
    rowsByServiceAndRate.set(key, existing);
  }

  return [...rowsByServiceAndRate.values()]
    .filter((row) => Number(row.totalQty || 0) > 0)
    .sort((a, b) => a.type.localeCompare(b.type) || Number(a.price || 0) - Number(b.price || 0));
}

export function boosterSummary(records) {
  const rowsByBooster = new Map();
  for (const record of records) {
    if (record.paid) continue;
    const key = record.discordId || record.boosterName || "unknown";
    const existing = rowsByBooster.get(key) || {
      discordId: record.discordId,
      boosterName: record.boosterName || "Unknown booster",
      openCount: 0,
      openTotal: 0
    };
    existing.openCount += 1;
    existing.openTotal += Number(record.totalBalance || 0);
    rowsByBooster.set(key, existing);
  }
  return [...rowsByBooster.values()].sort((a, b) => b.openTotal - a.openTotal);
}

function mapSupplierRecordFromRow(row) {
  const quantity = Number(row.quantity || 0);
  const rateAtRecord = Number(row.rate_at_record || 0);
  return {
    id: row.id,
    date: row.date,
    buyerName: row.buyer_name,
    serviceType: row.service_type,
    quantity,
    armorType: row.armor_type,
    correct: Boolean(row.correct),
    paid: Boolean(row.paid),
    note: row.note || "",
    rateAtRecord,
    totalCost: lineTotal(rateAtRecord, quantity),
    createdByDiscordId: row.created_by_discord_id,
    createdByName: row.created_by_name,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : null,
    paidByDiscordId: row.paid_by_discord_id,
    paidByName: row.paid_by_name,
    paymentBatchId: row.paid ? (row.payment_batch_id || `legacy_${Buffer.from(String(row.paid_at || row.id)).toString("base64url")}`) : null,
    lastPaymentBatchId: row.last_payment_batch_id || null,
    reopenedAt: row.reopened_at ? new Date(row.reopened_at).toISOString() : null,
    reopenedByDiscordId: row.reopened_by_discord_id || null,
    reopenedByName: row.reopened_by_name || null
  };
}

function mapBoosterRecordFromRow(row) {
  const quantity = Number(row.quantity || 0);
  const rateAtRecord = Number(row.rate_at_record || 0);
  return {
    id: row.id,
    discordId: row.discord_id,
    boosterName: row.booster_name,
    level: row.level,
    quantity,
    note: row.note || "",
    paid: Boolean(row.paid),
    rateAtRecord,
    totalBalance: lineTotal(rateAtRecord, quantity),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : null,
    paidByDiscordId: row.paid_by_discord_id || null,
    paidByName: row.paid_by_name || null,
    boosterPaymentBatchId: row.booster_payment_batch_id || null
  };
}

function mapSupplierWithdrawalFromRow(row) {
  return {
    id: row.id,
    date: row.date,
    charName: row.char_name,
    guild: row.guild,
    amount: Number(row.amount || 0),
    note: row.note || "",
    settled: Boolean(row.settled),
    settledAt: row.settled_at ? new Date(row.settled_at).toISOString() : null,
    settlementBatchId: row.settlement_batch_id || null,
    createdByDiscordId: row.created_by_discord_id || null,
    createdByName: row.created_by_name || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
  };
}

// -------------------------------------------------------------
// File-based Storage Engine (Fallback for local dev / tests)
// -------------------------------------------------------------

function readFileDb() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  if (!existsSync(dbPath)) writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2));
  let raw = {};
  try {
    const fileContent = readFileSync(dbPath, "utf8");
    if (fileContent && fileContent.trim()) {
      raw = JSON.parse(fileContent);
    }
  } catch {
    raw = {};
  }
  return {
    ...defaultDb,
    ...raw,
    supplierServices: Array.isArray(raw.supplierServices) ? raw.supplierServices : defaultDb.supplierServices,
    boosterPrices: Array.isArray(raw.boosterPrices) ? raw.boosterPrices : defaultDb.boosterPrices,
    armorTypes: Array.isArray(raw.armorTypes) ? raw.armorTypes : defaultDb.armorTypes,
    supplierGuilds: Array.isArray(raw.supplierGuilds) ? raw.supplierGuilds : defaultDb.supplierGuilds,
    supplierRecords: Array.isArray(raw.supplierRecords) ? raw.supplierRecords : [],
    supplierWithdrawals: Array.isArray(raw.supplierWithdrawals) ? raw.supplierWithdrawals : [],
    boosterRecords: Array.isArray(raw.boosterRecords) ? raw.boosterRecords : [],
    boosterAdjustments: Array.isArray(raw.boosterAdjustments) ? raw.boosterAdjustments : [],
    boosterCashVault: Array.isArray(raw.boosterCashVault) ? raw.boosterCashVault : []
  };
}

function normalizeArmorType(entry) {
  if (typeof entry === "string") {
    return { name: entry, active: true, isDefault: entry === "No stack" };
  }
  return {
    name: String(entry?.name || "").trim(),
    active: entry?.active !== false,
    isDefault: Boolean(entry?.isDefault)
  };
}

function writeFileDb(db) {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");
}

// -------------------------------------------------------------
// Unified Database Access Layer (Postgres + File Fallback)
// -------------------------------------------------------------

export async function getConfig(session, permissions) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const [servicesRes, boosterRes, armorRes, guildsRes] = await Promise.all([
        client.query("SELECT type, price, active, is_default FROM supplier_services ORDER BY id ASC"),
        client.query("SELECT level, price, active, is_default FROM booster_prices ORDER BY id ASC"),
        client.query("SELECT name, active, is_default FROM armor_types ORDER BY id ASC"),
        client.query("SELECT name, active, is_default FROM supplier_guilds ORDER BY id ASC")
      ]);

      const supplierServices = servicesRes.rows.map((row) => ({
        type: row.type,
        price: Number(row.price),
        active: Boolean(row.active),
        isDefault: Boolean(row.is_default)
      }));

      const boosterPrices = boosterRes.rows.map((row) => ({
        level: row.level,
        price: Number(row.price),
        active: Boolean(row.active),
        isDefault: Boolean(row.is_default)
      }));

      const armorTypes = armorRes.rows.map((row) => ({
        name: row.name,
        active: Boolean(row.active),
        isDefault: Boolean(row.is_default)
      }));

      const supplierGuilds = guildsRes.rows.map((row) => ({
        name: row.name,
        active: Boolean(row.active),
        isDefault: Boolean(row.is_default)
      }));

      return {
        supplierServices: permissions.supplierRecords ? supplierServices : [],
        boosterPrices: permissions.priceSettings
          ? boosterPrices
          : boosterPrices.filter((row) => row.active !== false).map(({ level, isDefault }) => ({ level, price: 0, active: true, isDefault: Boolean(isDefault) })),
        armorTypes,
        supplierGuilds: permissions.supplierRecords || permissions.priceSettings ? supplierGuilds : []
      };
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    return {
      supplierServices: permissions.supplierRecords
        ? (db.supplierServices || []).map((row) => ({ ...row, isDefault: Boolean(row.isDefault) }))
        : [],
      boosterPrices: permissions.priceSettings
        ? (db.boosterPrices || []).map((row) => ({ ...row, isDefault: Boolean(row.isDefault) }))
        : (db.boosterPrices || []).filter((row) => row.active !== false).map(({ level, isDefault }) => ({ level, price: 0, active: true, isDefault: Boolean(isDefault) })),
      armorTypes: (db.armorTypes || []).map(normalizeArmorType),
      supplierGuilds: permissions.supplierRecords || permissions.priceSettings
        ? (db.supplierGuilds || []).map((row) => ({ ...row, isDefault: Boolean(row.isDefault) }))
        : []
    };
  }
}

export async function getSupplierRate(serviceType) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("SELECT price FROM supplier_services WHERE type = $1", [serviceType]);
      return res.rows[0] ? Number(res.rows[0].price) : 0;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    const service = db.supplierServices.find((item) => item.type === serviceType);
    return Number(service?.price || 0);
  }
}

export async function getBoosterRate(level) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("SELECT price FROM booster_prices WHERE level = $1", [level]);
      return res.rows[0] ? Number(res.rows[0].price) : 0;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    const price = db.boosterPrices.find((item) => item.level === level);
    return Number(price?.price || 0);
  }
}

export async function getSupplierServicesList() {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("SELECT type, price, active, is_default FROM supplier_services ORDER BY id ASC");
      return res.rows.map((row) => ({ type: row.type, price: Number(row.price), active: Boolean(row.active), isDefault: Boolean(row.is_default) }));
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    return (db.supplierServices || []).map((row) => ({ ...row, isDefault: Boolean(row.isDefault) }));
  }
}

export async function getBoosterPricesList() {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("SELECT level, price, active, is_default FROM booster_prices ORDER BY id ASC");
      return res.rows.map((row) => ({ level: row.level, price: Number(row.price), active: Boolean(row.active), isDefault: Boolean(row.is_default) }));
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    return (db.boosterPrices || []).map((row) => ({ ...row, isDefault: Boolean(row.isDefault) }));
  }
}

export async function getArmorTypesList() {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("SELECT name, active, is_default FROM armor_types ORDER BY id ASC");
      return res.rows.map((row) => ({ name: row.name, active: Boolean(row.active), isDefault: Boolean(row.is_default) }));
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    return (db.armorTypes || []).map(normalizeArmorType);
  }
}

export async function updateArmorTypes(cleanedRows) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM armor_types");
      for (const row of cleanedRows) {
        await client.query(
          "INSERT INTO armor_types (name, active, is_default) VALUES ($1, $2, $3)",
          [row.name, row.active, Boolean(row.isDefault)]
        );
      }
      await client.query("COMMIT");
      return cleanedRows;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    db.armorTypes = cleanedRows;
    writeFileDb(db);
    return db.armorTypes;
  }
}

export async function getSupplierRecordsPayload() {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const [recordsRes, withdrawalsRes] = await Promise.all([
        client.query("SELECT * FROM supplier_records ORDER BY created_at DESC"),
        client.query("SELECT * FROM supplier_withdrawals ORDER BY date DESC, created_at DESC")
      ]);
      const allRecords = recordsRes.rows.map(mapSupplierRecordFromRow);
      const records = allRecords.filter((record) => !record.paid);
      const paidRecords = allRecords
        .filter((record) => record.paid)
        .sort((a, b) => String(b.paidAt || "").localeCompare(String(a.paidAt || "")));
      const withdrawals = withdrawalsRes.rows.map(mapSupplierWithdrawalFromRow);
      return { records, paidRecords, summary: supplierSummary(allRecords), withdrawals };
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    const records = (db.supplierRecords || []).filter((record) => !record.paid);
    const paidRecords = (db.supplierRecords || [])
      .filter((record) => record.paid)
      .sort((a, b) => String(b.paidAt || "").localeCompare(String(a.paidAt || "")));
    const withdrawals = (db.supplierWithdrawals || [])
      .slice()
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return { records, paidRecords, summary: supplierSummary(db.supplierRecords || []), withdrawals };
  }
}

export async function getSupplierGuildsList() {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("SELECT name, active, is_default FROM supplier_guilds ORDER BY id ASC");
      return res.rows.map((row) => ({ name: row.name, active: Boolean(row.active), isDefault: Boolean(row.is_default) }));
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    return (db.supplierGuilds || []).map((row) => ({ ...row, isDefault: Boolean(row.isDefault) }));
  }
}

export async function updateSupplierGuilds(cleanedRows) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM supplier_guilds");
      for (const row of cleanedRows) {
        await client.query(
          "INSERT INTO supplier_guilds (name, active, is_default) VALUES ($1, $2, $3)",
          [row.name, row.active, Boolean(row.isDefault)]
        );
      }
      await client.query("COMMIT");
      return cleanedRows;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    db.supplierGuilds = cleanedRows;
    writeFileDb(db);
    return db.supplierGuilds;
  }
}

export async function getSupplierWithdrawalsPayload() {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("SELECT * FROM supplier_withdrawals ORDER BY date DESC, created_at DESC");
      const withdrawals = res.rows.map(mapSupplierWithdrawalFromRow);
      return { withdrawals };
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    const withdrawals = (db.supplierWithdrawals || [])
      .slice()
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return { withdrawals };
  }
}

export async function insertSupplierWithdrawal(withdrawal) {
  const record = {
    id: withdrawal.id || `sw_${randomBytes(10).toString("base64url")}`,
    date: withdrawal.date || new Date().toISOString().slice(0, 10),
    charName: withdrawal.charName,
    guild: withdrawal.guild,
    amount: Number(withdrawal.amount || 0),
    note: withdrawal.note || "",
    settled: Boolean(withdrawal.settled),
    settledAt: withdrawal.settledAt || null,
    settlementBatchId: withdrawal.settlementBatchId || null,
    createdByDiscordId: withdrawal.createdByDiscordId || null,
    createdByName: withdrawal.createdByName || null,
    createdAt: withdrawal.createdAt || new Date().toISOString()
  };

  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query(`
        INSERT INTO supplier_withdrawals (
          id, date, char_name, guild, amount, note, settled, settled_at,
          settlement_batch_id, created_by_discord_id, created_by_name, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        record.id, record.date, record.charName, record.guild,
        record.amount, record.note, record.settled,
        record.settledAt, record.settlementBatchId,
        record.createdByDiscordId, record.createdByName,
        record.createdAt
      ]);
      return record;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    if (!db.supplierWithdrawals) db.supplierWithdrawals = [];
    db.supplierWithdrawals.unshift(record);
    writeFileDb(db);
    return record;
  }
}

export async function getSupplierWithdrawalById(id) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("SELECT * FROM supplier_withdrawals WHERE id = $1", [id]);
      return res.rows.length ? mapSupplierWithdrawalFromRow(res.rows[0]) : null;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    return (db.supplierWithdrawals || []).find((item) => item.id === id) || null;
  }
}

export async function updateSupplierWithdrawal(id, fields) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const current = await getSupplierWithdrawalById(id);
      if (!current) return null;
      const updated = { ...current, ...fields, updatedAt: new Date().toISOString() };

      await client.query(`
        UPDATE supplier_withdrawals SET
          date = $1, char_name = $2, guild = $3, amount = $4, note = $5,
          settled = $6, settled_at = $7, settlement_batch_id = $8, updated_at = $9
        WHERE id = $10
      `, [
        updated.date, updated.charName, updated.guild, updated.amount, updated.note || "",
        Boolean(updated.settled), updated.settledAt || null, updated.settlementBatchId || null,
        updated.updatedAt, id
      ]);

      return updated;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    if (!db.supplierWithdrawals) db.supplierWithdrawals = [];
    const item = db.supplierWithdrawals.find((w) => w.id === id);
    if (!item) return null;
    Object.assign(item, fields, { updatedAt: new Date().toISOString() });
    writeFileDb(db);
    return item;
  }
}

export async function deleteSupplierWithdrawal(id) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("DELETE FROM supplier_withdrawals WHERE id = $1 RETURNING *", [id]);
      return res.rows.length ? mapSupplierWithdrawalFromRow(res.rows[0]) : null;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    if (!db.supplierWithdrawals) return null;
    const index = db.supplierWithdrawals.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const [item] = db.supplierWithdrawals.splice(index, 1);
    writeFileDb(db);
    return item;
  }
}

export async function insertSupplierRecord(record) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query(`
        INSERT INTO supplier_records (
          id, date, buyer_name, service_type, quantity, armor_type, correct, paid, note,
          rate_at_record, total_cost, created_by_discord_id, created_by_name, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        record.id, record.date, record.buyerName, record.serviceType, record.quantity,
        record.armorType, record.correct, record.paid, record.note, record.rateAtRecord,
        record.totalCost, record.createdByDiscordId, record.createdByName, record.createdAt
      ]);
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    db.supplierRecords.unshift(record);
    writeFileDb(db);
  }
}

export async function updateSupplierRecord(id, fields) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const currentRes = await client.query("SELECT * FROM supplier_records WHERE id = $1", [id]);
      if (!currentRes.rows.length) return null;
      const current = mapSupplierRecordFromRow(currentRes.rows[0]);

      const updated = { ...current, ...fields };
      const totalCost = lineTotal(updated.rateAtRecord, updated.quantity);

      await client.query(`
        UPDATE supplier_records SET
          date = $1, buyer_name = $2, service_type = $3, quantity = $4, armor_type = $5,
          correct = $6, paid = $7, note = $8, rate_at_record = $9, total_cost = $10,
          paid_at = $11, paid_by_discord_id = $12, paid_by_name = $13, payment_batch_id = $14
        WHERE id = $15
      `, [
        updated.date, updated.buyerName, updated.serviceType, updated.quantity, updated.armorType,
        updated.correct, updated.paid, updated.note, updated.rateAtRecord, totalCost,
        updated.paidAt, updated.paidByDiscordId, updated.paidByName, updated.paymentBatchId,
        id
      ]);

      return { ...updated, totalCost };
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    const record = db.supplierRecords.find((item) => item.id === id);
    if (!record) return null;
    Object.assign(record, fields);
    record.totalCost = lineTotal(record.rateAtRecord, record.quantity);
    writeFileDb(db);
    return record;
  }
}

export async function deleteSupplierRecord(id) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("DELETE FROM supplier_records WHERE id = $1 RETURNING *", [id]);
      return res.rows.length ? mapSupplierRecordFromRow(res.rows[0]) : null;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    const index = db.supplierRecords.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const [record] = db.supplierRecords.splice(index, 1);
    writeFileDb(db);
    return record;
  }
}

export async function verifyAllSupplierRecords(selectedIds) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      let query = "SELECT id FROM supplier_records WHERE paid = false AND correct = false";
      let params = [];
      if (selectedIds && selectedIds.size > 0) {
        query += " AND id = ANY($1::varchar[])";
        params.push([...selectedIds]);
      }
      const res = await client.query(query, params);
      const rowsToVerify = res.rows;
      if (!rowsToVerify.length) {
        await client.query("ROLLBACK");
        return { verifiedCount: 0 };
      }
      const idsToVerify = rowsToVerify.map((r) => r.id);
      await client.query(`
        UPDATE supplier_records SET correct = true
        WHERE id = ANY($1::varchar[])
      `, [idsToVerify]);
      await client.query("COMMIT");
      return { verifiedCount: idsToVerify.length };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    const recordsToVerify = db.supplierRecords.filter((record) => {
      if (record.paid || record.correct) return false;
      return selectedIds ? selectedIds.has(record.id) : true;
    });
    if (!recordsToVerify.length) {
      return { verifiedCount: 0 };
    }
    for (const record of recordsToVerify) {
      record.correct = true;
    }
    writeFileDb(db);
    return { verifiedCount: recordsToVerify.length };
  }
}

export async function unverifyAllSupplierRecords(selectedIds) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      let query = "SELECT id FROM supplier_records WHERE paid = false AND correct = true";
      let params = [];
      if (selectedIds && selectedIds.size > 0) {
        query += " AND id = ANY($1::varchar[])";
        params.push([...selectedIds]);
      }
      const res = await client.query(query, params);
      const rowsToUnverify = res.rows;
      if (!rowsToUnverify.length) {
        await client.query("ROLLBACK");
        return { unverifiedCount: 0 };
      }
      const idsToUnverify = rowsToUnverify.map((r) => r.id);
      await client.query(`
        UPDATE supplier_records SET correct = false
        WHERE id = ANY($1::varchar[])
      `, [idsToUnverify]);
      await client.query("COMMIT");
      return { unverifiedCount: idsToUnverify.length };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    const recordsToUnverify = db.supplierRecords.filter((record) => {
      if (record.paid || !record.correct) return false;
      return selectedIds ? selectedIds.has(record.id) : true;
    });
    if (!recordsToUnverify.length) {
      return { unverifiedCount: 0 };
    }
    for (const record of recordsToUnverify) {
      record.correct = false;
    }
    writeFileDb(db);
    return { unverifiedCount: recordsToUnverify.length };
  }
}

export async function markSupplierRecordsPaid(selectedIds, session, options = {}) {
  const settleWithdrawals = options.settleWithdrawals !== false;
  const paidAt = new Date().toISOString();
  const paymentBatchId = `spb_${(Math.random() + 1).toString(36).substring(2)}${Date.now().toString(36)}`;

  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      let query = "SELECT * FROM supplier_records WHERE correct = true AND paid = false";
      let params = [];
      if (selectedIds && selectedIds.size > 0) {
        query += " AND id = ANY($1::varchar[])";
        params.push([...selectedIds]);
      }
      const payableRes = await client.query(query, params);
      const payableRows = payableRes.rows;

      if (selectedIds && payableRows.length !== selectedIds.size) {
        await client.query("ROLLBACK");
        return { error: "Some selected sales records are no longer verified and unpaid. Refresh, then try again." };
      }
      if (!payableRows.length) {
        await client.query("ROLLBACK");
        return { error: "There are no verified unpaid sales records to mark paid." };
      }

      const idsToPay = payableRows.map((r) => r.id);
      await client.query(`
        UPDATE supplier_records SET
          paid = true, paid_at = $1, paid_by_discord_id = $2, paid_by_name = $3, payment_batch_id = $4
        WHERE id = ANY($5::varchar[])
      `, [paidAt, session.discordId, session.username, paymentBatchId, idsToPay]);

      if (settleWithdrawals) {
        // Reconcile active (unsettled) supplier withdrawals against the paid sales total
        const salesTotal = payableRows.reduce((sum, r) => sum + Number(r.total_cost || lineTotal(r.rate_at_record, r.quantity)), 0);
        const activeWithdrawalsRes = await client.query(
          "SELECT * FROM supplier_withdrawals WHERE settled = false ORDER BY date ASC, created_at ASC"
        );
        let remainingOffset = salesTotal;
        for (const w of activeWithdrawalsRes.rows) {
          if (remainingOffset <= 0) break;
          const amt = Number(w.amount || 0);
          if (amt <= remainingOffset) {
            remainingOffset -= amt;
            await client.query(
              "UPDATE supplier_withdrawals SET settled = true, settled_at = $1, settlement_batch_id = $2, updated_at = $1 WHERE id = $3",
              [paidAt, paymentBatchId, w.id]
            );
          } else {
            const newAmount = amt - remainingOffset;
            remainingOffset = 0;
            await client.query(
              "UPDATE supplier_withdrawals SET amount = $1, note = $2, updated_at = $3 WHERE id = $4",
              [newAmount, `${w.note || ""} (Partial offset applied)`.trim(), paidAt, w.id]
            );
          }
        }
      }

      await client.query("COMMIT");
      return { paidCount: idsToPay.length, paymentBatchId };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    const payableRecords = db.supplierRecords.filter((record) => {
      if (!record.correct || record.paid) return false;
      return selectedIds ? selectedIds.has(record.id) : true;
    });
    if (selectedIds && payableRecords.length !== selectedIds.size) {
      return { error: "Some selected sales records are no longer verified and unpaid. Refresh, then try again." };
    }
    if (!payableRecords.length) {
      return { error: "There are no verified unpaid sales records to mark paid." };
    }
    for (const record of payableRecords) {
      record.paid = true;
      record.paidAt = paidAt;
      record.paidByDiscordId = session.discordId;
      record.paidByName = session.username;
      record.paymentBatchId = paymentBatchId;
    }

    if (settleWithdrawals) {
      if (!db.supplierWithdrawals) db.supplierWithdrawals = [];
      const salesTotal = payableRecords.reduce((sum, r) => sum + Number(r.totalCost || lineTotal(r.rateAtRecord, r.quantity)), 0);
      let remainingOffset = salesTotal;
      const activeWithdrawals = db.supplierWithdrawals.filter((w) => !w.settled);
      for (const w of activeWithdrawals) {
        if (remainingOffset <= 0) break;
        const amt = Number(w.amount || 0);
        if (amt <= remainingOffset) {
          remainingOffset -= amt;
          w.settled = true;
          w.settledAt = paidAt;
          w.settlementBatchId = paymentBatchId;
          w.updatedAt = paidAt;
        } else {
          w.amount = amt - remainingOffset;
          w.note = `${w.note || ""} (Partial offset applied)`.trim();
          w.updatedAt = paidAt;
          remainingOffset = 0;
        }
      }
    }

    writeFileDb(db);
    return { paidCount: payableRecords.length, paymentBatchId };
  }
}

export async function reopenSupplierPaymentBatch(paymentBatchId, session) {
  const reopenedAt = new Date().toISOString();
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const res = await client.query(
        "SELECT id, payment_batch_id FROM supplier_records WHERE paid = true AND (payment_batch_id = $1 OR ($1 LIKE 'legacy_%' AND paid_at IS NOT NULL))",
        [paymentBatchId]
      );
      const rowsToReopen = res.rows.filter((row) => (row.payment_batch_id === paymentBatchId || paymentBatchIdFor(row) === paymentBatchId));
      if (!rowsToReopen.length) {
        await client.query("ROLLBACK");
        return { error: "Paid supplier batch not found. Refresh, then try again." };
      }
      const ids = rowsToReopen.map((r) => r.id);
      await client.query(`
        UPDATE supplier_records SET
          paid = false, last_payment_batch_id = $1, reopened_at = $2,
          reopened_by_discord_id = $3, reopened_by_name = $4,
          paid_at = null, paid_by_discord_id = null, paid_by_name = null, payment_batch_id = null
        WHERE id = ANY($5::varchar[])
      `, [paymentBatchId, reopenedAt, session.discordId, session.username, ids]);

      await client.query(`
        UPDATE supplier_withdrawals SET
          settled = false, settled_at = null, settlement_batch_id = null, updated_at = $1
        WHERE settlement_batch_id = $2
      `, [reopenedAt, paymentBatchId]);

      await client.query("COMMIT");
      return { reopenedCount: ids.length };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    const paidRecordsToReopen = db.supplierRecords.filter(
      (record) => record.paid && paymentBatchIdFor(record) === paymentBatchId
    );
    if (!paidRecordsToReopen.length) return { error: "Paid supplier batch not found. Refresh, then try again." };
    for (const record of paidRecordsToReopen) {
      record.paid = false;
      record.lastPaymentBatchId = paymentBatchIdFor(record);
      record.reopenedAt = reopenedAt;
      record.reopenedByDiscordId = session.discordId;
      record.reopenedByName = session.username;
      record.paidAt = null;
      record.paidByDiscordId = null;
      record.paidByName = null;
      record.paymentBatchId = null;
    }

    if (db.supplierWithdrawals) {
      for (const w of db.supplierWithdrawals) {
        if (w.settlementBatchId === paymentBatchId) {
          w.settled = false;
          w.settledAt = null;
          w.settlementBatchId = null;
          w.updatedAt = reopenedAt;
        }
      }
    }

    writeFileDb(db);
    return { reopenedCount: paidRecordsToReopen.length };
  }
}

export async function getBoosterRecordsPayload(session, canManageAdmin) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      let query = "SELECT * FROM booster_records";
      let params = [];
      if (!canManageAdmin) {
        query += " WHERE (discord_id = $1 OR (booster_name = $2 AND $2 != ''))";
        params.push(session.discordId || "", session.username || "");
      }
      query += " ORDER BY created_at DESC";
      const res = await client.query(query, params);
      const records = res.rows.map(mapBoosterRecordFromRow);
      return { records, summary: boosterSummary(records) };
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    const records = canManageAdmin
      ? db.boosterRecords
      : db.boosterRecords.filter((record) => (session.discordId && record.discordId === session.discordId) || (session.username && record.boosterName === session.username));
    return { records, summary: boosterSummary(records) };
  }
}

export async function insertBoosterRecord(record) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query(`
        INSERT INTO booster_records (
          id, discord_id, booster_name, level, quantity, note, paid, rate_at_record, total_balance, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        record.id, record.discordId, record.boosterName, record.level, record.quantity,
        record.note, record.paid, record.rateAtRecord, record.totalBalance, record.createdAt
      ]);
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    db.boosterRecords.unshift(record);
    writeFileDb(db);
  }
}

export async function getBoosterRecordById(id) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("SELECT * FROM booster_records WHERE id = $1", [id]);
      return res.rows.length ? mapBoosterRecordFromRow(res.rows[0]) : null;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    return db.boosterRecords.find((item) => item.id === id) || null;
  }
}

export async function updateBoosterRecord(id, fields) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const current = await getBoosterRecordById(id);
      if (!current) return null;
      const updated = { ...current, ...fields };
      const totalBalance = lineTotal(updated.rateAtRecord, updated.quantity);

      await client.query(`
        UPDATE booster_records SET
          booster_name = $1, discord_id = $2, level = $3, quantity = $4, note = $5,
          paid = $6, rate_at_record = $7, total_balance = $8,
          created_at = $9, paid_at = $10, paid_by_discord_id = $11, paid_by_name = $12, booster_payment_batch_id = $13
        WHERE id = $14
      `, [
        updated.boosterName, updated.discordId, updated.level, updated.quantity, updated.note,
        updated.paid, updated.rateAtRecord, totalBalance,
        updated.createdAt, updated.paidAt, updated.paidByDiscordId, updated.paidByName, updated.boosterPaymentBatchId,
        id
      ]);

      return { ...updated, totalBalance };
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    const record = db.boosterRecords.find((item) => item.id === id);
    if (!record) return null;
    Object.assign(record, fields);
    record.totalBalance = lineTotal(record.rateAtRecord, record.quantity);
    writeFileDb(db);
    return record;
  }
}

export async function deleteBoosterRecord(id) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("DELETE FROM booster_records WHERE id = $1 RETURNING *", [id]);
      return res.rows.length ? mapBoosterRecordFromRow(res.rows[0]) : null;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    const index = db.boosterRecords.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const [record] = db.boosterRecords.splice(index, 1);
    writeFileDb(db);
    return record;
  }
}

export async function markBoosterRecordsPaid(selectedIds, session) {
  const paidAt = new Date().toISOString();
  const boosterPaymentBatchId = `bpb_${(Math.random() + 1).toString(36).substring(2)}${Date.now().toString(36)}`;

  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const res = await client.query("SELECT * FROM booster_records WHERE paid = false AND id = ANY($1::varchar[])", [[...selectedIds]]);
      const payableRows = res.rows;
      if (payableRows.length !== selectedIds.size) {
        await client.query("ROLLBACK");
        return { error: "Some selected booster rows are already paid or no longer available. Refresh, then try again." };
      }

      await client.query(`
        UPDATE booster_records SET
          paid = true, paid_at = $1, paid_by_discord_id = $2, paid_by_name = $3, booster_payment_batch_id = $4
        WHERE id = ANY($5::varchar[])
      `, [paidAt, session.discordId, session.username, boosterPaymentBatchId, [...selectedIds]]);

      // Group paid amounts by booster discordId / boosterName
      const boosterTotals = new Map();
      for (const row of payableRows) {
        const key = row.discord_id || row.booster_name;
        boosterTotals.set(key, (boosterTotals.get(key) || 0) + Number(row.total_balance || 0));
      }

      // Reconcile active debit adjustments for each booster
      for (const [key, runAmount] of boosterTotals.entries()) {
        const adjRes = await client.query(
          "SELECT * FROM booster_adjustments WHERE (discord_id = $1 OR booster_name = $1) AND type = 'deduct' AND (settled IS NULL OR settled = false) ORDER BY date ASC, created_at ASC",
          [key]
        );
        let remainingOffset = runAmount;
        for (const adj of adjRes.rows) {
          if (remainingOffset <= 0) break;
          const amt = Number(adj.amount || 0);
          if (amt <= remainingOffset) {
            remainingOffset -= amt;
            await client.query(
              "UPDATE booster_adjustments SET settled = true, settled_at = $1, settlement_batch_id = $2 WHERE id = $3",
              [paidAt, boosterPaymentBatchId, adj.id]
            );
          } else {
            const newAmount = amt - remainingOffset;
            remainingOffset = 0;
            await client.query(
              "UPDATE booster_adjustments SET amount = $1, note = $2, updated_at = $3 WHERE id = $4",
              [newAmount, `${adj.note} (Partial offset applied)`.trim(), paidAt, adj.id]
            );
          }
        }
      }

      await client.query("COMMIT");
      return { paidCount: payableRows.length, boosterPaymentBatchId };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    if (!db.boosterRecords) db.boosterRecords = [];
    if (!db.boosterAdjustments) db.boosterAdjustments = [];

    const payableRecords = db.boosterRecords.filter((record) => !record.paid && selectedIds.has(record.id));
    if (payableRecords.length !== selectedIds.size) {
      return { error: "Some selected booster rows are already paid or no longer available. Refresh, then try again." };
    }
    for (const record of payableRecords) {
      record.paid = true;
      record.paidAt = paidAt;
      record.paidByDiscordId = session.discordId;
      record.paidByName = session.username;
      record.boosterPaymentBatchId = boosterPaymentBatchId;
    }

    // Group paid amounts by booster
    const boosterTotals = new Map();
    for (const record of payableRecords) {
      const key = record.discordId || record.boosterName;
      boosterTotals.set(key, (boosterTotals.get(key) || 0) + Number(record.totalBalance || 0));
    }

    // Reconcile active debit adjustments
    for (const [key, runAmount] of boosterTotals.entries()) {
      let remainingOffset = runAmount;
      const activeDebits = db.boosterAdjustments.filter(
        (adj) => (adj.discordId === key || adj.boosterName === key) && adj.type === "deduct" && !adj.settled
      );
      for (const adj of activeDebits) {
        if (remainingOffset <= 0) break;
        const amt = Number(adj.amount || 0);
        if (amt <= remainingOffset) {
          remainingOffset -= amt;
          adj.settled = true;
          adj.settledAt = paidAt;
          adj.settlementBatchId = boosterPaymentBatchId;
        } else {
          adj.amount = amt - remainingOffset;
          adj.note = `${adj.note} (Partial offset applied)`.trim();
          adj.updatedAt = paidAt;
          remainingOffset = 0;
        }
      }
    }

    writeFileDb(db);
    return { paidCount: payableRecords.length, boosterPaymentBatchId };
  }
}

export async function updateSupplierServices(cleanedRows) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM supplier_services");
      for (const row of cleanedRows) {
        await client.query(
          "INSERT INTO supplier_services (type, price, active, is_default) VALUES ($1, $2, $3, $4)",
          [row.type, row.price, row.active, Boolean(row.isDefault)]
        );
      }
      await client.query("COMMIT");
      return cleanedRows;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    db.supplierServices = cleanedRows;
    writeFileDb(db);
    return db.supplierServices;
  }
}

export async function updateBoosterPrices(cleanedRows) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM booster_prices");
      for (const row of cleanedRows) {
        await client.query(
          "INSERT INTO booster_prices (level, price, active, is_default) VALUES ($1, $2, $3, $4)",
          [row.level, row.price, row.active, Boolean(row.isDefault)]
        );
      }
      await client.query("COMMIT");
      return cleanedRows;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    db.boosterPrices = cleanedRows;
    writeFileDb(db);
    return db.boosterPrices;
  }
}

export async function getProfitReportData(from, to, groupBy) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const [supplierRes, boosterRes] = await Promise.all([
        client.query("SELECT * FROM supplier_records WHERE paid = true"),
        client.query("SELECT * FROM booster_records WHERE paid = true")
      ]);
      const db = {
        supplierRecords: supplierRes.rows.map(mapSupplierRecordFromRow),
        boosterRecords: boosterRes.rows.map(mapBoosterRecordFromRow)
      };
      return buildProfitReport(db, from, to, groupBy);
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    return buildProfitReport(db, from, to, groupBy);
  }
}

// -------------------------------------------------------------
// Persistent Sessions Layer
// -------------------------------------------------------------

export async function getSessionFromDb(sessionId) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("SELECT * FROM sessions WHERE id = $1", [sessionId]);
      if (!res.rows.length) return null;
      const row = res.rows[0];
      if (Date.now() > Number(row.expires_at || 0)) {
        await client.query("DELETE FROM sessions WHERE id = $1", [sessionId]);
        return null;
      }
      return {
        role: row.role,
        discordId: row.discord_id,
        username: row.username,
        csrfToken: row.csrf_token,
        createdAt: Number(row.created_at),
        expiresAt: Number(row.expires_at)
      };
    } finally {
      client.release();
    }
  }
  return null;
}

export async function saveSessionToDb(sessionId, session) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query(`
        INSERT INTO sessions (id, role, discord_id, username, csrf_token, created_at, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          role = EXCLUDED.role,
          discord_id = EXCLUDED.discord_id,
          username = EXCLUDED.username,
          csrf_token = EXCLUDED.csrf_token,
          expires_at = EXCLUDED.expires_at
      `, [
        sessionId, session.role, session.discordId, session.username,
        session.csrfToken, session.createdAt, session.expiresAt
      ]);
    } finally {
      client.release();
    }
  }
}

export async function deleteSessionFromDb(sessionId) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query("DELETE FROM sessions WHERE id = $1", [sessionId]);
    } finally {
      client.release();
    }
  }
}

export async function pruneExpiredSessions() {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query("DELETE FROM sessions WHERE expires_at < $1", [Date.now()]);
    } catch (err) {
      console.error("Session pruning failed:", err.message);
    } finally {
      client.release();
    }
  }
}

// -------------------------------------------------------------
// Booster Balance Adjustments Operations
// -------------------------------------------------------------

function mapBoosterAdjustmentFromRow(row) {
  return {
    id: row.id,
    discordId: row.discord_id,
    boosterName: row.booster_name,
    type: row.type,
    amount: Number(row.amount || 0),
    note: row.note || "",
    date: row.date,
    settled: Boolean(row.settled),
    settledAt: row.settled_at ? new Date(row.settled_at).toISOString() : null,
    settlementBatchId: row.settlement_batch_id || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    createdByDiscordId: row.created_by_discord_id,
    createdByName: row.created_by_name,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
  };
}

export async function getBoosterAdjustmentsPayload(session, canManageAdmin) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      let query = "SELECT * FROM booster_adjustments";
      let params = [];
      if (!canManageAdmin) {
        query += " WHERE (discord_id = $1 OR (booster_name = $2 AND $2 != ''))";
        params.push(session.discordId || "", session.username || "");
      }
      query += " ORDER BY date DESC, created_at DESC";
      const res = await client.query(query, params);
      const adjustments = res.rows.map(mapBoosterAdjustmentFromRow);
      return { adjustments };
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    const allAdjustments = db.boosterAdjustments || [];
    const adjustments = canManageAdmin
      ? allAdjustments
      : allAdjustments.filter((adj) => (session.discordId && adj.discordId === session.discordId) || (session.username && adj.boosterName === session.username));
    return { adjustments };
  }
}

export async function insertBoosterAdjustment(adjustment) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query(`
        INSERT INTO booster_adjustments (
          id, discord_id, booster_name, type, amount, note, date, settled, settled_at, settlement_batch_id, created_at, created_by_discord_id, created_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        adjustment.id, adjustment.discordId, adjustment.boosterName, adjustment.type,
        adjustment.amount, adjustment.note, adjustment.date, Boolean(adjustment.settled),
        adjustment.settledAt || null, adjustment.settlementBatchId || null,
        adjustment.createdAt, adjustment.createdByDiscordId, adjustment.createdByName
      ]);
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    if (!db.boosterAdjustments) db.boosterAdjustments = [];
    db.boosterAdjustments.unshift(adjustment);
    writeFileDb(db);
  }
}

export async function getBoosterAdjustmentById(id) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("SELECT * FROM booster_adjustments WHERE id = $1", [id]);
      return res.rows.length ? mapBoosterAdjustmentFromRow(res.rows[0]) : null;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    return (db.boosterAdjustments || []).find((item) => item.id === id) || null;
  }
}

export async function updateBoosterAdjustment(id, fields) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const current = await getBoosterAdjustmentById(id);
      if (!current) return null;
      const updated = { ...current, ...fields, updatedAt: new Date().toISOString() };

      await client.query(`
        UPDATE booster_adjustments SET
          booster_name = $1, discord_id = $2, type = $3, amount = $4, note = $5, date = $6,
          settled = $7, settled_at = $8, settlement_batch_id = $9, updated_at = $10
        WHERE id = $11
      `, [
        updated.boosterName, updated.discordId, updated.type, updated.amount, updated.note, updated.date,
        Boolean(updated.settled), updated.settledAt || null, updated.settlementBatchId || null, updated.updatedAt,
        id
      ]);

      return updated;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    if (!db.boosterAdjustments) db.boosterAdjustments = [];
    const item = db.boosterAdjustments.find((adj) => adj.id === id);
    if (!item) return null;
    Object.assign(item, fields, { updatedAt: new Date().toISOString() });
    writeFileDb(db);
    return item;
  }
}

export async function deleteBoosterAdjustment(id) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("DELETE FROM booster_adjustments WHERE id = $1 RETURNING *", [id]);
      return res.rows.length ? mapBoosterAdjustmentFromRow(res.rows[0]) : null;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    if (!db.boosterAdjustments) return null;
    const index = db.boosterAdjustments.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const [item] = db.boosterAdjustments.splice(index, 1);
    writeFileDb(db);
    return item;
  }
}

// -------------------------------------------------------------
// Booster Stored Cash Vault Operations (MMK)
// -------------------------------------------------------------

function mapBoosterVaultFromRow(row) {
  return {
    id: row.id,
    discordId: row.discord_id,
    boosterName: row.booster_name,
    type: row.type, // 'deposit' | 'withdraw'
    amount: Number(row.amount || 0),
    goldAmount: Number(row.gold_amount || 0),
    rate: Number(row.rate || 0),
    date: row.date,
    note: row.note || "",
    paymentMethod: row.payment_method || "",
    settlementBatchId: row.settlement_batch_id || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    createdByDiscordId: row.created_by_discord_id || null,
    createdByName: row.created_by_name || null
  };
}

export async function getBoosterCashVaultPayload(session, canManageAdmin) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      let query = "SELECT * FROM booster_cash_vault";
      let params = [];
      if (!canManageAdmin) {
        query += " WHERE (discord_id = $1 OR (booster_name = $2 AND $2 != ''))";
        params.push(session.discordId || "", session.username || "");
      }
      query += " ORDER BY date DESC, created_at DESC";
      const res = await client.query(query, params);
      const vaultTransactions = res.rows.map(mapBoosterVaultFromRow);
      return { vaultTransactions };
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    const all = db.boosterCashVault || [];
    const vaultTransactions = canManageAdmin
      ? all
      : all.filter((tx) => (session.discordId && tx.discordId === session.discordId) || (session.username && tx.boosterName === session.username));
    return { vaultTransactions };
  }
}

export async function insertBoosterVaultTransaction(tx) {
  const transaction = {
    id: tx.id || `bcv_${randomBytes(10).toString("base64url")}`,
    discordId: tx.discordId || "",
    boosterName: tx.boosterName || "",
    type: tx.type || "deposit",
    amount: Number(tx.amount || 0),
    goldAmount: Number(tx.goldAmount || 0),
    rate: Number(tx.rate || 0),
    date: tx.date || new Date().toISOString().slice(0, 10),
    note: tx.note || "",
    paymentMethod: tx.paymentMethod || "",
    settlementBatchId: tx.settlementBatchId || null,
    createdAt: tx.createdAt || new Date().toISOString(),
    createdByDiscordId: tx.createdByDiscordId || null,
    createdByName: tx.createdByName || null
  };

  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query(`
        INSERT INTO booster_cash_vault (
          id, discord_id, booster_name, type, amount, gold_amount, rate, date, note, payment_method,
          settlement_batch_id, created_at, created_by_discord_id, created_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        transaction.id, transaction.discordId, transaction.boosterName, transaction.type,
        transaction.amount, transaction.goldAmount, transaction.rate, transaction.date,
        transaction.note, transaction.paymentMethod, transaction.settlementBatchId,
        transaction.createdAt, transaction.createdByDiscordId, transaction.createdByName
      ]);
      return transaction;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    if (!db.boosterCashVault) db.boosterCashVault = [];
    db.boosterCashVault.unshift(transaction);
    writeFileDb(db);
    return transaction;
  }
}

export async function withdrawBoosterVaultCash(withdrawal, session) {
  const discordId = String(withdrawal.discordId || "").trim();
  const boosterName = String(withdrawal.boosterName || "").trim();
  const amount = Number(withdrawal.amount);
  const note = String(withdrawal.note || "").trim();
  const paymentMethod = String(withdrawal.paymentMethod || "Cash").trim();
  const date = String(withdrawal.date || new Date().toISOString().slice(0, 10)).trim();

  if (!discordId && !boosterName) {
    return { error: "Booster identity is required." };
  }
  if (isNaN(amount) || amount <= 0) {
    return { error: "Withdrawal amount must be greater than 0 MMK." };
  }
  if (!note) {
    return { error: "Payment reference / note is required." };
  }

  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      let query = "SELECT type, amount FROM booster_cash_vault WHERE ";
      let params = [];
      if (discordId) {
        query += "discord_id = $1";
        params.push(discordId);
      } else {
        query += "booster_name = $1";
        params.push(boosterName);
      }
      const res = await client.query(query, params);
      const totalDeposited = res.rows.filter((r) => r.type === "deposit").reduce((sum, r) => sum + Number(r.amount || 0), 0);
      const totalWithdrawn = res.rows.filter((r) => r.type === "withdraw").reduce((sum, r) => sum + Number(r.amount || 0), 0);
      const currentVaultBalance = totalDeposited - totalWithdrawn;

      if (amount > currentVaultBalance) {
        await client.query("ROLLBACK");
        return { error: `Withdrawal amount (${amount} MMK) exceeds current stored cash balance (${currentVaultBalance} MMK).` };
      }

      const tx = {
        id: `bcv_${randomBytes(10).toString("base64url")}`,
        discordId,
        boosterName,
        type: "withdraw",
        amount,
        goldAmount: 0,
        rate: 0,
        date,
        note,
        paymentMethod,
        settlementBatchId: null,
        createdAt: new Date().toISOString(),
        createdByDiscordId: session.discordId,
        createdByName: session.username
      };

      await client.query(`
        INSERT INTO booster_cash_vault (
          id, discord_id, booster_name, type, amount, gold_amount, rate, date, note, payment_method,
          settlement_batch_id, created_at, created_by_discord_id, created_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        tx.id, tx.discordId, tx.boosterName, tx.type, tx.amount, tx.goldAmount, tx.rate,
        tx.date, tx.note, tx.paymentMethod, tx.settlementBatchId, tx.createdAt,
        tx.createdByDiscordId, tx.createdByName
      ]);

      await client.query("COMMIT");
      return { transaction: tx, remainingVaultBalance: currentVaultBalance - amount };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    if (!db.boosterCashVault) db.boosterCashVault = [];
    const boosterTxs = db.boosterCashVault.filter(
      (tx) => (discordId && tx.discordId === discordId) || (boosterName && tx.boosterName === boosterName)
    );
    const totalDeposited = boosterTxs.filter((tx) => tx.type === "deposit").reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const totalWithdrawn = boosterTxs.filter((tx) => tx.type === "withdraw").reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const currentVaultBalance = totalDeposited - totalWithdrawn;

    if (amount > currentVaultBalance) {
      return { error: `Withdrawal amount (${amount} MMK) exceeds current stored cash balance (${currentVaultBalance} MMK).` };
    }

    const tx = {
      id: `bcv_${randomBytes(10).toString("base64url")}`,
      discordId,
      boosterName,
      type: "withdraw",
      amount,
      goldAmount: 0,
      rate: 0,
      date,
      note,
      paymentMethod,
      settlementBatchId: null,
      createdAt: new Date().toISOString(),
      createdByDiscordId: session.discordId,
      createdByName: session.username
    };

    db.boosterCashVault.unshift(tx);
    writeFileDb(db);
    return { transaction: tx, remainingVaultBalance: currentVaultBalance - amount };
  }
}

export async function settleBoosterBalance(boosterKey, session, options = {}) {
  const paidAt = new Date().toISOString();
  const boosterPaymentBatchId = `bpb_${(Math.random() + 1).toString(36).substring(2)}${Date.now().toString(36)}`;
  const discordId = boosterKey.discordId || "";
  const boosterName = boosterKey.boosterName || "";
  const rate = Number(options.rate) || 0;
  const action = options.action === "hold_cash" ? "hold_cash" : "pay_now";
  const date = options.date || paidAt.slice(0, 10);
  const note = options.note || (action === "hold_cash" ? "Stored from Mythic+ runs settlement" : "");

  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");

      // 1. Fetch open runs for this booster
      let runsQuery = "SELECT * FROM booster_records WHERE paid = false";
      let runsParams = [];
      if (discordId) {
        runsQuery += " AND discord_id = $1";
        runsParams.push(discordId);
      } else if (boosterName) {
        runsQuery += " AND booster_name = $1";
        runsParams.push(boosterName);
      }
      const openRunsRes = await client.query(runsQuery, runsParams);
      const openRuns = openRunsRes.rows;

      // 2. Fetch active (unsettled) adjustments for this booster
      let adjQuery = "SELECT * FROM booster_adjustments WHERE (settled IS NULL OR settled = false)";
      let adjParams = [];
      if (discordId) {
        adjQuery += " AND discord_id = $1";
        adjParams.push(discordId);
      } else if (boosterName) {
        adjQuery += " AND booster_name = $1";
        adjParams.push(boosterName);
      }
      adjQuery += " ORDER BY date ASC, created_at ASC";
      const adjRes = await client.query(adjQuery, adjParams);
      const activeAdjs = adjRes.rows;

      if (!openRuns.length && !activeAdjs.length) {
        await client.query("ROLLBACK");
        return { error: "No open runs or active adjustments found to settle for this booster." };
      }

      // 3. Mark open runs as paid
      if (openRuns.length) {
        const runIds = openRuns.map((r) => r.id);
        await client.query(`
          UPDATE booster_records SET
            paid = true, paid_at = $1, paid_by_discord_id = $2, paid_by_name = $3, booster_payment_batch_id = $4
          WHERE id = ANY($5::varchar[])
        `, [paidAt, session.discordId, session.username, boosterPaymentBatchId, runIds]);
      }

      // 4. Calculate settlement math
      const totalRuns = openRuns.reduce((sum, r) => sum + Number(r.total_balance || 0), 0);
      const totalAdd = activeAdjs.filter((a) => a.type === "add").reduce((sum, a) => sum + Number(a.amount || 0), 0);
      const totalDeduct = activeAdjs.filter((a) => a.type === "deduct").reduce((sum, a) => sum + Number(a.amount || 0), 0);
      const currentBalance = totalRuns + totalAdd - totalDeduct;
      const netPayoutAmount = Math.max(0, currentBalance);
      const cashAmountMmk = netPayoutAmount * rate;

      if (currentBalance >= 0) {
        // Full settlement: all active adjustments are marked settled
        if (activeAdjs.length) {
          const adjIds = activeAdjs.map((a) => a.id);
          await client.query(`
            UPDATE booster_adjustments SET
              settled = true, settled_at = $1, settlement_batch_id = $2
            WHERE id = ANY($3::varchar[])
          `, [paidAt, boosterPaymentBatchId, adjIds]);
        }
      } else {
        // Deficit settlement: runs reduce active debt
        const addAdjs = activeAdjs.filter((a) => a.type === "add");
        if (addAdjs.length) {
          await client.query(`
            UPDATE booster_adjustments SET
              settled = true, settled_at = $1, settlement_batch_id = $2
            WHERE id = ANY($3::varchar[])
          `, [paidAt, boosterPaymentBatchId, addAdjs.map((a) => a.id)]);
        }

        let offsetRemaining = totalRuns + totalAdd;
        const deductAdjs = activeAdjs.filter((a) => a.type === "deduct");
        for (const adj of deductAdjs) {
          const amt = Number(adj.amount || 0);
          if (offsetRemaining <= 0) break;
          if (amt <= offsetRemaining) {
            offsetRemaining -= amt;
            await client.query(`
              UPDATE booster_adjustments SET
                settled = true, settled_at = $1, settlement_batch_id = $2
              WHERE id = $3
            `, [paidAt, boosterPaymentBatchId, adj.id]);
          } else {
            const newAmount = amt - offsetRemaining;
            offsetRemaining = 0;
            await client.query(`
              UPDATE booster_adjustments SET
                amount = $1, note = $2, updated_at = $3
              WHERE id = $4
            `, [newAmount, `${adj.note} (Partial offset applied)`.trim(), paidAt, adj.id]);
          }
        }
      }

      // 5. If action is "hold_cash" and there is a net payout amount, credit booster cash vault
      let vaultTransaction = null;
      if (action === "hold_cash" && netPayoutAmount > 0) {
        vaultTransaction = {
          id: `bcv_${randomBytes(10).toString("base64url")}`,
          discordId: discordId || openRuns[0]?.discord_id || "",
          boosterName: boosterName || openRuns[0]?.booster_name || "",
          type: "deposit",
          amount: cashAmountMmk,
          goldAmount: netPayoutAmount,
          rate,
          date,
          note: note || `Stored from settlement (${netPayoutAmount} gold @ ${rate} MMK)`,
          paymentMethod: "Vault Deposit",
          settlementBatchId: boosterPaymentBatchId,
          createdAt: paidAt,
          createdByDiscordId: session.discordId,
          createdByName: session.username
        };

        await client.query(`
          INSERT INTO booster_cash_vault (
            id, discord_id, booster_name, type, amount, gold_amount, rate, date, note, payment_method,
            settlement_batch_id, created_at, created_by_discord_id, created_by_name
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
          vaultTransaction.id, vaultTransaction.discordId, vaultTransaction.boosterName, vaultTransaction.type,
          vaultTransaction.amount, vaultTransaction.goldAmount, vaultTransaction.rate, vaultTransaction.date,
          vaultTransaction.note, vaultTransaction.paymentMethod, vaultTransaction.settlementBatchId,
          vaultTransaction.createdAt, vaultTransaction.createdByDiscordId, vaultTransaction.createdByName
        ]);
      }

      await client.query("COMMIT");
      return {
        settledCount: openRuns.length,
        netPayoutAmount,
        rate,
        cashAmountMmk,
        action,
        vaultTransaction,
        boosterPaymentBatchId
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    if (!db.boosterRecords) db.boosterRecords = [];
    if (!db.boosterAdjustments) db.boosterAdjustments = [];
    if (!db.boosterCashVault) db.boosterCashVault = [];

    const openRuns = db.boosterRecords.filter((r) => {
      if (r.paid) return false;
      if (discordId && r.discordId === discordId) return true;
      if (boosterName && r.boosterName === boosterName) return true;
      return false;
    });

    const activeAdjs = db.boosterAdjustments.filter((a) => {
      if (a.settled) return false;
      if (discordId && a.discordId === discordId) return true;
      if (boosterName && a.boosterName === boosterName) return true;
      return false;
    });

    if (!openRuns.length && !activeAdjs.length) {
      return { error: "No open runs or active adjustments found to settle for this booster." };
    }

    for (const r of openRuns) {
      r.paid = true;
      r.paidAt = paidAt;
      r.paidByDiscordId = session.discordId;
      r.paidByName = session.username;
      r.boosterPaymentBatchId = boosterPaymentBatchId;
    }

    const totalRuns = openRuns.reduce((sum, r) => sum + Number(r.totalBalance || 0), 0);
    const totalAdd = activeAdjs.filter((a) => a.type === "add").reduce((sum, a) => sum + Number(a.amount || 0), 0);
    const totalDeduct = activeAdjs.filter((a) => a.type === "deduct").reduce((sum, a) => sum + Number(a.amount || 0), 0);
    const currentBalance = totalRuns + totalAdd - totalDeduct;
    const netPayoutAmount = Math.max(0, currentBalance);
    const cashAmountMmk = netPayoutAmount * rate;

    if (currentBalance >= 0) {
      for (const a of activeAdjs) {
        a.settled = true;
        a.settledAt = paidAt;
        a.settlementBatchId = boosterPaymentBatchId;
      }
    } else {
      for (const a of activeAdjs.filter((a) => a.type === "add")) {
        a.settled = true;
        a.settledAt = paidAt;
        a.settlementBatchId = boosterPaymentBatchId;
      }
      let offsetRemaining = totalRuns + totalAdd;
      for (const a of activeAdjs.filter((a) => a.type === "deduct")) {
        const amt = Number(a.amount || 0);
        if (offsetRemaining <= 0) break;
        if (amt <= offsetRemaining) {
          offsetRemaining -= amt;
          a.settled = true;
          a.settledAt = paidAt;
          a.settlementBatchId = boosterPaymentBatchId;
        } else {
          a.amount = amt - offsetRemaining;
          a.note = `${a.note} (Partial offset applied)`.trim();
          a.updatedAt = paidAt;
          offsetRemaining = 0;
        }
      }
    }

    let vaultTransaction = null;
    if (action === "hold_cash" && netPayoutAmount > 0) {
      vaultTransaction = {
        id: `bcv_${randomBytes(10).toString("base64url")}`,
        discordId: discordId || openRuns[0]?.discordId || "",
        boosterName: boosterName || openRuns[0]?.boosterName || "",
        type: "deposit",
        amount: cashAmountMmk,
        goldAmount: netPayoutAmount,
        rate,
        date,
        note: note || `Stored from settlement (${netPayoutAmount} gold @ ${rate} MMK)`,
        paymentMethod: "Vault Deposit",
        settlementBatchId: boosterPaymentBatchId,
        createdAt: paidAt,
        createdByDiscordId: session.discordId,
        createdByName: session.username
      };
      db.boosterCashVault.unshift(vaultTransaction);
    }

    writeFileDb(db);
    return {
      settledCount: openRuns.length,
      netPayoutAmount,
      rate,
      cashAmountMmk,
      action,
      vaultTransaction,
      boosterPaymentBatchId
    };
  }
}
