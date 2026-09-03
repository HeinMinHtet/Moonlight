/**
 * Pure calculation helpers for Booster Balances and Adjustments
 */

export function round2(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function getBoosterAccountKey(discordId, boosterName) {
  const dId = String(discordId || "").trim();
  const name = String(boosterName || "").trim().toLowerCase();
  if (dId.startsWith("outsourced:")) {
    const stripped = dId.replace(/^outsourced:/, "").trim().toLowerCase();
    return stripped || name || "unknown";
  }
  if (dId && !dId.toLowerCase().startsWith("outsourced:")) {
    if (name && dId.toLowerCase() === name) {
      return name;
    }
    return dId;
  }
  return name || "unknown";
}

export function calculateBoosterBalances(records = [], adjustments = []) {
  const boosterMap = new Map();
  const nameToKey = new Map();

  // 1. Process payout records
  for (const record of records) {
    const key = getBoosterAccountKey(record.discordId, record.boosterName);
    const nameLower = String(record.boosterName || "").trim().toLowerCase();
    if (nameLower && !nameToKey.has(nameLower)) {
      nameToKey.set(nameLower, key);
    }

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
    if (!item.discordId && record.discordId) item.discordId = record.discordId;
    if (item.boosterName === "Unknown booster" && record.boosterName) item.boosterName = record.boosterName;

    const amount = Number(record.totalBalance || 0);
    if (record.paid) {
      item.paidRunsCount += 1;
      item.paidRunsTotal = round2(item.paidRunsTotal + amount);
    } else {
      item.openRunsCount += 1;
      item.openRunsTotal = round2(item.openRunsTotal + amount);
    }
  }

  // 2. Process manual balance adjustments (active vs settled)
  for (const adj of adjustments) {
    let key = getBoosterAccountKey(adj.discordId, adj.boosterName);
    const nameLower = String(adj.boosterName || "").trim().toLowerCase();
    if (!boosterMap.has(key) && nameToKey.has(nameLower)) {
      key = nameToKey.get(nameLower);
    }

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
      if (nameLower && !nameToKey.has(nameLower)) {
        nameToKey.set(nameLower, key);
      }
    }

    const item = boosterMap.get(key);
    if (!item.discordId && adj.discordId) item.discordId = adj.discordId;
    if (item.boosterName === "Unknown booster" && adj.boosterName) item.boosterName = adj.boosterName;

    const amount = Number(adj.amount || 0);
    const isSettled = Boolean(adj.settled);

    // Lifetime earned includes all credit adjustments (active and settled)
    if (adj.type === "add") {
      item.lifetimeEarned = round2(item.lifetimeEarned + amount);
    }

    // Only active (unsettled) adjustments affect current balance
    if (!isSettled) {
      item.adjustmentsCount += 1;
      if (adj.type === "deduct") {
        item.adjustmentsTotal = round2(item.adjustmentsTotal - amount);
        item.deductAdjustmentsTotal = round2(item.deductAdjustmentsTotal + amount);
      } else {
        item.adjustmentsTotal = round2(item.adjustmentsTotal + amount);
        item.addAdjustmentsTotal = round2(item.addAdjustmentsTotal + amount);
      }
    }
  }

  // 3. Compute final current balance and lifetime earned
  const result = [];
  for (const item of boosterMap.values()) {
    // Current Balance = Unpaid Runs + Net Active Adjustments (Credits - Debits)
    item.currentBalance = round2(item.openRunsTotal + item.adjustmentsTotal);
    // Lifetime Earned = All Runs (open + paid) + Lifetime Credit Adjustments
    item.lifetimeEarned = round2(item.lifetimeEarned + item.openRunsTotal + item.paidRunsTotal);
    result.push(item);
  }

  // Sort by current balance descending, then by booster name
  return result.sort((a, b) => b.currentBalance - a.currentBalance || a.boosterName.localeCompare(b.boosterName));
}

export function calculateBoosterSettlement(boosterSummary, openRecords = [], activeAdjustments = [], rate = 0) {
  const openRunsTotal = round2(openRecords.reduce((sum, r) => sum + Number(r.totalBalance || 0), 0));
  const addAdjustments = activeAdjustments.filter((a) => a.type === "add" && !a.settled);
  const deductAdjustments = activeAdjustments.filter((a) => a.type === "deduct" && !a.settled);

  const addAdjustmentsTotal = round2(addAdjustments.reduce((sum, a) => sum + Number(a.amount || 0), 0));
  const deductAdjustmentsTotal = round2(deductAdjustments.reduce((sum, a) => sum + Number(a.amount || 0), 0));
  const netAdjustmentsTotal = round2(addAdjustmentsTotal - deductAdjustmentsTotal);

  const currentBalance = round2(openRunsTotal + netAdjustmentsTotal);
  const isDeficit = currentBalance < 0;
  const netPayoutAmount = Math.max(0, currentBalance);
  const debtOffsetAmount = isDeficit ? openRunsTotal : deductAdjustmentsTotal;
  const remainingDebt = isDeficit ? round2(Math.abs(currentBalance)) : 0;
  const numericRate = Number(rate) || 0;
  const cashAmountMmk = Math.round((netPayoutAmount * numericRate) + Number.EPSILON);

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
  const nameToKey = new Map();

  for (const tx of vaultTransactions) {
    let key = getBoosterAccountKey(tx.discordId, tx.boosterName);
    const nameLower = String(tx.boosterName || "").trim().toLowerCase();
    if (!vaultMap.has(key) && nameToKey.has(nameLower)) {
      key = nameToKey.get(nameLower);
    }
    if (!vaultMap.has(key)) {
      vaultMap.set(key, {
        discordId: tx.discordId || "",
        boosterName: tx.boosterName || "Unknown booster",
        totalDeposited: 0,
        totalWithdrawn: 0,
        currentVaultBalance: 0,
        transactionsCount: 0
      });
      if (nameLower) nameToKey.set(nameLower, key);
    }

    const item = vaultMap.get(key);
    const amount = Number(tx.amount || 0);
    item.transactionsCount += 1;
    if (tx.type === "deposit") {
      item.totalDeposited = round2(item.totalDeposited + amount);
    } else if (tx.type === "withdraw") {
      item.totalWithdrawn = round2(item.totalWithdrawn + amount);
    }
  }

  const result = [];
  for (const item of vaultMap.values()) {
    item.currentVaultBalance = round2(item.totalDeposited - item.totalWithdrawn);
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
