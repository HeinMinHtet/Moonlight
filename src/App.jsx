import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api.js";
import { AppTabs } from "./components/AppTabs.jsx";
import { ConfirmDialog } from "./components/ConfirmDialog.jsx";
import { BoosterPayoutPage } from "./components/booster/BoosterPayoutPage.jsx";
import { PriceCalculatorPage } from "./components/calculator/PriceCalculatorPage.jsx";
import { ExpensesPage } from "./components/expenses/ExpensesPage.jsx";
import { ProfitReportPage } from "./components/profit/ProfitReportPage.jsx";
import { RateSettingsPage } from "./components/rates/RateSettingsPage.jsx";
import { SupplierPaidHistoryPage } from "./components/supplier/SupplierPaidHistoryPage.jsx";
import { SupplierUnpaidPage } from "./components/supplier/SupplierUnpaidPage.jsx";
import { mmk, money } from "./utils/format.js";
import { exportSupplierReport } from "./utils/exportSupplierReport.js";
import { buildSupplierSummary, supplierBatchWarnings } from "./utils/supplierBatch.js";
import { Badge } from "@/components/ui/badge.jsx";
import { Button, buttonVariants } from "@/components/ui/button.jsx";
import { Toaster } from "@/components/ui/sonner.jsx";
import { cn } from "@/lib/utils.js";
import { toast as notify } from "sonner";

const POLL_INTERVAL_MS = 15_000;
const HIDDEN_POLL_CHECK_MS = 60_000;

const initialState = {
  user: null,
  discordConfigured: false,
  discordOAuthConfigured: false,
  discordRolesConfigured: false,
  csrfToken: null,
  permissions: {},
  supplierServices: [],
  boosterPrices: [],
  supplierGuilds: [],
  armorTypes: [],
  supplierRecords: [],
  supplierWithdrawals: [],
  supplierHistory: [],
  supplierSummary: [],
  boosterRecords: [],
  boosterSummary: [],
  boosterAdjustments: [],
  boosterCashVault: [],
  externalExpenses: []
};

export function App() {
  const [data, setData] = useState(initialState);
  const [activeTab, setActiveTab] = useState("booster");
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [confirmOptions, setConfirmOptions] = useState(null);
  const [supplierFormKey, setSupplierFormKey] = useState(0);
  const [withdrawalFormKey, setWithdrawalFormKey] = useState(0);
  const [boosterFormKey, setBoosterFormKey] = useState(0);
  const [expenseFormKey, setExpenseFormKey] = useState(0);
  const [profitRefreshVersion, setProfitRefreshVersion] = useState(0);
  const confirmResolver = useRef(null);
  const pollingRef = useRef(false);
  const foregroundActionRef = useRef(false);
  const dataVersionRef = useRef(0);

  const role = data.user?.role || "guest";
  const isAdmin = role === "admin";
  const permissions = {
    canUseSupplier: Boolean(data.permissions.supplierRecords),
    canUseBooster: Boolean(data.permissions.boosterRecords),
    canUseExpenses: Boolean(data.permissions.externalExpenses),
    canEditSupplierStatus: Boolean(data.permissions.supplierStatus),
    canMarkSupplierPaid: Boolean(data.permissions.supplierPaid),
    canReopenSupplierPaid: Boolean(data.permissions.supplierPaid),
    canDeleteSupplierRows: Boolean(data.permissions.supplierDelete),
    canEditPrices: Boolean(data.permissions.priceSettings),
    canMarkBoosterPaid: Boolean(data.permissions.boosterPaid),
    canDeleteBoosterRows: Boolean(data.permissions.boosterDelete)
  };

  const showToast = useCallback((message) => {
    notify(message);
  }, []);

  const askConfirm = useCallback((options) => new Promise((resolve) => {
    confirmResolver.current = resolve;
    setConfirmOptions(options);
  }), []);

  const closeConfirm = useCallback((confirmed) => {
    confirmResolver.current?.(confirmed);
    confirmResolver.current = null;
    setConfirmOptions(null);
  }, []);

  const request = useCallback((path, options = {}) => api(path, options, data.csrfToken), [data.csrfToken]);

  const loadSupplier = useCallback(async (activePermissions = data.permissions) => {
    if (!activePermissions.supplierRecords) {
      setData((current) => ({ ...current, supplierRecords: [], supplierHistory: [], supplierSummary: [], supplierWithdrawals: [] }));
      return;
    }
    const payload = await api("/api/supplier-records");
    setData((current) => ({
      ...current,
      supplierRecords: payload.records || [],
      supplierHistory: payload.paidRecords || [],
      supplierSummary: payload.summary || [],
      supplierWithdrawals: payload.withdrawals || []
    }));
  }, [data.permissions]);

  const loadBoosters = useCallback(async (activePermissions = data.permissions) => {
    if (!activePermissions.boosterRecords) {
      setData((current) => ({ ...current, boosterRecords: [], boosterSummary: [], boosterAdjustments: [], boosterCashVault: [] }));
      return;
    }
    const payload = await api("/api/booster-records");
    setData((current) => ({
      ...current,
      boosterRecords: payload.records || [],
      boosterSummary: payload.summary || [],
      boosterAdjustments: payload.adjustments || [],
      boosterCashVault: payload.vaultTransactions || []
    }));
  }, [data.permissions]);

  const loadExpenses = useCallback(async (activePermissions = data.permissions) => {
    if (!activePermissions.externalExpenses) {
      setData((current) => ({ ...current, externalExpenses: [] }));
      return;
    }
    const payload = await api("/api/external-expenses");
    setData((current) => ({
      ...current,
      externalExpenses: payload.expenses || []
    }));
  }, [data.permissions]);

  const pollVisibleData = useCallback(async () => {
    if (pollingRef.current || foregroundActionRef.current) return;
    pollingRef.current = true;
    const startedAtVersion = dataVersionRef.current;
    try {
      const config = await api("/api/config");
      const needsSupplier = config.permissions.supplierRecords && ["supplier", "supplierHistory", "prices", "calculator"].includes(activeTab);
      const needsBoosters = config.permissions.boosterRecords && ["booster", "prices"].includes(activeTab);
      const needsExpenses = config.permissions.externalExpenses && ["expenses", "profit"].includes(activeTab);
      const [supplierPayload, boosterPayload, expensesPayload] = await Promise.all([
        needsSupplier ? api("/api/supplier-records") : Promise.resolve(null),
        needsBoosters ? api("/api/booster-records") : Promise.resolve(null),
        needsExpenses ? api("/api/external-expenses") : Promise.resolve(null)
      ]);

      if (foregroundActionRef.current || dataVersionRef.current !== startedAtVersion) return;
      setData((current) => {
        const preserveRateDrafts = activeTab === "prices";
        return {
          ...current,
          ...config,
          supplierServices: preserveRateDrafts ? current.supplierServices : (config.supplierServices || []),
          boosterPrices: preserveRateDrafts ? current.boosterPrices : (config.boosterPrices || []),
          supplierGuilds: preserveRateDrafts ? current.supplierGuilds : (config.supplierGuilds || []),
          armorTypes: preserveRateDrafts ? current.armorTypes : (config.armorTypes || []),
          supplierRecords: supplierPayload
            ? (supplierPayload.records || [])
            : config.permissions.supplierRecords ? current.supplierRecords : [],
          supplierHistory: supplierPayload
            ? (supplierPayload.paidRecords || [])
            : config.permissions.supplierRecords ? current.supplierHistory : [],
          supplierSummary: supplierPayload
            ? (supplierPayload.summary || [])
            : config.permissions.supplierRecords ? current.supplierSummary : [],
          supplierWithdrawals: supplierPayload
            ? (supplierPayload.withdrawals || [])
            : config.permissions.supplierRecords ? current.supplierWithdrawals : [],
          boosterRecords: boosterPayload
            ? (boosterPayload.records || [])
            : config.permissions.boosterRecords ? current.boosterRecords : [],
          boosterSummary: boosterPayload
            ? (boosterPayload.summary || [])
            : config.permissions.boosterRecords ? current.boosterSummary : [],
          boosterAdjustments: boosterPayload
            ? (boosterPayload.adjustments || [])
            : config.permissions.boosterRecords ? current.boosterAdjustments : [],
          boosterCashVault: boosterPayload
            ? (boosterPayload.vaultTransactions || [])
            : config.permissions.boosterRecords ? current.boosterCashVault : [],
          externalExpenses: expensesPayload
            ? (expensesPayload.expenses || [])
            : config.permissions.externalExpenses ? current.externalExpenses : []
        };
      });
      if (activeTab === "profit" && config.user?.role === "admin") {
        setProfitRefreshVersion((version) => version + 1);
      }
    } catch {
      // Background refresh failures stay silent; foreground actions still report errors.
    } finally {
      pollingRef.current = false;
    }
  }, [activeTab]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const config = await api("/api/config");
      const [supplierPayload, boosterPayload, expensesPayload] = await Promise.all([
        config.permissions.supplierRecords ? api("/api/supplier-records") : Promise.resolve({ records: [], paidRecords: [], summary: [], withdrawals: [] }),
        config.permissions.boosterRecords ? api("/api/booster-records") : Promise.resolve({ records: [], summary: [], adjustments: [], vaultTransactions: [] }),
        config.permissions.externalExpenses ? api("/api/external-expenses") : Promise.resolve({ expenses: [] })
      ]);
      setData((current) => ({
        ...current,
        ...config,
        supplierRecords: supplierPayload.records || [],
        supplierHistory: supplierPayload.paidRecords || [],
        supplierSummary: supplierPayload.summary || [],
        supplierWithdrawals: supplierPayload.withdrawals || [],
        boosterRecords: boosterPayload.records || [],
        boosterSummary: boosterPayload.summary || [],
        boosterAdjustments: boosterPayload.adjustments || [],
        boosterCashVault: boosterPayload.vaultTransactions || [],
        externalExpenses: expensesPayload.expenses || []
      }));
      setActiveTab(config.user?.role === "admin" ? "supplier" : "booster");
    } catch (error) {
      setLoadError(error.message);
      showToast(error.message);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const authError = new URLSearchParams(window.location.search).get("authError");
    if (authError) {
      showToast(authError);
      window.history.replaceState({}, "", window.location.pathname);
    }
    refreshAll();
  }, [refreshAll, showToast]);

  useEffect(() => {
    let disposed = false;
    let timeoutId;

    const schedule = () => {
      if (disposed) return;
      timeoutId = window.setTimeout(run, document.hidden ? HIDDEN_POLL_CHECK_MS : POLL_INTERVAL_MS);
    };
    const run = async () => {
      if (!document.hidden) await pollVisibleData();
      schedule();
    };
    const handleVisibilityChange = () => {
      window.clearTimeout(timeoutId);
      if (document.hidden) schedule();
      else run();
    };

    schedule();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      disposed = true;
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pollVisibleData]);

  useEffect(() => {
    if (isAdmin) return;
    if (["supplier", "supplierHistory", "expenses", "profit", "prices", "calculator"].includes(activeTab)) setActiveTab("booster");
  }, [activeTab, isAdmin]);

  const runAction = async (action) => {
    foregroundActionRef.current = true;
    dataVersionRef.current += 1;
    try {
      await action();
      return true;
    } catch (error) {
      showToast(error.message);
      return false;
    } finally {
      foregroundActionRef.current = false;
    }
  };

  const verifiedUnpaidSupplierRows = useMemo(
    () => data.supplierRecords.filter((record) => record.correct && !record.paid),
    [data.supplierRecords]
  );

  const tabBadges = useMemo(() => {
    const unverifiedSupplierCount = data.supplierRecords.filter((r) => !r.correct && !r.paid).length;
    const boosterReviewCount = data.boosterRecords.filter(
      (r) => !r.paid && (!String(r.note || "").trim() || Number(r.totalBalance || 0) <= 0 || Number(r.quantity || 0) > 20)
    ).length;
    return {
      supplier: unverifiedSupplierCount,
      booster: boosterReviewCount
    };
  }, [data.supplierRecords, data.boosterRecords]);

  const supplierGrandTotal = useMemo(
    () => data.supplierSummary.reduce((sum, row) => sum + Number(row.totalCost || 0), 0),
    [data.supplierSummary]
  );

  const logout = () => runAction(async () => {
    await request("/api/logout", { method: "POST" });
    setData(initialState);
    setActiveTab("booster");
    await refreshAll();
  });

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
    const rowsToVerify = unverifiedRows || data.supplierRecords.filter((record) => !record.correct && !record.paid);
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
    const rowsToUnverify = verifiedRows || data.supplierRecords.filter((record) => record.correct && !record.paid);
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

  const exportSupplierPng = (batchRows = verifiedUnpaidSupplierRows, batchSummary = data.supplierSummary, batchTotal = supplierGrandTotal, withdrawals = data.supplierWithdrawals) => runAction(async () => {
    if (!batchRows.length) return showToast("No verified unpaid sales to export.");
    const activeWithdrawals = (withdrawals || []).filter((w) => !w.settled && Number(w.amount || 0) > 0);
    await exportSupplierReport(batchRows, batchSummary, batchTotal, {
      withdrawals: activeWithdrawals,
      totalLabel: "FINAL SETTLED AMOUNT"
    });
    showToast("Supplier report exported.");
  });

  const exportPaidSupplierBatch = (batch) => runAction(async () => {
    if (!batch?.records?.length) return showToast("This paid batch has no records to export.");
    const summary = buildSupplierSummary(batch.records, { includePaid: true });
    const batchWithdrawals = (data.supplierWithdrawals || []).filter(
      (w) => w.settlementBatchId === batch.id && Number(w.amount || 0) > 0
    );
    await exportSupplierReport(batch.records, summary, batch.total, {
      title: "Paid Supplier Batch",
      totalLabel: "FINAL SETTLED AMOUNT",
      batchLabel: `Batch ${batch.id}`,
      withdrawals: batchWithdrawals
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

  const submitExternalExpense = (event) => runAction(async () => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    body.amount = Number(body.amount);
    await request("/api/external-expenses", {
      method: "POST",
      body: JSON.stringify(body)
    });
    setExpenseFormKey((key) => key + 1);
    await loadExpenses();
    showToast("External expense recorded.");
  });

  const patchExternalExpense = (id, body, message = "External expense updated.") => runAction(async () => {
    const payload = await request(`/api/external-expenses/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    setEditing(null);
    setData((current) => ({
      ...current,
      externalExpenses: payload.expenses || current.externalExpenses.map((e) => (e.id === id ? payload.expense : e))
    }));
    showToast(message);
  });

  const deleteExternalExpense = (expense) => runAction(async () => {
    const confirmed = await askConfirm({
      title: "Delete external expense?",
      body: `This removes the ${money(expense.amount)} ${expense.category} (${expense.title || "expense"}). This action cannot be undone.`,
      confirmLabel: "Delete expense",
      dangerous: true
    });
    if (!confirmed) return;
    const payload = await request(`/api/external-expenses/${expense.id}`, { method: "DELETE" });
    setData((current) => ({
      ...current,
      externalExpenses: payload.expenses || current.externalExpenses.filter((e) => e.id !== expense.id)
    }));
    showToast("External expense deleted.");
  });

  const saveSupplierPrices = (event) => runAction(async () => {
    event.preventDefault();
    validateRateRows(data.supplierServices, "type", "service");
    const payload = await request("/api/prices/supplier", {
      method: "PUT",
      body: JSON.stringify({ rows: data.supplierServices })
    });
    setData((current) => ({ ...current, supplierServices: payload.supplierServices || [], supplierSummary: payload.summary || [] }));
    showToast("Supplier rates saved.");
  });

  const saveBoosterPrices = (event) => runAction(async () => {
    event.preventDefault();
    validateRateRows(data.boosterPrices, "level", "key level");
    const payload = await request("/api/prices/booster", {
      method: "PUT",
      body: JSON.stringify({ rows: data.boosterPrices })
    });
    setData((current) => ({ ...current, boosterPrices: payload.boosterPrices || [] }));
    showToast("Booster rates saved.");
  });

  const saveSupplierGuilds = (event) => runAction(async () => {
    event.preventDefault();
    validateGuildRows(data.supplierGuilds);
    const payload = await request("/api/prices/supplier-guilds", {
      method: "PUT",
      body: JSON.stringify({ rows: data.supplierGuilds })
    });
    setData((current) => ({ ...current, supplierGuilds: payload.supplierGuilds || [] }));
    showToast("Supplier guilds saved.");
  });

  const saveArmorTypes = (event) => runAction(async () => {
    event.preventDefault();
    validateArmorRows(data.armorTypes);
    const payload = await request("/api/prices/armor-types", {
      method: "PUT",
      body: JSON.stringify({ rows: data.armorTypes })
    });
    setData((current) => ({ ...current, armorTypes: payload.armorTypes || [] }));
    showToast("Armor stack options saved.");
  });

  const updatePriceRow = (collection, index, patch) => {
    setData((current) => ({
      ...current,
      [collection]: current[collection].map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    }));
  };

  const togglePriceRowStatus = (collection, index) => runAction(async () => {
    const row = data[collection][index];
    if (!row) return;
    const itemKey = collection === "supplierServices" ? "type" : "level";
    const historyRecords = collection === "supplierServices"
      ? [...data.supplierRecords, ...data.supplierHistory]
      : data.boosterRecords;
    const historyKey = collection === "supplierServices" ? "serviceType" : "level";
    const historyCount = historyRecords.filter((record) => record[historyKey] === row[itemKey]).length;
    const archiving = row.active !== false;
    if (archiving && historyCount > 0) {
      const confirmed = await askConfirm({
        title: `Archive ${row[itemKey]}?`,
        body: `${historyCount} historical record${historyCount === 1 ? " uses" : "s use"} this rate. Archiving hides it from new records but keeps every saved historical rate unchanged.`,
        confirmLabel: "Archive rate"
      });
      if (!confirmed) return;
    }
    setData((current) => ({
      ...current,
      [collection]: current[collection].map((item, rowIndex) => (
        rowIndex === index ? { ...item, active: !archiving } : item
      ))
    }));
    showToast(archiving ? "Rate marked for archive. Save changes to apply." : "Rate restored. Save changes to apply.");
  });

  const deletePriceRow = (collection, index) => {
    const row = data[collection][index];
    if (!row) return;
    setData((current) => ({
      ...current,
      [collection]: current[collection].filter((_, rowIndex) => rowIndex !== index)
    }));
    showToast("Rate row removed. Save changes to apply.");
  };

  const setDefaultPriceRow = (collection, index) => {
    setData((current) => {
      const currentRows = current[collection] || [];
      const targetRow = currentRows[index];
      if (!targetRow) return current;
      const willBeDefault = !targetRow.isDefault;
      return {
        ...current,
        [collection]: currentRows.map((row, rowIndex) => ({
          ...row,
          isDefault: rowIndex === index ? willBeDefault : false
        }))
      };
    });
  };

  const addPriceRow = (collection, key) => {
    if (!permissions.canEditPrices) return showToast("Discord admin role is required to edit rates.");
    setData((current) => ({ ...current, [collection]: [...current[collection], { [key]: "", price: 0, active: true }] }));
  };

  const addGuildRow = () => {
    if (!permissions.canEditPrices) return showToast("Discord admin role is required to edit guilds.");
    setData((current) => ({
      ...current,
      supplierGuilds: [...(current.supplierGuilds || []), { name: "", active: true, isDefault: false }]
    }));
  };

  const updateGuildRow = (index, patch) => {
    setData((current) => ({
      ...current,
      supplierGuilds: (current.supplierGuilds || []).map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    }));
  };

  const toggleGuildRowStatus = (index) => runAction(async () => {
    const row = (data.supplierGuilds || [])[index];
    if (!row) return;
    const historyCount = (data.supplierWithdrawals || []).filter((w) => w.guild === row.name).length;
    const archiving = row.active !== false;
    if (archiving && historyCount > 0) {
      const confirmed = await askConfirm({
        title: `Archive ${row.name}?`,
        body: `${historyCount} withdrawal record${historyCount === 1 ? " uses" : "s use"} this guild. Archiving hides it from new withdrawals but keeps existing withdrawals unchanged.`,
        confirmLabel: "Archive guild"
      });
      if (!confirmed) return;
    }
    setData((current) => ({
      ...current,
      supplierGuilds: current.supplierGuilds.map((item, rowIndex) => (
        rowIndex === index ? { ...item, active: !archiving } : item
      ))
    }));
    showToast(archiving ? "Guild marked for archive. Save changes to apply." : "Guild restored. Save changes to apply.");
  });

  const deleteGuildRow = (index) => {
    setData((current) => ({
      ...current,
      supplierGuilds: (current.supplierGuilds || []).filter((_, rowIndex) => rowIndex !== index)
    }));
    showToast("Guild removed. Save changes to apply.");
  };

  const setDefaultGuildRow = (index) => {
    setData((current) => {
      const currentRows = current.supplierGuilds || [];
      const targetRow = currentRows[index];
      if (!targetRow) return current;
      const willBeDefault = !targetRow.isDefault;
      return {
        ...current,
        supplierGuilds: currentRows.map((row, rowIndex) => ({
          ...row,
          isDefault: rowIndex === index ? willBeDefault : false
        }))
      };
    });
  };

  const addArmorRow = () => {
    if (!permissions.canEditPrices) return showToast("Discord admin role is required to edit armor stack options.");
    setData((current) => ({
      ...current,
      armorTypes: [...(current.armorTypes || []), { name: "", active: true, isDefault: false }]
    }));
  };

  const updateArmorRow = (index, patch) => {
    setData((current) => ({
      ...current,
      armorTypes: (current.armorTypes || []).map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    }));
  };

  const toggleArmorRowStatus = (index) => runAction(async () => {
    const row = (data.armorTypes || [])[index];
    if (!row) return;
    const historyRecords = [...data.supplierRecords, ...data.supplierHistory];
    const historyCount = historyRecords.filter((r) => r.armorType === row.name).length;
    const archiving = row.active !== false;
    if (archiving && historyCount > 0) {
      const confirmed = await askConfirm({
        title: `Archive ${row.name}?`,
        body: `${historyCount} sales record${historyCount === 1 ? " uses" : "s use"} this armor stack. Archiving hides it from new sales records but keeps existing records unchanged.`,
        confirmLabel: "Archive armor stack"
      });
      if (!confirmed) return;
    }
    setData((current) => ({
      ...current,
      armorTypes: current.armorTypes.map((item, rowIndex) => (
        rowIndex === index ? { ...item, active: !archiving } : item
      ))
    }));
    showToast(archiving ? "Armor stack marked for archive. Save changes to apply." : "Armor stack restored. Save changes to apply.");
  });

  const deleteArmorRow = (index) => {
    setData((current) => ({
      ...current,
      armorTypes: (current.armorTypes || []).filter((_, rowIndex) => rowIndex !== index)
    }));
    showToast("Armor stack removed. Save changes to apply.");
  };

  const setDefaultArmorRow = (index) => {
    setData((current) => {
      const currentRows = current.armorTypes || [];
      const targetRow = currentRows[index];
      if (!targetRow) return current;
      const willBeDefault = !targetRow.isDefault;
      return {
        ...current,
        armorTypes: currentRows.map((row, rowIndex) => ({
          ...row,
          isDefault: rowIndex === index ? willBeDefault : false
        }))
      };
    });
  };

  return (
    <main className="shell">
      <a className="skip-link" href="#ledger-content">Skip to ledger content</a>

      <header className="topbar">
        <section className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div className="brand-copy">
            <div className="flex items-center gap-2">
              <p className="eyebrow m-0">Moonlight WoW operations</p>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400/90 font-mono tracking-tight" title="Real-time 15s synchronization active">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-live-pulse" aria-hidden="true" />
                Live
              </span>
            </div>
            <h1>Moonlight Ledger</h1>
            <p className="brand-subtitle">Supplier settlements, booster payouts, and margin clarity.</p>
          </div>
        </section>
        <section className="session" aria-label="Discord account">
          {data.user ? (
            <div className="session-identity">
              <Badge variant={isAdmin ? "admin" : "booster"}>{isAdmin ? "Admin" : "Booster"}</Badge>
              <strong className="session-user">{data.user.username || "Discord user"}</strong>
              <Button variant="ghost" size="sm" type="button" onClick={logout}>Log out</Button>
            </div>
          ) : (
            <a
              className={cn(buttonVariants(), "discord-button session-login", !data.discordConfigured && "pointer-events-none opacity-50")}
              href="/auth/discord"
              aria-disabled={!data.discordConfigured}
              tabIndex={data.discordConfigured ? 0 : -1}
            >
              {data.discordConfigured ? "Sign in with Discord" : "Discord setup needed"}
            </a>
          )}
        </section>
      </header>

      <div id="ledger-content" tabIndex={-1}>
        <AppTabs activeTab={activeTab} isAdmin={isAdmin} onChange={setActiveTab} badges={tabBadges} />

        {activeTab === "supplier" && (
          <SupplierUnpaidPage
            isAdmin={isAdmin}
            loading={loading}
            loadError={loadError}
            records={data.supplierRecords}
            withdrawals={data.supplierWithdrawals}
            services={data.supplierServices}
            guilds={data.supplierGuilds}
            armorTypes={data.armorTypes}
            paidHistory={data.supplierHistory}
            permissions={permissions}
            editing={editing}
            formKey={supplierFormKey}
            withdrawalFormKey={withdrawalFormKey}
            onSubmitRecord={submitSupplierRecord}
            onPatchRecord={patchSupplierRecord}
            onDeleteRecord={deleteSupplierRecord}
            onSubmitWithdrawal={submitSupplierWithdrawal}
            onPatchWithdrawal={patchSupplierWithdrawal}
            onDeleteWithdrawal={deleteSupplierWithdrawal}
            onSetEditing={setEditing}
            onExport={exportSupplierPng}
            onVerifyAll={verifyAllSupplierSales}
            onUnverifyAll={unverifyAllSupplierSales}
            onMarkPaid={markSupplierPaid}
          />
        )}

        {activeTab === "supplierHistory" && (
          <SupplierPaidHistoryPage
            isAdmin={isAdmin}
            loading={loading}
            loadError={loadError}
            records={data.supplierHistory}
            canReopen={permissions.canReopenSupplierPaid}
            onExportBatch={exportPaidSupplierBatch}
            onReopenBatch={reopenSupplierPaymentBatch}
          />
        )}

        {activeTab === "booster" && (
          <BoosterPayoutPage
            isAdmin={isAdmin}
            user={data.user}
            loading={loading}
            loadError={loadError}
            records={data.boosterRecords}
            adjustments={data.boosterAdjustments}
            vaultTransactions={data.boosterCashVault}
            prices={data.boosterPrices}
            permissions={permissions}
            editing={editing}
            formKey={boosterFormKey}
            onSubmitRecord={submitBoosterRecord}
            onPatchRecord={patchBoosterRecord}
            onDeleteRecord={deleteBoosterRecord}
            onSetEditing={setEditing}
            onMarkPaid={markBoosterPaid}
            onSettleBooster={settleBooster}
            onWithdrawVaultCash={withdrawBoosterVaultCash}
            onAddAdjustment={addBoosterAdjustment}
            onUpdateAdjustment={updateBoosterAdjustment}
            onDeleteAdjustment={deleteBoosterAdjustment}
            onAskConfirm={askConfirm}
          />
        )}

        {activeTab === "expenses" && (
          <ExpensesPage
            isAdmin={isAdmin}
            loading={loading}
            loadError={loadError}
            expenses={data.externalExpenses}
            editing={editing}
            formKey={expenseFormKey}
            onSubmitExpense={submitExternalExpense}
            onPatchExpense={patchExternalExpense}
            onDeleteExpense={deleteExternalExpense}
            onSetEditing={setEditing}
          />
        )}

        {activeTab === "profit" && (
          <ProfitReportPage isAdmin={isAdmin} refreshVersion={profitRefreshVersion} />
        )}

        {activeTab === "prices" && (
          <RateSettingsPage
            isAdmin={isAdmin}
            loading={loading}
            loadError={loadError}
            canEditPrices={permissions.canEditPrices}
            supplierServices={data.supplierServices}
            boosterPrices={data.boosterPrices}
            supplierGuilds={data.supplierGuilds}
            armorTypes={data.armorTypes}
            supplierRecords={[...data.supplierRecords, ...data.supplierHistory]}
            boosterRecords={data.boosterRecords}
            supplierWithdrawals={data.supplierWithdrawals}
            onAddPriceRow={addPriceRow}
            onTogglePriceRow={togglePriceRowStatus}
            onDeletePriceRow={deletePriceRow}
            onSetDefaultPriceRow={setDefaultPriceRow}
            onUpdatePriceRow={updatePriceRow}
            onSaveSupplierPrices={saveSupplierPrices}
            onSaveBoosterPrices={saveBoosterPrices}
            onAddGuildRow={addGuildRow}
            onToggleGuildRow={toggleGuildRowStatus}
            onDeleteGuildRow={deleteGuildRow}
            onSetDefaultGuildRow={setDefaultGuildRow}
            onUpdateGuildRow={updateGuildRow}
            onSaveSupplierGuilds={saveSupplierGuilds}
            onAddArmorRow={addArmorRow}
            onToggleArmorRow={toggleArmorRowStatus}
            onDeleteArmorRow={deleteArmorRow}
            onSetDefaultArmorRow={setDefaultArmorRow}
            onUpdateArmorRow={updateArmorRow}
            onSaveArmorTypes={saveArmorTypes}
          />
        )}

        {activeTab === "calculator" && (
          <PriceCalculatorPage
            isAdmin={isAdmin}
            supplierServices={data.supplierServices}
          />
        )}
      </div>

      <ConfirmDialog options={confirmOptions} onConfirm={() => closeConfirm(true)} onCancel={() => closeConfirm(false)} />
      <Toaster />
    </main>
  );
}

function validateArmorRows(rows) {
  const names = rows.map((row) => String(row.name || "").trim()).filter(Boolean);
  if (names.length !== rows.length) throw new Error("Every armor stack option needs a name.");
  const normalizedNames = names.map((name) => name.toLocaleLowerCase());
  if (new Set(normalizedNames).size !== normalizedNames.length) throw new Error("Duplicate armor stack names are not allowed.");
}

function validateGuildRows(rows) {
  const names = rows.map((row) => String(row.name || "").trim()).filter(Boolean);
  if (names.length !== rows.length) throw new Error("Every guild needs a name.");
  const normalizedNames = names.map((name) => name.toLocaleLowerCase());
  if (new Set(normalizedNames).size !== normalizedNames.length) throw new Error("Duplicate guild names are not allowed.");
}

function validateRateRows(rows, key, label) {
  const names = rows.map((row) => String(row[key] || "").trim()).filter(Boolean);
  if (names.length !== rows.length) throw new Error(`Every ${label} rate needs a name.`);
  const normalizedNames = names.map((name) => name.toLocaleLowerCase());
  if (new Set(normalizedNames).size !== normalizedNames.length) throw new Error(`Duplicate ${label} names are not allowed.`);
}
