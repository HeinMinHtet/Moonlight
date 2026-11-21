import { randomBytes } from "node:crypto";
import { boosterSummary, ensurePaymentBatch, getPool, isPostgres, lineTotal, mapBoosterRecordFromRow, readFileDb, writeFileDb } from "./core.js";

export async function getBoosterRecordsPayload(session, canManageAdmin) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      let query = "SELECT * FROM booster_records";
      let params = [];
      if (!canManageAdmin) {
        query += " WHERE discord_id = $1";
        params.push(session.discordId || "");
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
      : db.boosterRecords.filter((record) => session.discordId && record.discordId === session.discordId);
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
      if (updated.paid) await ensurePaymentBatch(client, updated.boosterPaymentBatchId);

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
      const res = await client.query("SELECT * FROM booster_records WHERE paid = false AND id = ANY($1::varchar[]) FOR UPDATE", [[...selectedIds]]);
      const payableRows = res.rows;
      if (payableRows.length !== selectedIds.size) {
        await client.query("ROLLBACK");
        return { error: "Some selected booster rows are already paid or no longer available. Refresh, then try again." };
      }

      await ensurePaymentBatch(client, boosterPaymentBatchId, session);
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

      // Reconcile active adjustments (credits and debits) for each booster
      for (const [key, runAmount] of boosterTotals.entries()) {
        const adjsRes = await client.query(
          "SELECT * FROM booster_adjustments WHERE (discord_id = $1 OR booster_name = $1) AND (settled IS NULL OR settled = false) ORDER BY date ASC, created_at ASC FOR UPDATE",
          [key]
        );
        const activeAdjs = adjsRes.rows;
        const totalAdd = activeAdjs.filter((a) => a.type === "add").reduce((sum, a) => sum + Number(a.amount || 0), 0);
        const totalDeduct = activeAdjs.filter((a) => a.type === "deduct").reduce((sum, a) => sum + Number(a.amount || 0), 0);
        const netSettlement = runAmount + totalAdd - totalDeduct;

        if (netSettlement >= 0) {
          if (activeAdjs.length) {
            const adjIds = activeAdjs.map((a) => a.id);
            await client.query(`
              UPDATE booster_adjustments SET
                settled = true, settled_at = $1, settlement_batch_id = $2
              WHERE id = ANY($3::varchar[])
            `, [paidAt, boosterPaymentBatchId, adjIds]);
          }
        } else {
          const addAdjs = activeAdjs.filter((a) => a.type === "add");
          if (addAdjs.length) {
            await client.query(`
              UPDATE booster_adjustments SET
                settled = true, settled_at = $1, settlement_batch_id = $2
              WHERE id = ANY($3::varchar[])
            `, [paidAt, boosterPaymentBatchId, addAdjs.map((a) => a.id)]);
          }
          let remainingOffset = runAmount + totalAdd;
          const deductAdjs = activeAdjs.filter((a) => a.type === "deduct");
          for (const adj of deductAdjs) {
            const amt = Number(adj.amount || 0);
            if (remainingOffset <= 0) break;
            if (amt <= remainingOffset) {
              remainingOffset -= amt;
              await client.query(`
                UPDATE booster_adjustments SET
                  settled = true, settled_at = $1, settlement_batch_id = $2
                WHERE id = $3
              `, [paidAt, boosterPaymentBatchId, adj.id]);
            } else {
              const offsetAmt = remainingOffset;
              const remainingDebt = Math.round((amt - offsetAmt + Number.EPSILON) * 100) / 100;
              remainingOffset = 0;
              await client.query(`
                UPDATE booster_adjustments SET
                  amount = $1, settled = true, settled_at = $2, settlement_batch_id = $3, note = $4, updated_at = $2
                WHERE id = $5
              `, [offsetAmt, paidAt, boosterPaymentBatchId, `${adj.note || ""} (Partial offset applied)`.trim(), adj.id]);
              const remainderId = `badj_${randomBytes(10).toString("base64url")}`;
              await client.query(`
                INSERT INTO booster_adjustments (
                  id, discord_id, booster_name, type, amount, note, date, settled, settled_at,
                  settlement_batch_id, created_by_discord_id, created_by_name, created_at
                ) VALUES ($1, $2, $3, 'deduct', $4, $5, $6, false, null, null, $7, $8, $9)
              `, [
                remainderId, adj.discord_id, adj.booster_name, remainingDebt,
                `${adj.note || ""} (Remaining unsettled balance)`.trim(),
                adj.date, adj.created_by_discord_id, adj.created_by_name, adj.created_at || paidAt
              ]);
            }
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

    // Reconcile active adjustments (credits and debits)
    for (const [key, runAmount] of boosterTotals.entries()) {
      const activeAdjs = db.boosterAdjustments.filter(
        (adj) => (adj.discordId === key || adj.boosterName === key) && !adj.settled
      );
      const totalAdd = activeAdjs.filter((a) => a.type === "add").reduce((sum, a) => sum + Number(a.amount || 0), 0);
      const totalDeduct = activeAdjs.filter((a) => a.type === "deduct").reduce((sum, a) => sum + Number(a.amount || 0), 0);
      const netSettlement = runAmount + totalAdd - totalDeduct;

      if (netSettlement >= 0) {
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
        let remainingOffset = runAmount + totalAdd;
        for (const a of activeAdjs.filter((a) => a.type === "deduct")) {
          const amt = Number(a.amount || 0);
          if (remainingOffset <= 0) break;
          if (amt <= remainingOffset) {
            remainingOffset -= amt;
            a.settled = true;
            a.settledAt = paidAt;
            a.settlementBatchId = boosterPaymentBatchId;
          } else {
            const offsetAmt = remainingOffset;
            const remainingDebt = Math.round((amt - offsetAmt + Number.EPSILON) * 100) / 100;
            remainingOffset = 0;
            a.amount = offsetAmt;
            a.settled = true;
            a.settledAt = paidAt;
            a.settlementBatchId = boosterPaymentBatchId;
            a.note = `${a.note || ""} (Partial offset applied)`.trim();
            a.updatedAt = paidAt;
            const remainder = {
              id: `badj_${randomBytes(10).toString("base64url")}`,
              discordId: a.discordId,
              boosterName: a.boosterName,
              type: "deduct",
              amount: remainingDebt,
              note: `${a.note || ""} (Remaining unsettled balance)`.trim(),
              date: a.date,
              settled: false,
              settledAt: null,
              settlementBatchId: null,
              createdByDiscordId: a.createdByDiscordId,
              createdByName: a.createdByName,
              createdAt: a.createdAt || paidAt
            };
            db.boosterAdjustments.push(remainder);
          }
        }
      }
    }

    writeFileDb(db);
    return { paidCount: payableRecords.length, boosterPaymentBatchId };
  }
}
