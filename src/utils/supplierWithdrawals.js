/**
 * Pure utilities for supplier pre-withdrawals, net balance calculation,
 * payload validation, and settlement reconciliation.
 */

/**
 * Calculates supplier net balance from verified sales total and withdrawal records.
 * Sums active (unsettled) withdrawals and subtracts from verified sales total.
 * Supports negative balance (deficit) when withdrawals exceed verified sales.
 *
 * @param {number} verifiedSalesTotal - Total value of verified unpaid sales
 * @param {Array<Object>} withdrawals - List of withdrawal objects
 * @returns {{
 *   verifiedSalesTotal: number,
 *   activeWithdrawalsTotal: number,
 *   settledWithdrawalsTotal: number,
 *   activeWithdrawalsCount: number,
 *   netBalance: number,
 *   isDeficit: boolean
 * }}
 */
export function calculateSupplierNetBalance(verifiedSalesTotal = 0, withdrawals = []) {
  const safeSalesTotal = Math.max(0, Number(verifiedSalesTotal) || 0);

  let activeWithdrawalsTotal = 0;
  let settledWithdrawalsTotal = 0;
  let activeWithdrawalsCount = 0;

  for (const w of withdrawals || []) {
    const amount = Number(w.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    if (w.settled) {
      settledWithdrawalsTotal += amount;
    } else {
      activeWithdrawalsTotal += amount;
      activeWithdrawalsCount += 1;
    }
  }

  const netBalance = safeSalesTotal - activeWithdrawalsTotal;
  const isDeficit = netBalance < 0;

  return {
    verifiedSalesTotal: safeSalesTotal,
    activeWithdrawalsTotal,
    settledWithdrawalsTotal,
    activeWithdrawalsCount,
    netBalance,
    isDeficit
  };
}

/**
 * Validates a withdrawal creation/update payload.
 *
 * @param {Object} payload
 * @throws {Error} If validation fails
 */
export function validateWithdrawalPayload(payload = {}) {
  const charName = String(payload.charName || "").trim();
  if (!charName) {
    throw new Error("Character name is required.");
  }

  const guild = String(payload.guild || "").trim();
  if (!guild) {
    throw new Error("Guild is required.");
  }

  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Withdrawal amount must be a positive number greater than 0.");
  }

  const date = String(payload.date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Date must be in YYYY-MM-DD format.");
  }

  return {
    charName,
    guild,
    amount,
    date,
    note: String(payload.note || "").trim()
  };
}

/**
 * Reconciles active (unsettled) withdrawals against a verified sales total in chronological order.
 *
 * @param {number} verifiedSalesTotal - Total amount of sales to settle against
 * @param {Array<Object>} activeWithdrawals - Unsettled withdrawal records
 * @returns {{
 *   settledWithdrawals: Array<Object>,
 *   partiallySettledWithdrawal: Object | null,
 *   unsettledWithdrawals: Array<Object>,
 *   totalOffset: number,
 *   remainingSales: number,
 *   remainingDebt: number
 * }}
 */
export function reconcileWithdrawalSettlement(verifiedSalesTotal = 0, activeWithdrawals = []) {
  let remainingSales = Math.max(0, Number(verifiedSalesTotal) || 0);
  let totalOffset = 0;

  // Sort withdrawals chronologically (oldest date/creation first)
  const sorted = [...activeWithdrawals].sort((a, b) => {
    const dateComp = String(a.date || "").localeCompare(String(b.date || ""));
    if (dateComp !== 0) return dateComp;
    return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
  });

  const settledWithdrawals = [];
  let partiallySettledWithdrawal = null;
  const unsettledWithdrawals = [];

  for (const item of sorted) {
    const amount = Number(item.amount || 0);
    if (amount <= 0) continue;

    if (remainingSales <= 0) {
      unsettledWithdrawals.push(item);
      continue;
    }

    if (amount <= remainingSales) {
      remainingSales -= amount;
      totalOffset += amount;
      settledWithdrawals.push({
        ...item,
        settled: true,
        offsetAmount: amount,
        remainingAmount: 0
      });
    } else {
      // Partial offset
      const offset = remainingSales;
      const remainingAmount = amount - offset;
      totalOffset += offset;
      remainingSales = 0;

      partiallySettledWithdrawal = {
        ...item,
        settled: false,
        partiallySettled: true,
        offsetAmount: offset,
        remainingAmount,
        note: item.note ? `${item.note} (Partial offset applied)`.trim() : "(Partial offset applied)"
      };
    }
  }

  const remainingDebt = unsettledWithdrawals.reduce((sum, w) => sum + Number(w.amount || 0), 0) +
    (partiallySettledWithdrawal ? Number(partiallySettledWithdrawal.remainingAmount || 0) : 0);

  return {
    settledWithdrawals,
    partiallySettledWithdrawal,
    unsettledWithdrawals,
    totalOffset,
    remainingSales,
    remainingDebt
  };
}
