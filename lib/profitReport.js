export function validIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function paidDateForReport(record) {
  if (!record.paid) return "";
  const paidDate = String(record.paidAt || "").slice(0, 10);
  return validIsoDate(paidDate) ? paidDate : "";
}

export function buildProfitReport(db, from, to, groupBy) {
  const periods = new Map();
  const periodKey = (date) => groupBy === "monthly" ? date.slice(0, 7) : date;
  const rowFor = (date) => {
    const key = periodKey(date);
    const existing = periods.get(key) || {
      period: key,
      supplierPaidTotal: 0,
      boosterPayoutTotal: 0,
      netProfit: 0,
      supplierRecordCount: 0,
      boosterRecordCount: 0
    };
    periods.set(key, existing);
    return existing;
  };

  for (const record of db.supplierRecords) {
    const paidDate = paidDateForReport(record);
    if (!paidDate || paidDate < from || paidDate > to) continue;
    const row = rowFor(paidDate);
    row.supplierPaidTotal += Number(record.totalCost || 0);
    row.supplierRecordCount += 1;
  }

  for (const record of db.boosterRecords) {
    const paidDate = paidDateForReport(record);
    if (!paidDate || paidDate < from || paidDate > to) continue;
    const row = rowFor(paidDate);
    row.boosterPayoutTotal += Number(record.totalBalance || 0);
    row.boosterRecordCount += 1;
  }

  const rows = [...periods.values()]
    .map((row) => ({ ...row, netProfit: row.supplierPaidTotal - row.boosterPayoutTotal }))
    .sort((a, b) => b.period.localeCompare(a.period));
  const totals = rows.reduce((result, row) => ({
    supplierPaidTotal: result.supplierPaidTotal + row.supplierPaidTotal,
    boosterPayoutTotal: result.boosterPayoutTotal + row.boosterPayoutTotal,
    netProfit: result.netProfit + row.netProfit,
    supplierRecordCount: result.supplierRecordCount + row.supplierRecordCount,
    boosterRecordCount: result.boosterRecordCount + row.boosterRecordCount
  }), {
    supplierPaidTotal: 0,
    boosterPayoutTotal: 0,
    netProfit: 0,
    supplierRecordCount: 0,
    boosterRecordCount: 0
  });

  return { range: { from, to }, groupBy, totals, rows };
}
