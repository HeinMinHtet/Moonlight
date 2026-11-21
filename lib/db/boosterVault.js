import { randomBytes } from "node:crypto";
import { bangkokToday } from "../bangkokDate.js";
import { ensurePaymentBatch, getPool, isPostgres, mapBoosterVaultFromRow, readFileDb, writeFileDb } from "./core.js";

export async function getBoosterCashVaultPayload(session, canManageAdmin) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      let query = "SELECT * FROM booster_cash_vault";
      let params = [];
      if (!canManageAdmin) {
        query += " WHERE discord_id = $1";
        params.push(session.discordId || "");
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
      : all.filter((tx) => session.discordId && tx.discordId === session.discordId);
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
    date: tx.date || bangkokToday(),
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
  const date = String(withdrawal.date || bangkokToday()).trim();

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
  const date = options.date || bangkokToday();
  const note = options.note || (action === "hold_cash" ? "Stored from Mythic+ runs settlement" : "");
  // Without a booster filter the queries below would settle every booster's open runs.
  if (!discordId && !boosterName) {
    return { error: "Booster name or ID is required for settlement." };
  }

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
      runsQuery += " FOR UPDATE";
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
      adjQuery += " ORDER BY date ASC, created_at ASC FOR UPDATE";
      const adjRes = await client.query(adjQuery, adjParams);
      const activeAdjs = adjRes.rows;

      if (!openRuns.length && !activeAdjs.length) {
        await client.query("ROLLBACK");
        return { error: "No open runs or active adjustments found to settle for this booster." };
      }

      await ensurePaymentBatch(client, boosterPaymentBatchId, session);

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
      const cashAmountMmk = Math.round(netPayoutAmount * rate);

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
            const offsetAmt = offsetRemaining;
            const remainingDebt = Math.round((amt - offsetAmt + Number.EPSILON) * 100) / 100;
            offsetRemaining = 0;
            await client.query(`
              UPDATE booster_adjustments SET
                amount = $1, original_amount = COALESCE(original_amount, $2), settled = true, settled_at = $3, settlement_batch_id = $4, note = $5, updated_at = $3
              WHERE id = $6
            `, [offsetAmt, amt, paidAt, boosterPaymentBatchId, `${adj.note || ""} (Partial offset applied)`.trim(), adj.id]);
            const remainderId = `badj_${randomBytes(10).toString("base64url")}`;
            await client.query(`
              INSERT INTO booster_adjustments (
                id, discord_id, booster_name, type, amount, note, date, settled, settled_at,
                settlement_batch_id, created_by_discord_id, created_by_name, created_at,
                parent_adjustment_id, original_amount
              ) VALUES ($1, $2, $3, 'deduct', $4, $5, $6, false, null, null, $7, $8, $9, $10, $11)
            `, [
              remainderId, adj.discord_id, adj.booster_name, remainingDebt,
              `${adj.note || ""} (Remaining unsettled balance)`.trim(),
              adj.date, adj.created_by_discord_id, adj.created_by_name, adj.created_at || paidAt,
              adj.id, remainingDebt
            ]);
          }
        }
      }

      // 5. If there is a net payout amount, record the settlement in vault history
      let vaultTransaction = null;
      if (netPayoutAmount > 0) {
        vaultTransaction = {
          id: `bcv_${randomBytes(10).toString("base64url")}`,
          discordId: discordId || openRuns[0]?.discord_id || "",
          boosterName: boosterName || openRuns[0]?.booster_name || "",
          type: action === "hold_cash" ? "deposit" : "direct_payout",
          amount: cashAmountMmk,
          goldAmount: netPayoutAmount,
          rate,
          date,
          note: note || (action === "hold_cash" ? `Stored from settlement (${netPayoutAmount} gold @ ${rate} MMK)` : `Paid out directly (${netPayoutAmount} gold @ ${rate} MMK)`),
          paymentMethod: action === "hold_cash" ? "Vault Deposit" : "Direct Payout",
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
    const cashAmountMmk = Math.round(netPayoutAmount * rate);

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
          const offsetAmt = offsetRemaining;
          const remainingDebt = Math.round((amt - offsetAmt + Number.EPSILON) * 100) / 100;
          offsetRemaining = 0;
          a.originalAmount = a.originalAmount || amt;
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
            originalAmount: remainingDebt,
            parentAdjustmentId: a.id,
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

    let vaultTransaction = null;
    if (netPayoutAmount > 0) {
      vaultTransaction = {
        id: `bcv_${randomBytes(10).toString("base64url")}`,
        discordId: discordId || openRuns[0]?.discordId || "",
        boosterName: boosterName || openRuns[0]?.boosterName || "",
        type: action === "hold_cash" ? "deposit" : "direct_payout",
        amount: cashAmountMmk,
        goldAmount: netPayoutAmount,
        rate,
        date,
        note: note || (action === "hold_cash" ? `Stored from settlement (${netPayoutAmount} gold @ ${rate} MMK)` : `Paid out directly (${netPayoutAmount} gold @ ${rate} MMK)`),
        paymentMethod: action === "hold_cash" ? "Vault Deposit" : "Direct Payout",
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
