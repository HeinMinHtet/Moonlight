import { getPool, isPostgres, mapBoosterAdjustmentFromRow, readFileDb, writeFileDb } from "./core.js";

export async function getBoosterAdjustmentsPayload(session, canManageAdmin) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      let query = "SELECT * FROM booster_adjustments";
      let params = [];
      if (!canManageAdmin) {
        query += " WHERE discord_id = $1";
        params.push(session.discordId || "");
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
      : allAdjustments.filter((adj) => session.discordId && adj.discordId === session.discordId);
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
