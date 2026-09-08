import { exportSupplierReport } from "../utils/exportSupplierReport.js";
import { buildSupplierSummary } from "../utils/supplierBatch.js";
import { money } from "../utils/format.js";

export function useSupplierActions({
  request,
  runAction,
  setData,
  setEditing,
  setSupplierFormKey,
  setWithdrawalFormKey,
  loadSupplier,
  showToast,
  askConfirm,
  verifiedUnpaidSupplierRows,
  supplierGrandTotal,
  supplierSummary,
  supplierWithdrawals,
  supplierRecords
}) {
  const submitSupplierRecord = (event) => runAction(async () => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await request("/api/supplier-records", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    setSupplierFormKey((key) => key + 1);
    await loadSupplier();
    showToast("Sales record saved.");
  });

  const patchSupplierRecord = (id, body, message = "Sales record updated.") => runAction(async () => {
    await request(`/api/supplier-records/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    setEditing(null);
    await loadSupplier();
    showToast(message);
  });

  const deleteSupplierRecord = (record) => runAction(async () => {
    const confirmed = await askConfirm({
      title: "Delete sales record?",
      body: "This removes the row from the unpaid supplier ledger. This action cannot be undone from the UI.",
      confirmLabel: "Delete record",
      dangerous: true
    });
    if (!confirmed) return;
    await request(`/api/supplier-records/${record.id}`, { method: "DELETE" });
    await loadSupplier();
    showToast("Sales record deleted.");
  });

  const verifyAllSupplierSales = (unverifiedRows) => runAction(async () => {
    const rowsToVerify = unverifiedRows || supplierRecords.filter((record) => !record.correct && !record.paid);
    if (!rowsToVerify.length) return showToast("No unverified unpaid sales to verify.");
    const confirmed = await askConfirm({
      title: "Verify all unpaid sales?",
      body: `${rowsToVerify.length} unverified sales record${rowsToVerify.length === 1 ? "" : "s"} will be marked as verified.`,
      confirmLabel: "Verify all"
    });
    if (!confirmed) return;
    const payload = await request("/api/supplier-records/verify-all", {
      method: "POST",
      body: JSON.stringify({ ids: rowsToVerify.map((record) => record.id) })
    });
    setData((current) => ({
      ...current,
      supplierRecords: payload.records || [],
      supplierHistory: payload.paidRecords || [],
      supplierSummary: payload.summary || [],
      supplierWithdrawals: payload.withdrawals || []
    }));
    showToast(`${payload.verifiedCount || rowsToVerify.length} sales records marked verified.`);
  });

  const unverifyAllSupplierSales = (verifiedRows) => runAction(async () => {
    const rowsToUnverify = verifiedRows || supplierRecords.filter((record) => record.correct && !record.paid);
    if (!rowsToUnverify.length) return showToast("No verified unpaid sales to unverify.");
    const confirmed = await askConfirm({
      title: "Unverify all unpaid sales?",
      body: `${rowsToUnverify.length} verified sales record${rowsToUnverify.length === 1 ? "" : "s"} will be marked as unverified.`,
      confirmLabel: "Unverify all"
    });
    if (!confirmed) return;
    const payload = await request("/api/supplier-records/unverify-all", {
      method: "POST",
      body: JSON.stringify({ ids: rowsToUnverify.map((record) => record.id) })
    });
    setData((current) => ({
      ...current,
      supplierRecords: payload.records || [],
      supplierHistory: payload.paidRecords || [],
      supplierSummary: payload.summary || [],
      supplierWithdrawals: payload.withdrawals || []
    }));
    showToast(`${payload.unverifiedCount || rowsToUnverify.length} sales records marked unverified.`);
  });

  const markSupplierPaid = (batchRows = verifiedUnpaidSupplierRows, options = {}) => runAction(async () => {
    if (!batchRows.length) return showToast("No verified unpaid sales to mark paid.");
    const settleWithdrawals = options.settleWithdrawals !== false;
    const payload = await request("/api/supplier-records/mark-paid", {
      method: "POST",
      body: JSON.stringify({
        ids: batchRows.map((record) => record.id),
        settleWithdrawals
      })
    });
    setData((current) => ({
      ...current,
      supplierRecords: payload.records || [],
      supplierHistory: payload.paidRecords || [],
      supplierSummary: payload.summary || [],
      supplierWithdrawals: payload.withdrawals || []
    }));
    const settlementMsg = settleWithdrawals ? " with withdraw balance settled" : " without settling withdraw balance";
    showToast(`${payload.paidCount || batchRows.length} supplier records moved to paid history${settlementMsg}.`);
  });

  const exportSupplierPng = (
    batchRows = verifiedUnpaidSupplierRows,
    batchSummary = supplierSummary,
    batchTotal = supplierGrandTotal,
    withdrawals = supplierWithdrawals,
    options = {}
  ) => runAction(async () => {
    if (!batchRows.length) return showToast("No verified unpaid sales to export.");
    const activeWithdrawals = (withdrawals || []).filter((w) => !w.settled && Number(w.amount || 0) > 0);
    await exportSupplierReport(batchRows, batchSummary, batchTotal, {
      withdrawals: activeWithdrawals,
      totalLabel: "FINAL SETTLED AMOUNT",
      ...options
    });
    showToast("Supplier report exported.");
  });

  const exportPaidSupplierBatch = (batch, options = {}) => runAction(async () => {
    if (!batch?.records?.length) return showToast("This paid batch has no records to export.");
    const summary = buildSupplierSummary(batch.records, { includePaid: true });
    const batchWithdrawals = (supplierWithdrawals || []).filter(
      (w) => w.settlementBatchId === batch.id && Number(w.amount || 0) > 0
    );
    await exportSupplierReport(batch.records, summary, batch.total, {
      title: "Paid Supplier Batch",
      totalLabel: "FINAL SETTLED AMOUNT",
      batchLabel: `Batch ${batch.id}`,
      withdrawals: batchWithdrawals,
      ...options
    });
    showToast("Paid batch exported.");
  });

  const reopenSupplierPaymentBatch = (batch) => runAction(async () => {
    if (!batch?.id || !batch.records?.length) return showToast("This paid batch is no longer available.");
    const confirmed = await askConfirm({
      title: "Reopen this supplier payment?",
      body: `${batch.records.length} paid sales record${batch.records.length === 1 ? "" : "s"} totaling ${money(batch.total)} will return to unpaid sales. Saved rates and sale details will not change.`,
      confirmLabel: "Reopen payment",
      dangerous: true
    });
    if (!confirmed) return;
    const payload = await request(`/api/supplier-payment-batches/${encodeURIComponent(batch.id)}/reopen`, { method: "POST" });
    setData((current) => ({
      ...current,
      supplierRecords: payload.records || [],
      supplierHistory: payload.paidRecords || [],
      supplierSummary: payload.summary || [],
      supplierWithdrawals: payload.withdrawals || []
    }));
    showToast(`${payload.reopenedCount || batch.records.length} sales records returned to unpaid sales.`);
  });

  const submitSupplierWithdrawal = (event) => runAction(async () => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    body.amount = Number(body.amount);
    const payload = await request("/api/supplier-withdrawals", {
      method: "POST",
      body: JSON.stringify(body)
    });
    setWithdrawalFormKey((key) => key + 1);
    setData((current) => ({
      ...current,
      supplierWithdrawals: payload.withdrawals || [payload.withdrawal, ...current.supplierWithdrawals]
    }));
    showToast(`Pre-withdrawal of ${money(body.amount)} for ${body.charName} recorded.`);
  });

  const patchSupplierWithdrawal = (id, body, message = "Pre-withdrawal updated.") => runAction(async () => {
    const payload = await request(`/api/supplier-withdrawals/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    setEditing(null);
    setData((current) => ({
      ...current,
      supplierWithdrawals: payload.withdrawals || current.supplierWithdrawals.map((w) => (w.id === id ? payload.withdrawal : w))
    }));
    showToast(message);
  });

  const deleteSupplierWithdrawal = (withdrawal) => runAction(async () => {
    const confirmed = await askConfirm({
      title: "Delete pre-withdrawal?",
      body: `This removes the ${money(withdrawal.amount)} withdrawal for ${withdrawal.charName}. This action cannot be undone.`,
      confirmLabel: "Delete withdrawal",
      dangerous: true
    });
    if (!confirmed) return;
    const payload = await request(`/api/supplier-withdrawals/${withdrawal.id}`, { method: "DELETE" });
    setData((current) => ({
      ...current,
      supplierWithdrawals: payload.withdrawals || current.supplierWithdrawals.filter((w) => w.id !== withdrawal.id)
    }));
    showToast("Pre-withdrawal deleted.");
  });

  return {
    submitSupplierRecord,
    patchSupplierRecord,
    deleteSupplierRecord,
    verifyAllSupplierSales,
    unverifyAllSupplierSales,
    markSupplierPaid,
    exportSupplierPng,
    exportPaidSupplierBatch,
    reopenSupplierPaymentBatch,
    submitSupplierWithdrawal,
    patchSupplierWithdrawal,
    deleteSupplierWithdrawal
  };
}
