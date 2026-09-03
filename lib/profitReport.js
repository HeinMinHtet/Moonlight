export function validIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function getWeekStart(isoDateString) {
  if (!validIsoDate(isoDateString)) return "";
  const date = new Date(`${isoDateString}T00:00:00.000Z`);
  const day = date.getUTCDay(); // 0 is Sunday, 1 is Monday, ...
  const diff = (day === 0 ? -6 : 1) - day; // Adjust to Monday
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

export function getWeekEnd(weekStartDateString) {
  if (!validIsoDate(weekStartDateString)) return "";
  const date = new Date(`${weekStartDateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 6);
  return date.toISOString().slice(0, 10);
}

export const THAILAND_TIMEZONE = "Asia/Bangkok";

export function round2(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function formatThailandDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: THAILAND_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function paidDateForReport(record) {
  if (!record.paid) return "";
  if (!record.paidAt) return "";
  const raw = String(record.paidAt);
  let dateStr = "";
  if (raw.includes("T") || raw.includes(" ") || raw.endsWith("Z")) {
    dateStr = formatThailandDate(raw);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    dateStr = raw;
  }
  return validIsoDate(dateStr) ? dateStr : "";
}

function settledDateForReport(adj) {
  if (!adj.settled) return "";
  const target = adj.settledAt || adj.date;
  if (!target) return "";
  const raw = String(target);
  let dateStr = "";
  if (raw.includes("T") || raw.includes(" ") || raw.endsWith("Z")) {
    dateStr = formatThailandDate(raw);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    dateStr = raw;
  }
  return validIsoDate(dateStr) ? dateStr : "";
}

function expenseDateForReport(expense) {
  const expenseDate = String(expense?.date || "").slice(0, 10);
  return validIsoDate(expenseDate) ? expenseDate : "";
}

export function buildProfitReport(db, from, to, groupBy = "weekly") {
  const periods = new Map();
  const periodKey = (date) => {
    if (groupBy === "monthly") return date.slice(0, 7);
    if (groupBy === "weekly") return getWeekStart(date);
    return date;
  };
  const rowFor = (date) => {
    const key = periodKey(date);
    const existing = periods.get(key) || {
      period: key,
      supplierPaidTotal: 0,
      boosterPayoutTotal: 0,
      externalExpenseTotal: 0,
      raidPaymentTotal: 0,
      outsourcePaymentTotal: 0,
      netProfit: 0,
      supplierRecordCount: 0,
      boosterRecordCount: 0,
      externalExpenseCount: 0
    };
    periods.set(key, existing);
    return existing;
  };

  for (const record of (db.supplierRecords || [])) {
    const paidDate = paidDateForReport(record);
    if (!paidDate || paidDate < from || paidDate > to) continue;
    const row = rowFor(paidDate);
    row.supplierPaidTotal += Number(record.totalCost || 0);
    row.supplierRecordCount += 1;
  }

  for (const record of (db.boosterRecords || [])) {
    const paidDate = paidDateForReport(record);
    if (!paidDate || paidDate < from || paidDate > to) continue;
    const row = rowFor(paidDate);
    row.boosterPayoutTotal += Number(record.totalBalance || 0);
    row.boosterRecordCount += 1;
  }

  for (const adj of (db.boosterAdjustments || [])) {
    const settledDate = settledDateForReport(adj);
    if (!settledDate || settledDate < from || settledDate > to) continue;
    const row = rowFor(settledDate);
    const amount = Number(adj.amount || 0);
    if (adj.type === "add") {
      row.boosterPayoutTotal += amount;
    } else if (adj.type === "deduct") {
      row.boosterPayoutTotal -= amount;
    }
  }

  for (const expense of (db.externalExpenses || [])) {
    const expenseDate = expenseDateForReport(expense);
    if (!expenseDate || expenseDate < from || expenseDate > to) continue;
    const row = rowFor(expenseDate);
    const amount = Number(expense.amount || 0);
    row.externalExpenseTotal += amount;
    row.externalExpenseCount += 1;
    const cat = String(expense.category || "").toLowerCase();
    if (cat.includes("raid")) {
      row.raidPaymentTotal += amount;
    } else if (cat.includes("outsource") || cat.includes("m+")) {
      row.outsourcePaymentTotal += amount;
    }
  }

  const rows = [...periods.values()]
    .map((row) => ({
      ...row,
      supplierPaidTotal: round2(row.supplierPaidTotal),
      boosterPayoutTotal: round2(row.boosterPayoutTotal),
      externalExpenseTotal: round2(row.externalExpenseTotal),
      raidPaymentTotal: round2(row.raidPaymentTotal),
      outsourcePaymentTotal: round2(row.outsourcePaymentTotal),
      netProfit: round2(row.supplierPaidTotal - row.boosterPayoutTotal - row.externalExpenseTotal)
    }))
    .sort((a, b) => b.period.localeCompare(a.period));

  const totals = rows.reduce((result, row) => ({
    supplierPaidTotal: round2(result.supplierPaidTotal + row.supplierPaidTotal),
    boosterPayoutTotal: round2(result.boosterPayoutTotal + row.boosterPayoutTotal),
    externalExpenseTotal: round2(result.externalExpenseTotal + row.externalExpenseTotal),
    raidPaymentTotal: round2(result.raidPaymentTotal + row.raidPaymentTotal),
    outsourcePaymentTotal: round2(result.outsourcePaymentTotal + row.outsourcePaymentTotal),
    netProfit: round2(result.netProfit + row.netProfit),
    supplierRecordCount: result.supplierRecordCount + row.supplierRecordCount,
    boosterRecordCount: result.boosterRecordCount + row.boosterRecordCount,
    externalExpenseCount: result.externalExpenseCount + row.externalExpenseCount
  }), {
    supplierPaidTotal: 0,
    boosterPayoutTotal: 0,
    externalExpenseTotal: 0,
    raidPaymentTotal: 0,
    outsourcePaymentTotal: 0,
    netProfit: 0,
    supplierRecordCount: 0,
    boosterRecordCount: 0,
    externalExpenseCount: 0
  });

  return { range: { from, to }, groupBy, totals, rows };
}
