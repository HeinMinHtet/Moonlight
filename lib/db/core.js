import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import pg from "pg";

const { Pool } = pg;

const root = resolve(".");

export const dataDir = join(root, "data");

export function getDbPath() {
  return process.env.TEST_DB_PATH || join(dataDir, "database.json");
}

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
  raidNoteTitles: [
    { name: "Heroic 8/8 10 am", active: true, isDefault: true },
    { name: "Mythic 4/8 8pm", active: true, isDefault: false }
  ],
  buyerPurchaseTypes: [
    { name: "Gold", active: true, isDefault: true },
    { name: "Raid", active: true, isDefault: false },
    { name: "MOQ", active: true, isDefault: false }
  ],
  supplierRecords: [],
  supplierWithdrawals: [],
  boosterRecords: [],
  boosterAdjustments: [],
  boosterCashVault: [],
  externalExpenses: [],
  raidNotes: []
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
      connectionTimeoutMillis: 5000,
      // Idle pooled connections should not keep a script or test process alive.
      // (The HTTP server keeps the production process running on its own.)
      allowExitOnIdle: true
    });
    pool.on("error", (err) => {
      console.error("Unexpected PostgreSQL error on idle client", err);
    });
  }
  return pool;
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

// Postgres only: payment_batch_id columns reference payment_batches(id), so a batch row
// must exist before any row points at it. Safe to call repeatedly for the same id.
export async function ensurePaymentBatch(client, batchId, session = null) {
  if (!batchId) return;
  const id = String(batchId);
  const kind = id.startsWith("spb_") ? "supplier" : id.startsWith("bpb_") ? "booster" : "legacy";
  await client.query(
    `INSERT INTO payment_batches (id, kind, created_by_discord_id, created_by_name)
     VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
    [id, kind, session?.discordId || null, session?.username || null]
  );
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

export function mapSupplierRecordFromRow(row) {
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

export function mapBoosterRecordFromRow(row) {
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

export function mapSupplierWithdrawalFromRow(row) {
  return {
    id: row.id,
    date: row.date,
    charName: row.char_name,
    guild: row.guild,
    amount: Number(row.amount || 0),
    originalAmount: row.original_amount !== null && row.original_amount !== undefined ? Number(row.original_amount) : null,
    parentWithdrawalId: row.parent_withdrawal_id || null,
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

export function mapExternalExpenseFromRow(row) {
  return {
    id: row.id,
    date: row.date,
    category: row.category,
    title: row.title,
    amount: Number(row.amount || 0),
    recipient: row.recipient || "",
    note: row.note || "",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    createdByDiscordId: row.created_by_discord_id || null,
    createdByName: row.created_by_name || null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
  };
}

// -------------------------------------------------------------
// File-based Storage Engine (Fallback for local dev / tests)
// -------------------------------------------------------------

export function readFileDb() {
  const targetDbPath = getDbPath();
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  if (!existsSync(targetDbPath)) writeFileSync(targetDbPath, JSON.stringify(defaultDb, null, 2));
  let raw = {};
  const fileContent = readFileSync(targetDbPath, "utf8");
  if (fileContent && fileContent.trim()) {
    try {
      raw = JSON.parse(fileContent);
    } catch (error) {
      // Never fall back to an empty ledger here: the next write would overwrite the real file.
      console.error(`[DATA] ${targetDbPath} is not valid JSON: ${error.message}. Refusing to read or overwrite it.`);
      throw Object.assign(new Error("The ledger data file is damaged. Restore it from a backup before saving again."), {
        statusCode: 500,
        code: "LEDGER_FILE_CORRUPT"
      });
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      console.error(`[DATA] ${targetDbPath} does not contain a ledger object. Refusing to read or overwrite it.`);
      throw Object.assign(new Error("The ledger data file is damaged. Restore it from a backup before saving again."), {
        statusCode: 500,
        code: "LEDGER_FILE_CORRUPT"
      });
    }
  }
  return {
    ...defaultDb,
    ...raw,
    supplierServices: Array.isArray(raw.supplierServices) ? raw.supplierServices : defaultDb.supplierServices,
    boosterPrices: Array.isArray(raw.boosterPrices) ? raw.boosterPrices : defaultDb.boosterPrices,
    armorTypes: Array.isArray(raw.armorTypes) ? raw.armorTypes : defaultDb.armorTypes,
    supplierGuilds: Array.isArray(raw.supplierGuilds) ? raw.supplierGuilds : defaultDb.supplierGuilds,
    raidNoteTitles: Array.isArray(raw.raidNoteTitles) ? raw.raidNoteTitles : defaultDb.raidNoteTitles,
    buyerPurchaseTypes: Array.isArray(raw.buyerPurchaseTypes) ? raw.buyerPurchaseTypes : defaultDb.buyerPurchaseTypes,
    supplierRecords: Array.isArray(raw.supplierRecords) ? raw.supplierRecords : [],
    supplierWithdrawals: Array.isArray(raw.supplierWithdrawals) ? raw.supplierWithdrawals : [],
    boosterRecords: Array.isArray(raw.boosterRecords) ? raw.boosterRecords : [],
    boosterAdjustments: Array.isArray(raw.boosterAdjustments) ? raw.boosterAdjustments : [],
    boosterCashVault: Array.isArray(raw.boosterCashVault) ? raw.boosterCashVault : [],
    externalExpenses: Array.isArray(raw.externalExpenses) ? raw.externalExpenses : [],
    raidNotes: Array.isArray(raw.raidNotes) ? raw.raidNotes : []
  };
}

export function normalizeArmorType(entry) {
  if (typeof entry === "string") {
    return { name: entry, active: true, isDefault: entry === "No stack" };
  }
  return {
    name: String(entry?.name || "").trim(),
    active: entry?.active !== false,
    isDefault: Boolean(entry?.isDefault)
  };
}

export function writeFileDb(db) {
  const targetDbPath = getDbPath();
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  writeFileAtomic(targetDbPath, JSON.stringify(db, null, 2));
}

// Write to a temp file next to the target, then rename it into place, so a crash
// mid-write can never leave a half-written (and therefore unreadable) ledger file.
export function writeFileAtomic(targetPath, content) {
  const targetDir = dirname(targetPath);
  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
  const tempPath = `${targetPath}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  writeFileSync(tempPath, content, "utf8");
  try {
    renameSync(tempPath, targetPath);
  } catch (error) {
    // Windows can refuse the rename while another program (editor, antivirus) holds the
    // target open. Fall back to copying the finished temp file over the target.
    if (!["EPERM", "EACCES", "EBUSY"].includes(error.code)) {
      rmSync(tempPath, { force: true });
      throw error;
    }
    copyFileSync(tempPath, targetPath);
    rmSync(tempPath, { force: true });
  }
}

// -------------------------------------------------------------
// Booster Balance Adjustments Operations
// -------------------------------------------------------------

export function mapBoosterAdjustmentFromRow(row) {
  return {
    id: row.id,
    discordId: row.discord_id,
    boosterName: row.booster_name,
    type: row.type,
    amount: Number(row.amount || 0),
    originalAmount: row.original_amount !== null && row.original_amount !== undefined ? Number(row.original_amount) : null,
    parentAdjustmentId: row.parent_adjustment_id || null,
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

// -------------------------------------------------------------
// Booster Stored Cash Vault Operations (MMK)
// -------------------------------------------------------------

export function mapBoosterVaultFromRow(row) {
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

// -------------------------------------------------------------
// External Expenses (Raid Payments, M+ Outsource Payments, etc.)
// -------------------------------------------------------------

export function externalExpensesSummary(expenses) {
  let totalAmount = 0;
  let raidPaymentTotal = 0;
  let outsourcePaymentTotal = 0;
  let otherTotal = 0;

  for (const exp of expenses) {
    const amt = Number(exp.amount || 0);
    totalAmount += amt;
    const cat = String(exp.category || "").toLowerCase();
    if (cat.includes("raid")) {
      raidPaymentTotal += amt;
    } else if (cat.includes("outsource") || cat.includes("m+")) {
      outsourcePaymentTotal += amt;
    } else {
      otherTotal += amt;
    }
  }

  return {
    totalAmount,
    totalCount: expenses.length,
    raidPaymentTotal,
    outsourcePaymentTotal,
    otherTotal
  };
}

// -------------------------------------------------------------
// Raid Notes
// -------------------------------------------------------------

export function mapRaidNoteFromRow(row) {
  let items = [];
  try {
    items = typeof row.items === "string" ? JSON.parse(row.items) : (row.items || []);
  } catch {
    items = [];
  }
  return {
    id: row.id,
    title: row.title,
    raidDate: row.raid_date,
    raidTime: row.raid_time || "",
    color: row.color || "default",
    pinned: Boolean(row.pinned),
    archived: Boolean(row.archived),
    items: Array.isArray(items) ? items : [],
    createdByDiscordId: row.created_by_discord_id || null,
    createdByName: row.created_by_name || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
  };
}
