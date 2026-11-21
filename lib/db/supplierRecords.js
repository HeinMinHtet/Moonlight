import { randomBytes } from "node:crypto";
import { ensurePaymentBatch, getPool, isPostgres, lineTotal, mapSupplierRecordFromRow, mapSupplierWithdrawalFromRow, paymentBatchIdFor, readFileDb, supplierSummary, writeFileDb } from "./core.js";

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
        record.armorType || "No stack", Boolean(record.correct), Boolean(record.paid), record.note || "", record.rateAtRecord || 0,
        record.totalCost || 0, record.createdByDiscordId, record.createdByName, record.createdAt || new Date().toISOString()
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
      if (updated.paid) await ensurePaymentBatch(client, updated.paymentBatchId);

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
      query += " FOR UPDATE";
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
      await ensurePaymentBatch(client, paymentBatchId, session);
      await client.query(`
        UPDATE supplier_records SET
          paid = true, paid_at = $1, paid_by_discord_id = $2, paid_by_name = $3, payment_batch_id = $4
        WHERE id = ANY($5::varchar[])
      `, [paidAt, session.discordId, session.username, paymentBatchId, idsToPay]);

      if (settleWithdrawals) {
        // Reconcile active (unsettled) supplier withdrawals against the paid sales total
        const salesTotal = payableRows.reduce((sum, r) => sum + Number(r.total_cost || lineTotal(r.rate_at_record, r.quantity)), 0);
        const activeWithdrawalsRes = await client.query(
          "SELECT * FROM supplier_withdrawals WHERE settled = false ORDER BY date ASC, created_at ASC FOR UPDATE"
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
            const offsetAmt = remainingOffset;
            const remainingDebt = Math.round((amt - offsetAmt + Number.EPSILON) * 100) / 100;
            remainingOffset = 0;
            await client.query(
              "UPDATE supplier_withdrawals SET amount = $1, original_amount = COALESCE(original_amount, $2), settled = true, settled_at = $3, settlement_batch_id = $4, note = $5, updated_at = $3 WHERE id = $6",
              [offsetAmt, amt, paidAt, paymentBatchId, `${w.note || ""} (Partial offset applied)`.trim(), w.id]
            );
            const remainderId = `sw_${randomBytes(10).toString("base64url")}`;
            await client.query(`
              INSERT INTO supplier_withdrawals (
                id, date, char_name, guild, amount, note, settled, settled_at,
                settlement_batch_id, created_by_discord_id, created_by_name, created_at,
                parent_withdrawal_id, original_amount
              ) VALUES ($1, $2, $3, $4, $5, $6, false, null, null, $7, $8, $9, $10, $11)
            `, [
              remainderId, w.date, w.char_name, w.guild, remainingDebt,
              `${w.note || ""} (Remaining unsettled balance)`.trim(),
              w.created_by_discord_id, w.created_by_name, w.created_at || paidAt,
              w.id, remainingDebt
            ]);
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
          const offsetAmt = remainingOffset;
          const remainingDebt = Math.round((amt - offsetAmt + Number.EPSILON) * 100) / 100;
          remainingOffset = 0;
          w.originalAmount = w.originalAmount || amt;
          w.amount = offsetAmt;
          w.settled = true;
          w.settledAt = paidAt;
          w.settlementBatchId = paymentBatchId;
          w.note = `${w.note || ""} (Partial offset applied)`.trim();
          w.updatedAt = paidAt;
          const remainder = {
            id: `sw_${randomBytes(10).toString("base64url")}`,
            date: w.date,
            charName: w.charName,
            guild: w.guild,
            amount: remainingDebt,
            originalAmount: remainingDebt,
            parentWithdrawalId: w.id,
            note: `${w.note || ""} (Remaining unsettled balance)`.trim(),
            settled: false,
            settledAt: null,
            settlementBatchId: null,
            createdByDiscordId: w.createdByDiscordId,
            createdByName: w.createdByName,
            createdAt: w.createdAt || paidAt
          };
          db.supplierWithdrawals.push(remainder);
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

      // Recombine any split withdrawals that have an unsettled remainder
      const settledWithdrawalsRes = await client.query(
        "SELECT id, original_amount, note FROM supplier_withdrawals WHERE settlement_batch_id = $1",
        [paymentBatchId]
      );
      for (const w of settledWithdrawalsRes.rows) {
        if (w.original_amount !== null && w.original_amount !== undefined) {
          await client.query(
            "DELETE FROM supplier_withdrawals WHERE parent_withdrawal_id = $1 AND settled = false",
            [w.id]
          );
          const cleanedNote = (w.note || "").replace(/\s*\(Partial offset applied\)/g, "").trim();
          await client.query(
            "UPDATE supplier_withdrawals SET amount = $1, original_amount = null, note = $2 WHERE id = $3",
            [w.original_amount, cleanedNote, w.id]
          );
        }
      }

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
      const settledWithdrawals = db.supplierWithdrawals.filter((w) => w.settlementBatchId === paymentBatchId);
      for (const w of settledWithdrawals) {
        if (w.originalAmount) {
          const childIndex = db.supplierWithdrawals.findIndex(
            (child) => child.parentWithdrawalId === w.id && !child.settled
          );
          if (childIndex !== -1) {
            db.supplierWithdrawals.splice(childIndex, 1);
            w.amount = w.originalAmount;
            w.originalAmount = null;
            w.note = (w.note || "").replace(/\s*\(Partial offset applied\)/g, "").trim();
          }
        }
        w.settled = false;
        w.settledAt = null;
        w.settlementBatchId = null;
        w.updatedAt = reopenedAt;
      }
    }

    writeFileDb(db);
    return { reopenedCount: paidRecordsToReopen.length };
  }
}
