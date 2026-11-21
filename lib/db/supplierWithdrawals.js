import { randomBytes } from "node:crypto";
import { bangkokToday } from "../bangkokDate.js";
import { getPool, isPostgres, mapSupplierWithdrawalFromRow, readFileDb, writeFileDb } from "./core.js";

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
    date: withdrawal.date || bangkokToday(),
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
