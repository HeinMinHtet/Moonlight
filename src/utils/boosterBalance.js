/**
 * Pure calculation helpers for Booster Balances and Adjustments
 */

export function calculateBoosterBalances(records = [], adjustments = []) {
  const boosterMap = new Map();

  // 1. Process payout records
  for (const record of records) {
    const key = record.discordId || record.boosterName || "unknown";
    if (!boosterMap.has(key)) {
      boosterMap.set(key, {
        discordId: record.discordId || "",
        boosterName: record.boosterName || "Unknown booster",
        openRunsCount: 0,
        openRunsTotal: 0,
        paidRunsCount: 0,
        paidRunsTotal: 0,
        adjustmentsCount: 0,
        adjustmentsTotal: 0,
        addAdjustmentsTotal: 0,
        deductAdjustmentsTotal: 0,
        currentBalance: 0,
        lifetimeEarned: 0
      });
    }

    const item = boosterMap.get(key);
    const amount = Number(record.totalBalance || 0);
    if (record.paid) {
      item.paidRunsCount += 1;
      item.paidRunsTotal += amount;
    } else {
      item.openRunsCount += 1;
      item.openRunsTotal += amount;
    }
  }

  // 2. Process manual balance adjustments
  for (const adj of adjustments) {
    const key = adj.discordId || adj.boosterName || "unknown";
    if (!boosterMap.has(key)) {
      boosterMap.set(key, {
        discordId: adj.discordId || "",
        boosterName: adj.boosterName || "Unknown booster",
        openRunsCount: 0,
        openRunsTotal: 0,
        paidRunsCount: 0,
        paidRunsTotal: 0,
        adjustmentsCount: 0,
        adjustmentsTotal: 0,
        addAdjustmentsTotal: 0,
        deductAdjustmentsTotal: 0,
        currentBalance: 0,
        lifetimeEarned: 0
      });
    }

    const item = boosterMap.get(key);
    const amount = Number(adj.amount || 0);
    item.adjustmentsCount += 1;
    if (adj.type === "deduct") {
      item.adjustmentsTotal -= amount;
      item.deductAdjustmentsTotal += amount;
    } else {
      item.adjustmentsTotal += amount;
      item.addAdjustmentsTotal += amount;
    }
  }

  // 3. Compute final current balance and lifetime earned
  const result = [];
  for (const item of boosterMap.values()) {
    // Current Balance = Unpaid Runs + Net Adjustments (Credits - Debits)
    item.currentBalance = item.openRunsTotal + item.adjustmentsTotal;
    // Lifetime Earned = All Runs + Add (Credit) Adjustments
    item.lifetimeEarned = item.openRunsTotal + item.paidRunsTotal + item.addAdjustmentsTotal;
    result.push(item);
  }

  // Sort by current balance descending, then by booster name
  return result.sort((a, b) => b.currentBalance - a.currentBalance || a.boosterName.localeCompare(b.boosterName));
}

export function validateAdjustmentPayload({ boosterName, type, amount, note, date }) {
  if (!boosterName || !String(boosterName).trim()) {
    throw new Error("Booster name is required.");
  }
  if (type !== "add" && type !== "deduct") {
    throw new Error("Adjustment type must be 'add' or 'deduct'.");
  }
  const numericAmount = Number(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error("Adjustment amount must be a positive number greater than 0.");
  }
  if (!note || !String(note).trim()) {
    throw new Error("Reason / note is required for balance adjustments.");
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Date must be in YYYY-MM-DD format.");
  }
}
