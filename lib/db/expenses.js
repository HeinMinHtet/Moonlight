import { randomBytes } from "node:crypto";
import { bangkokToday } from "../bangkokDate.js";
import { externalExpensesSummary, getPool, isPostgres, mapExternalExpenseFromRow, readFileDb, writeFileDb } from "./core.js";

export async function getExternalExpensesPayload() {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("SELECT * FROM external_expenses ORDER BY date DESC, created_at DESC");
      const expenses = res.rows.map(mapExternalExpenseFromRow);
      return { expenses, summary: externalExpensesSummary(expenses) };
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    const expenses = (db.externalExpenses || [])
      .slice()
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return { expenses, summary: externalExpensesSummary(expenses) };
  }
}

export async function insertExternalExpense(expense, session = {}) {
  const record = {
    id: expense.id || `exp_${randomBytes(10).toString("base64url")}`,
    date: expense.date || bangkokToday(),
    category: expense.category || "Raid payment",
    title: expense.title || "",
    amount: Number(expense.amount || 0),
    recipient: expense.recipient || "",
    note: expense.note || "",
    createdByDiscordId: session.discordId || expense.createdByDiscordId || null,
    createdByName: session.username || expense.createdByName || null,
    createdAt: expense.createdAt || new Date().toISOString(),
    updatedAt: null
  };

  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query(`
        INSERT INTO external_expenses (
          id, date, category, title, amount, recipient, note,
          created_by_discord_id, created_by_name, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        record.id, record.date, record.category, record.title,
        record.amount, record.recipient, record.note,
        record.createdByDiscordId, record.createdByName, record.createdAt
      ]);
      return record;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    if (!db.externalExpenses) db.externalExpenses = [];
    db.externalExpenses.unshift(record);
    writeFileDb(db);
    return record;
  }
}

export async function getExternalExpenseById(id) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("SELECT * FROM external_expenses WHERE id = $1", [id]);
      return res.rows.length ? mapExternalExpenseFromRow(res.rows[0]) : null;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    return (db.externalExpenses || []).find((item) => item.id === id) || null;
  }
}

export async function updateExternalExpense(id, fields) {
  const updatedAt = new Date().toISOString();
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const currentRes = await client.query("SELECT * FROM external_expenses WHERE id = $1", [id]);
      if (!currentRes.rows.length) return null;
      const current = currentRes.rows[0];
      const updated = {
        date: fields.date !== undefined ? fields.date : current.date,
        category: fields.category !== undefined ? fields.category : current.category,
        title: fields.title !== undefined ? fields.title : current.title,
        amount: fields.amount !== undefined ? Number(fields.amount) : Number(current.amount),
        recipient: fields.recipient !== undefined ? fields.recipient : current.recipient,
        note: fields.note !== undefined ? fields.note : current.note
      };
      const res = await client.query(`
        UPDATE external_expenses SET
          date = $1, category = $2, title = $3, amount = $4, recipient = $5, note = $6, updated_at = $7
        WHERE id = $8
        RETURNING *
      `, [updated.date, updated.category, updated.title, updated.amount, updated.recipient, updated.note, updatedAt, id]);
      return mapExternalExpenseFromRow(res.rows[0]);
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    const index = (db.externalExpenses || []).findIndex((item) => item.id === id);
    if (index === -1) return null;
    const current = db.externalExpenses[index];
    const updated = {
      ...current,
      ...fields,
      amount: fields.amount !== undefined ? Number(fields.amount) : current.amount,
      updatedAt
    };
    db.externalExpenses[index] = updated;
    writeFileDb(db);
    return updated;
  }
}

export async function deleteExternalExpense(id) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("DELETE FROM external_expenses WHERE id = $1 RETURNING id", [id]);
      return res.rowCount > 0;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    const before = (db.externalExpenses || []).length;
    db.externalExpenses = (db.externalExpenses || []).filter((item) => item.id !== id);
    const deleted = db.externalExpenses.length < before;
    if (deleted) writeFileDb(db);
    return deleted;
  }
}
