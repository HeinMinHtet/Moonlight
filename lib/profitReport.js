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

function paidDateForReport(record) {
  if (!record.paid) return "";
  const paidDate = String(record.paidAt || "").slice(0, 10);
  return validIsoDate(paidDate) ? paidDate : "";
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
      netProfit: row.supplierPaidTotal - row.boosterPayoutTotal - row.externalExpenseTotal
    }))
    .sort((a, b) => b.period.localeCompare(a.period));
  const totals = rows.reduce((result, row) => ({
    supplierPaidTotal: result.supplierPaidTotal + row.supplierPaidTotal,
    boosterPayoutTotal: result.boosterPayoutTotal + row.boosterPayoutTotal,
    externalExpenseTotal: result.externalExpenseTotal + row.externalExpenseTotal,
    raidPaymentTotal: result.raidPaymentTotal + row.raidPaymentTotal,
    outsourcePaymentTotal: result.outsourcePaymentTotal + row.outsourcePaymentTotal,
    netProfit: result.netProfit + row.netProfit,
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
