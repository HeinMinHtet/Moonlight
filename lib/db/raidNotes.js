import { randomBytes } from "node:crypto";
import { bangkokToday } from "../bangkokDate.js";
import { getPool, isPostgres, mapRaidNoteFromRow, readFileDb, writeFileDb } from "./core.js";

export async function getRaidNotesPayload() {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query(`
        SELECT * FROM raid_notes
        ORDER BY pinned DESC, raid_date DESC, created_at DESC
      `);
      return { notes: res.rows.map(mapRaidNoteFromRow) };
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    const notes = Array.isArray(db.raidNotes) ? [...db.raidNotes] : [];
    notes.sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      if (a.raidDate !== b.raidDate) return (b.raidDate || "").localeCompare(a.raidDate || "");
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });
    return { notes };
  }
}

export async function insertRaidNote(note, session = {}) {
  const now = new Date().toISOString();
  const rawItems = Array.isArray(note.items) ? note.items : [];
  const sanitizedItems = rawItems.map((item) => ({
    id: item.id || `item_${randomBytes(6).toString("base64url")}`,
    text: String(item.text || "").trim(),
    completed: Boolean(item.completed),
    note: String(item.note || "").trim(),
    purchaseType: String(item.purchaseType || "").trim()
  })).filter((item) => item.text.length > 0);

  const record = {
    id: note.id || `note_${randomBytes(10).toString("base64url")}`,
    title: String(note.title || "").trim() || "Untitled Raid",
    raidDate: String(note.raidDate || "").trim() || bangkokToday(),
    raidTime: String(note.raidTime || "").trim(),
    color: String(note.color || "default").trim(),
    pinned: Boolean(note.pinned),
    archived: Boolean(note.archived),
    items: sanitizedItems,
    createdByDiscordId: session.discordId || note.createdByDiscordId || null,
    createdByName: session.username || note.createdByName || null,
    createdAt: note.createdAt || now,
    updatedAt: null
  };

  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query(`
        INSERT INTO raid_notes (
          id, title, raid_date, raid_time, color, pinned, archived, items,
          created_by_discord_id, created_by_name, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        record.id, record.title, record.raidDate, record.raidTime, record.color,
        record.pinned, record.archived, JSON.stringify(record.items),
        record.createdByDiscordId, record.createdByName, record.createdAt
      ]);
      return record;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    if (!db.raidNotes) db.raidNotes = [];
    db.raidNotes.unshift(record);
    writeFileDb(db);
    return record;
  }
}

export async function getRaidNoteById(id) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("SELECT * FROM raid_notes WHERE id = $1", [id]);
      return res.rows.length ? mapRaidNoteFromRow(res.rows[0]) : null;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    return (db.raidNotes || []).find((item) => item.id === id) || null;
  }
}

export async function updateRaidNote(id, fields) {
  const updatedAt = new Date().toISOString();
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const currentRes = await client.query("SELECT * FROM raid_notes WHERE id = $1", [id]);
      if (!currentRes.rows.length) return null;
      const current = mapRaidNoteFromRow(currentRes.rows[0]);

      let items = current.items;
      if (fields.items !== undefined && Array.isArray(fields.items)) {
        items = fields.items.map((item) => ({
          id: item.id || `item_${randomBytes(6).toString("base64url")}`,
          text: String(item.text || "").trim(),
          completed: Boolean(item.completed),
          note: String(item.note || "").trim(),
          purchaseType: String(item.purchaseType || "").trim()
        })).filter((item) => item.text.length > 0);
      }

      const updated = {
        title: fields.title !== undefined ? String(fields.title).trim() : current.title,
        raidDate: fields.raidDate !== undefined ? String(fields.raidDate).trim() : current.raidDate,
        raidTime: fields.raidTime !== undefined ? String(fields.raidTime).trim() : current.raidTime,
        color: fields.color !== undefined ? String(fields.color).trim() : current.color,
        pinned: fields.pinned !== undefined ? Boolean(fields.pinned) : current.pinned,
        archived: fields.archived !== undefined ? Boolean(fields.archived) : current.archived,
        items
      };

      const res = await client.query(`
        UPDATE raid_notes SET
          title = $1, raid_date = $2, raid_time = $3, color = $4,
          pinned = $5, archived = $6, items = $7, updated_at = $8
        WHERE id = $9
        RETURNING *
      `, [
        updated.title, updated.raidDate, updated.raidTime, updated.color,
        updated.pinned, updated.archived, JSON.stringify(updated.items),
        updatedAt, id
      ]);
      return mapRaidNoteFromRow(res.rows[0]);
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    const index = (db.raidNotes || []).findIndex((item) => item.id === id);
    if (index === -1) return null;
    const current = db.raidNotes[index];

    let items = current.items;
    if (fields.items !== undefined && Array.isArray(fields.items)) {
      items = fields.items.map((item) => ({
        id: item.id || `item_${randomBytes(6).toString("base64url")}`,
        text: String(item.text || "").trim(),
        completed: Boolean(item.completed),
        note: String(item.note || "").trim(),
        purchaseType: String(item.purchaseType || "").trim()
      })).filter((item) => item.text.length > 0);
    }

    const updated = {
      ...current,
      ...fields,
      title: fields.title !== undefined ? String(fields.title).trim() : current.title,
      raidDate: fields.raidDate !== undefined ? String(fields.raidDate).trim() : current.raidDate,
      raidTime: fields.raidTime !== undefined ? String(fields.raidTime).trim() : current.raidTime,
      color: fields.color !== undefined ? String(fields.color).trim() : current.color,
      pinned: fields.pinned !== undefined ? Boolean(fields.pinned) : current.pinned,
      archived: fields.archived !== undefined ? Boolean(fields.archived) : current.archived,
      items,
      updatedAt
    };
    db.raidNotes[index] = updated;
    writeFileDb(db);
    return updated;
  }
}

export async function deleteRaidNote(id) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("DELETE FROM raid_notes WHERE id = $1 RETURNING id", [id]);
      return res.rowCount > 0;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    const before = (db.raidNotes || []).length;
    db.raidNotes = (db.raidNotes || []).filter((item) => item.id !== id);
    const deleted = db.raidNotes.length < before;
    if (deleted) writeFileDb(db);
    return deleted;
  }
}
