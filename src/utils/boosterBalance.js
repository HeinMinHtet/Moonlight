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

  // 2. Process manual balance adjustments (active vs settled)
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
    const isSettled = Boolean(adj.settled);

    // Lifetime earned includes all credit adjustments (active and settled)
    if (adj.type === "add") {
      item.lifetimeEarned += amount;
    }

    // Only active (unsettled) adjustments affect current balance
    if (!isSettled) {
      item.adjustmentsCount += 1;
      if (adj.type === "deduct") {
        item.adjustmentsTotal -= amount;
        item.deductAdjustmentsTotal += amount;
      } else {
        item.adjustmentsTotal += amount;
        item.addAdjustmentsTotal += amount;
      }
    }
  }

  // 3. Compute final current balance and lifetime earned
  const result = [];
  for (const item of boosterMap.values()) {
    // Current Balance = Unpaid Runs + Net Active Adjustments (Credits - Debits)
    item.currentBalance = item.openRunsTotal + item.adjustmentsTotal;
    // Lifetime Earned = All Runs (open + paid) + Lifetime Credit Adjustments
    item.lifetimeEarned += item.openRunsTotal + item.paidRunsTotal;
    result.push(item);
  }

  // Sort by current balance descending, then by booster name
  return result.sort((a, b) => b.currentBalance - a.currentBalance || a.boosterName.localeCompare(b.boosterName));
}

export function calculateBoosterSettlement(boosterSummary, openRecords = [], activeAdjustments = [], rate = 0) {
  const openRunsTotal = openRecords.reduce((sum, r) => sum + Number(r.totalBalance || 0), 0);
  const addAdjustments = activeAdjustments.filter((a) => a.type === "add" && !a.settled);
  const deductAdjustments = activeAdjustments.filter((a) => a.type === "deduct" && !a.settled);

  const addAdjustmentsTotal = addAdjustments.reduce((sum, a) => sum + Number(a.amount || 0), 0);
  const deductAdjustmentsTotal = deductAdjustments.reduce((sum, a) => sum + Number(a.amount || 0), 0);
  const netAdjustmentsTotal = addAdjustmentsTotal - deductAdjustmentsTotal;

  const currentBalance = openRunsTotal + netAdjustmentsTotal;
  const isDeficit = currentBalance < 0;
  const netPayoutAmount = Math.max(0, currentBalance);
  const debtOffsetAmount = isDeficit ? openRunsTotal : deductAdjustmentsTotal;
  const remainingDebt = isDeficit ? Math.abs(currentBalance) : 0;
  const numericRate = Number(rate) || 0;
  const cashAmountMmk = netPayoutAmount * numericRate;

  return {
    openRunsCount: openRecords.length,
    openRunsTotal,
    addAdjustmentsCount: addAdjustments.length,
    addAdjustmentsTotal,
    deductAdjustmentsCount: deductAdjustments.length,
    deductAdjustmentsTotal,
    netAdjustmentsTotal,
    currentBalance,
    isDeficit,
    netPayoutAmount,
    debtOffsetAmount,
    remainingDebt,
    rate: numericRate,
    cashAmountMmk
  };
}

export function calculateBoosterVaultBalances(vaultTransactions = []) {
  const vaultMap = new Map();

  for (const tx of vaultTransactions) {
    const key = tx.discordId || tx.boosterName || "unknown";
    if (!vaultMap.has(key)) {
      vaultMap.set(key, {
        discordId: tx.discordId || "",
        boosterName: tx.boosterName || "Unknown booster",
        totalDeposited: 0,
        totalWithdrawn: 0,
        currentVaultBalance: 0,
        transactionsCount: 0
      });
    }

    const item = vaultMap.get(key);
    const amount = Number(tx.amount || 0);
    item.transactionsCount += 1;
    if (tx.type === "deposit") {
      item.totalDeposited += amount;
    } else if (tx.type === "withdraw") {
      item.totalWithdrawn += amount;
    }
  }

  const result = [];
  for (const item of vaultMap.values()) {
    item.currentVaultBalance = item.totalDeposited - item.totalWithdrawn;
    result.push(item);
  }

  return result.sort((a, b) => b.currentVaultBalance - a.currentVaultBalance || a.boosterName.localeCompare(b.boosterName));
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

export function validateVaultWithdrawalPayload({ boosterName, amount, currentVaultBalance, note, date }) {
  if (!boosterName || !String(boosterName).trim()) {
    throw new Error("Booster name is required.");
  }
  const numericAmount = Number(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error("Withdrawal amount must be a positive number greater than 0.");
  }
  if (currentVaultBalance !== undefined && numericAmount > Number(currentVaultBalance || 0)) {
    throw new Error("Withdrawal amount cannot exceed the stored cash vault balance.");
  }
  if (!note || !String(note).trim()) {
    throw new Error("Payment note or channel reference is required.");
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Date must be in YYYY-MM-DD format.");
  }
}
