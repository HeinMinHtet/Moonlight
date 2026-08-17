export function buildSupplierSummary(records, options = {}) {
  const includePaid = Boolean(options.includePaid);
  const rowsByServiceAndRate = new Map();
  for (const record of records) {
    if (!record.correct || (!includePaid && record.paid)) continue;
    const type = record.serviceType || "Unknown service";
    const rateAtRecord = Number(record.rateAtRecord || 0);
    const key = `${type}\u0000${rateAtRecord}`;
    const existing = rowsByServiceAndRate.get(key) || {
      type,
      price: rateAtRecord,
      totalQty: 0,
      totalCost: 0
    };
    existing.totalQty += Number(record.quantity || 0);
    existing.totalCost += Number(record.totalCost || 0);
    rowsByServiceAndRate.set(key, existing);
  }

  return [...rowsByServiceAndRate.values()]
    .filter((row) => Number(row.totalQty || 0) > 0)
    .sort((a, b) => a.type.localeCompare(b.type) || Number(a.price || 0) - Number(b.price || 0));
}

export function supplierBatchWarnings(records) {
  const warnings = [];
  if (records.some((record) => !String(record.note || "").trim())) warnings.push("One or more selected rows have no note.");
  if (records.some((record) => Number(record.totalCost || 0) <= 0)) warnings.push("One or more selected rows have a zero amount.");
  if (records.some((record) => Number(record.quantity || 0) > 20)) warnings.push("One or more selected rows have an unusually high quantity.");
  return warnings;
}
