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
import { RaidNotesPage } from "./components/notes/RaidNotesPage.jsx";
import { RaidSchedulePage } from "./components/schedule/RaidSchedulePage.jsx";
import { useSupplierActions } from "./hooks/useSupplierActions.js";
import { useBoosterActions } from "./hooks/useBoosterActions.js";
import { useExpenseAndNoteActions } from "./hooks/useExpenseAndNoteActions.js";
import { useRateActions } from "./hooks/useRateActions.js";
import { useRaidScheduleActions } from "./hooks/useRaidScheduleActions.js";
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
  externalExpenses: [],
  raidNotes: [],
  raidSchedules: []
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
    canDeleteBoosterRows: Boolean(data.permissions.boosterDelete),
    canUseNotes: Boolean(data.permissions.raidNotes),
    canUseSchedule: Boolean(data.permissions.raidSchedule),
    canEditSchedule: Boolean(data.permissions.raidScheduleEdit)
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

  const loadRaidNotes = useCallback(async (activePermissions = data.permissions) => {
    if (!activePermissions.raidNotes) {
      setData((current) => ({ ...current, raidNotes: [] }));
      return;
    }
    const payload = await api("/api/raid-notes");
    setData((current) => ({
      ...current,
      raidNotes: payload.notes || []
    }));
  }, [data.permissions]);

  const loadSchedules = useCallback(async (activePermissions = data.permissions) => {
    if (!activePermissions.raidSchedule) {
      setData((current) => ({ ...current, raidSchedules: [] }));
      return;
    }
    const payload = await api("/api/raid-schedules");
    setData((current) => ({
      ...current,
      raidSchedules: payload.schedules || []
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
      const needsNotes = config.permissions.raidNotes && activeTab === "notes";
      const needsSchedule = config.permissions.raidSchedule && activeTab === "schedule";
      const [supplierPayload, boosterPayload, expensesPayload, notesPayload, schedulesPayload] = await Promise.all([
        needsSupplier ? api("/api/supplier-records") : Promise.resolve(null),
        needsBoosters ? api("/api/booster-records") : Promise.resolve(null),
        needsExpenses ? api("/api/external-expenses") : Promise.resolve(null),
        needsNotes ? api("/api/raid-notes") : Promise.resolve(null),
        needsSchedule ? api("/api/raid-schedules") : Promise.resolve(null)
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
            : config.permissions.externalExpenses ? current.externalExpenses : [],
          raidNotes: notesPayload
            ? (notesPayload.notes || [])
            : config.permissions.raidNotes ? current.raidNotes : [],
          raidSchedules: schedulesPayload
            ? (schedulesPayload.schedules || [])
            : config.permissions.raidSchedule ? current.raidSchedules : []
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
      const [supplierPayload, boosterPayload, expensesPayload, notesPayload, schedulesPayload] = await Promise.all([
        config.permissions.supplierRecords ? api("/api/supplier-records") : Promise.resolve({ records: [], paidRecords: [], summary: [], withdrawals: [] }),
        config.permissions.boosterRecords ? api("/api/booster-records") : Promise.resolve({ records: [], summary: [], adjustments: [], vaultTransactions: [] }),
        config.permissions.externalExpenses ? api("/api/external-expenses") : Promise.resolve({ expenses: [] }),
        config.permissions.raidNotes ? api("/api/raid-notes") : Promise.resolve({ notes: [] }),
        config.permissions.raidSchedule ? api("/api/raid-schedules") : Promise.resolve({ schedules: [] })
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
        externalExpenses: expensesPayload.expenses || [],
        raidNotes: notesPayload.notes || [],
        raidSchedules: schedulesPayload.schedules || []
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
    if (["supplier", "supplierHistory", "schedule", "notes", "expenses", "profit", "prices", "calculator"].includes(activeTab)) setActiveTab("booster");
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
    const today = new Date().toISOString().slice(0, 10);
    const todayNotesCount = (data.raidNotes || []).filter(
      (n) => !n.archived && n.raidDate === today
    ).length;
    const todayScheduleCount = (data.raidSchedules || []).filter(
      (s) => s.date === today
    ).length;
    return {
      supplier: unverifiedSupplierCount,
      booster: boosterReviewCount,
      notes: todayNotesCount,
      schedule: todayScheduleCount
    };
  }, [data.supplierRecords, data.boosterRecords, data.raidNotes, data.raidSchedules]);

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

  const {
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
  } = useSupplierActions({
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
    supplierSummary: data.supplierSummary,
    supplierWithdrawals: data.supplierWithdrawals,
    supplierRecords: data.supplierRecords
  });

  const {
    submitBoosterRecord,
    patchBoosterRecord,
    deleteBoosterRecord,
    markBoosterPaid,
    settleBooster,
    withdrawBoosterVaultCash,
    addBoosterAdjustment,
    updateBoosterAdjustment,
    deleteBoosterAdjustment
  } = useBoosterActions({
    request,
    runAction,
    setData,
    setEditing,
    setBoosterFormKey,
    loadBoosters,
    showToast,
    askConfirm
  });

  const {
    submitExternalExpense,
    patchExternalExpense,
    deleteExternalExpense,
    createRaidNote,
    patchRaidNote,
    deleteRaidNote
  } = useExpenseAndNoteActions({
    request,
    runAction,
    setData,
    setEditing,
    setExpenseFormKey,
    loadExpenses,
    showToast,
    askConfirm,
    raidNotes: data.raidNotes
  });

  const {
    submitRaidSchedule,
    patchRaidSchedule,
    deleteRaidSchedule,
    addBuyerToSchedule,
    removeBuyerFromSchedule
  } = useRaidScheduleActions({
    request,
    runAction,
    setData,
    loadSchedules,
    showToast,
    askConfirm,
    raidSchedules: data.raidSchedules
  });

  const {
    saveSupplierPrices,
    saveBoosterPrices,
    saveSupplierGuilds,
    saveArmorTypes,
    updatePriceRow,
    togglePriceRowStatus,
    deletePriceRow,
    setDefaultPriceRow,
    addPriceRow,
    addGuildRow,
    updateGuildRow,
    toggleGuildRowStatus,
    deleteGuildRow,
    setDefaultGuildRow,
    addArmorRow,
    updateArmorRow,
    toggleArmorRowStatus,
    deleteArmorRow,
    setDefaultArmorRow
  } = useRateActions({
    request,
    runAction,
    setData,
    showToast,
    askConfirm,
    permissions,
    supplierServices: data.supplierServices,
    boosterPrices: data.boosterPrices,
    supplierGuilds: data.supplierGuilds,
    armorTypes: data.armorTypes,
    supplierRecords: data.supplierRecords,
    supplierHistory: data.supplierHistory,
    boosterRecords: data.boosterRecords,
    supplierWithdrawals: data.supplierWithdrawals
  });

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
            armorTypes={data.armorTypes}
            canReopen={permissions.canReopenSupplierPaid}
            onExportBatch={exportPaidSupplierBatch}
            onReopenBatch={reopenSupplierPaymentBatch}
          />
        )}

        {activeTab === "schedule" && (
          <RaidSchedulePage
            isAdmin={isAdmin}
            loading={loading}
            loadError={loadError}
            schedules={data.raidSchedules}
            onSubmitSchedule={submitRaidSchedule}
            onPatchSchedule={patchRaidSchedule}
            onDeleteSchedule={deleteRaidSchedule}
            onAddBuyer={addBuyerToSchedule}
            onRemoveBuyer={removeBuyerFromSchedule}
          />
        )}

        {activeTab === "notes" && (
          <RaidNotesPage
            isAdmin={isAdmin}
            loading={loading}
            loadError={loadError}
            notes={data.raidNotes}
            onCreateNote={createRaidNote}
            onUpdateNote={patchRaidNote}
            onDeleteNote={deleteRaidNote}
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
