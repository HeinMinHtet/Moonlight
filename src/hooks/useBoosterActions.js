import { mmk, money } from "../utils/format.js";

export function useBoosterActions({
  request,
  runAction,
  setData,
  setEditing,
  setBoosterFormKey,
  loadBoosters,
  showToast,
  askConfirm
}) {
  const submitBoosterRecord = (event) => runAction(async () => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await request("/api/booster-records", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    setBoosterFormKey((key) => key + 1);
    await loadBoosters();
    showToast("Run payout recorded.");
  });

  const patchBoosterRecord = (id, body, message = "Payout row updated.") => runAction(async () => {
    await request(`/api/booster-records/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    setEditing(null);
    await loadBoosters();
    showToast(message);
  });

  const deleteBoosterRecord = (record) => runAction(async () => {
    const confirmed = await askConfirm({
      title: "Delete payout row?",
      body: "This removes the payout row from the ledger. This action cannot be undone from the UI.",
      confirmLabel: "Delete row",
      dangerous: true
    });
    if (!confirmed) return;
    await request(`/api/booster-records/${record.id}`, { method: "DELETE" });
    await loadBoosters();
    showToast("Payout row deleted.");
  });

  const markBoosterPaid = (rows) => runAction(async () => {
    if (!rows?.length) return showToast("Select at least one open booster payout row.");
    const total = rows.reduce((sum, record) => sum + Number(record.totalBalance || 0), 0);
    const warnings = [];
    if (rows.some((record) => !String(record.note || "").trim())) warnings.push("Some selected rows have no note.");
    if (rows.some((record) => Number(record.totalBalance || 0) <= 0)) warnings.push("Some selected rows have a zero payout.");
    if (rows.some((record) => Number(record.quantity || 0) > 20)) warnings.push("Some selected rows have an unusually high run count.");
    const confirmed = await askConfirm({
      title: "Mark selected booster payouts paid?",
      body: `${rows.length} payout row${rows.length === 1 ? "" : "s"} totaling ${money(total)} will move to paid history.${warnings.length ? ` Review warning: ${warnings.join(" ")}` : ""}`,
      confirmLabel: "Mark payouts paid"
    });
    if (!confirmed) return;
    const payload = await request("/api/booster-records/mark-paid", {
      method: "POST",
      body: JSON.stringify({ ids: rows.map((record) => record.id) })
    });
    setData((current) => ({
      ...current,
      boosterRecords: payload.records || [],
      boosterSummary: payload.summary || [],
      boosterAdjustments: payload.adjustments || current.boosterAdjustments
    }));
    showToast(`${payload.paidCount || rows.length} booster payout rows marked paid.`);
  });

  const settleBooster = (boosterData) => runAction(async () => {
    const payload = await request("/api/booster-records/settle", {
      method: "POST",
      body: JSON.stringify(boosterData)
    });
    setData((current) => ({
      ...current,
      boosterRecords: payload.records || [],
      boosterSummary: payload.summary || [],
      boosterAdjustments: payload.adjustments || current.boosterAdjustments,
      boosterCashVault: payload.vaultTransactions || current.boosterCashVault
    }));
    let message = "";
    if (payload.action === "hold_cash" && payload.cashAmountMmk > 0) {
      message = `Settled ${payload.settledCount} runs. Stored ${mmk(payload.cashAmountMmk)} (${money(payload.netPayoutAmount)} gold @ ${payload.rate} MMK) in vault.`;
    } else if (payload.netPayoutAmount > 0) {
      message = `Settlement complete. Paid ${payload.rate > 0 ? mmk(payload.cashAmountMmk) : money(payload.netPayoutAmount)} (${payload.settledCount} runs settled).`;
    } else {
      message = `Settlement complete. ${payload.settledCount} runs applied to offset debt.`;
    }
    showToast(message);
  });

  const withdrawBoosterVaultCash = (withdrawalData) => runAction(async () => {
    const payload = await request("/api/booster-cash-vault/withdraw", {
      method: "POST",
      body: JSON.stringify(withdrawalData)
    });
    setData((current) => ({
      ...current,
      boosterCashVault: payload.vaultTransactions || current.boosterCashVault
    }));
    showToast(`Released ${mmk(withdrawalData.amount)} to ${withdrawalData.boosterName}.`);
  });

  const addBoosterAdjustment = (adjustmentData) => runAction(async () => {
    const payload = await request("/api/booster-adjustments", {
      method: "POST",
      body: JSON.stringify(adjustmentData)
    });
    setData((current) => ({
      ...current,
      boosterAdjustments: payload.adjustments || [payload.adjustment, ...current.boosterAdjustments]
    }));
    showToast(`Balance adjustment of ${adjustmentData.type === "add" ? "+" : "-"}${money(adjustmentData.amount)} saved for ${adjustmentData.boosterName}.`);
  });

  const updateBoosterAdjustment = (id, patch) => runAction(async () => {
    const payload = await request(`/api/booster-adjustments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    setData((current) => ({
      ...current,
      boosterAdjustments: payload.adjustments || current.boosterAdjustments.map((a) => (a.id === id ? payload.adjustment : a))
    }));
    showToast("Balance adjustment updated.");
  });

  const deleteBoosterAdjustment = (id) => runAction(async () => {
    const payload = await request(`/api/booster-adjustments/${id}`, {
      method: "DELETE"
    });
    setData((current) => ({
      ...current,
      boosterAdjustments: payload.adjustments || current.boosterAdjustments.filter((a) => a.id !== id)
    }));
    showToast("Balance adjustment removed.");
  });

  return {
    submitBoosterRecord,
    patchBoosterRecord,
    deleteBoosterRecord,
    markBoosterPaid,
    settleBooster,
    withdrawBoosterVaultCash,
    addBoosterAdjustment,
    updateBoosterAdjustment,
    deleteBoosterAdjustment
  };
}
