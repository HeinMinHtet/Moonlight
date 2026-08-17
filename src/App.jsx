import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api.js";
import { AppTabs } from "./components/AppTabs.jsx";
import { ConfirmDialog } from "./components/ConfirmDialog.jsx";
import { BoosterPayoutPage } from "./components/booster/BoosterPayoutPage.jsx";
import { ProfitReportPage } from "./components/profit/ProfitReportPage.jsx";
import { RateSettingsPage } from "./components/rates/RateSettingsPage.jsx";
import { SupplierPaidHistoryPage } from "./components/supplier/SupplierPaidHistoryPage.jsx";
import { SupplierUnpaidPage } from "./components/supplier/SupplierUnpaidPage.jsx";
import { money } from "./utils/format.js";
import { exportSupplierReport } from "./utils/exportSupplierReport.js";
import { buildSupplierSummary, supplierBatchWarnings } from "./utils/supplierBatch.js";
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
  armorTypes: [],
  supplierRecords: [],
  supplierHistory: [],
  supplierSummary: [],
  boosterRecords: [],
  boosterSummary: []
};

export function App() {
  const [data, setData] = useState(initialState);
  const [activeTab, setActiveTab] = useState("booster");
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [confirmOptions, setConfirmOptions] = useState(null);
  const [supplierFormKey, setSupplierFormKey] = useState(0);
  const [boosterFormKey, setBoosterFormKey] = useState(0);
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
      setData((current) => ({ ...current, supplierRecords: [], supplierHistory: [], supplierSummary: [] }));
      return;
    }
    const payload = await api("/api/supplier-records");
    setData((current) => ({
      ...current,
      supplierRecords: payload.records || [],
      supplierHistory: payload.paidRecords || [],
      supplierSummary: payload.summary || []
    }));
  }, [data.permissions]);

  const loadBoosters = useCallback(async (activePermissions = data.permissions) => {
    if (!activePermissions.boosterRecords) {
      setData((current) => ({ ...current, boosterRecords: [], boosterSummary: [] }));
      return;
    }
    const payload = await api("/api/booster-records");
    setData((current) => ({
      ...current,
      boosterRecords: payload.records || [],
      boosterSummary: payload.summary || []
    }));
  }, [data.permissions]);

  const pollVisibleData = useCallback(async () => {
    if (pollingRef.current || foregroundActionRef.current) return;
    pollingRef.current = true;
    const startedAtVersion = dataVersionRef.current;
    try {
      const config = await api("/api/config");
      const needsSupplier = config.permissions.supplierRecords && ["supplier", "supplierHistory", "prices"].includes(activeTab);
      const needsBoosters = config.permissions.boosterRecords && ["booster", "prices"].includes(activeTab);
      const [supplierPayload, boosterPayload] = await Promise.all([
        needsSupplier ? api("/api/supplier-records") : Promise.resolve(null),
        needsBoosters ? api("/api/booster-records") : Promise.resolve(null)
      ]);

      if (foregroundActionRef.current || dataVersionRef.current !== startedAtVersion) return;
      setData((current) => {
        const preserveRateDrafts = activeTab === "prices";
        return {
          ...current,
          ...config,
          supplierServices: preserveRateDrafts ? current.supplierServices : (config.supplierServices || []),
          boosterPrices: preserveRateDrafts ? current.boosterPrices : (config.boosterPrices || []),
          supplierRecords: supplierPayload
            ? (supplierPayload.records || [])
            : config.permissions.supplierRecords ? current.supplierRecords : [],
          supplierHistory: supplierPayload
            ? (supplierPayload.paidRecords || [])
            : config.permissions.supplierRecords ? current.supplierHistory : [],
          supplierSummary: supplierPayload
            ? (supplierPayload.summary || [])
            : config.permissions.supplierRecords ? current.supplierSummary : [],
          boosterRecords: boosterPayload
            ? (boosterPayload.records || [])
            : config.permissions.boosterRecords ? current.boosterRecords : [],
          boosterSummary: boosterPayload
            ? (boosterPayload.summary || [])
            : config.permissions.boosterRecords ? current.boosterSummary : []
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
      const [supplierPayload, boosterPayload] = await Promise.all([
        config.permissions.supplierRecords ? api("/api/supplier-records") : Promise.resolve({ records: [], paidRecords: [], summary: [] }),
        config.permissions.boosterRecords ? api("/api/booster-records") : Promise.resolve({ records: [], summary: [] })
      ]);
      setData((current) => ({
        ...current,
        ...config,
        supplierRecords: supplierPayload.records || [],
        supplierHistory: supplierPayload.paidRecords || [],
        supplierSummary: supplierPayload.summary || [],
        boosterRecords: boosterPayload.records || [],
        boosterSummary: boosterPayload.summary || []
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
    if (["supplier", "supplierHistory", "profit", "prices"].includes(activeTab)) setActiveTab("booster");
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

  const markSupplierPaid = (batchRows = verifiedUnpaidSupplierRows) => runAction(async () => {
    const total = batchRows.reduce((sum, record) => sum + Number(record.totalCost || 0), 0);
    if (!batchRows.length) return showToast("No verified unpaid sales to mark paid.");
    const warnings = supplierBatchWarnings(batchRows);
    const confirmed = await askConfirm({
      title: "Mark verified sales paid?",
      body: `${batchRows.length} verified sales record${batchRows.length === 1 ? "" : "s"} will move to paid supplier history. Total: ${money(total)}.${warnings.length ? ` Review warning: ${warnings.join(" ")}` : ""}`,
      confirmLabel: "Mark paid"
    });
    if (!confirmed) return;
    const payload = await request("/api/supplier-records/mark-paid", {
      method: "POST",
      body: JSON.stringify({ ids: batchRows.map((record) => record.id) })
    });
    setData((current) => ({
      ...current,
      supplierRecords: payload.records || [],
      supplierHistory: payload.paidRecords || [],
      supplierSummary: payload.summary || []
    }));
    showToast(`${payload.paidCount || batchRows.length} supplier records moved to paid history.`);
  });

  const exportSupplierPng = (batchRows = verifiedUnpaidSupplierRows, batchSummary = data.supplierSummary, batchTotal = supplierGrandTotal) => runAction(async () => {
    if (!batchRows.length) return showToast("No verified unpaid sales to export.");
    await exportSupplierReport(batchRows, batchSummary, batchTotal);
    showToast("Supplier report exported.");
  });

  const exportPaidSupplierBatch = (batch) => runAction(async () => {
    if (!batch?.records?.length) return showToast("This paid batch has no records to export.");
    const summary = buildSupplierSummary(batch.records, { includePaid: true });
    await exportSupplierReport(batch.records, summary, batch.total, {
      title: "Paid Supplier Batch",
      totalLabel: "Paid batch total",
      batchLabel: `Batch ${batch.id}`
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
      supplierSummary: payload.summary || []
    }));
    showToast(`${payload.reopenedCount || batch.records.length} sales records returned to unpaid sales.`);
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
      boosterSummary: payload.summary || []
    }));
    showToast(`${payload.paidCount || rows.length} booster payout rows marked paid.`);
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

  const addPriceRow = (collection, key) => {
    if (!permissions.canEditPrices) return showToast("Discord admin role is required to edit rates.");
    setData((current) => ({ ...current, [collection]: [...current[collection], { [key]: "", price: 0, active: true }] }));
  };

  return (
    <main className="shell">
      <a className="skip-link" href="#ledger-content">Skip to ledger content</a>

      <header className="topbar">
        <section className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div className="brand-copy">
            <p className="eyebrow">Moonlight WoW operations</p>
            <h1>Moonlight Ledger</h1>
            <p className="brand-subtitle">Supplier settlements, booster payouts, and margin clarity.</p>
          </div>
        </section>
        <section className="session" aria-label="Discord account">
          {data.user ? (
            <div className="session-identity">
              <span className="session-role">{isAdmin ? "Admin" : "Booster"}</span>
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
        <AppTabs activeTab={activeTab} isAdmin={isAdmin} onChange={setActiveTab} />

        {activeTab === "supplier" && (
          <SupplierUnpaidPage
          isAdmin={isAdmin}
          loading={loading}
          loadError={loadError}
          records={data.supplierRecords}
          services={data.supplierServices}
          armorTypes={data.armorTypes}
          paidHistory={data.supplierHistory}
          permissions={permissions}
          editing={editing}
          formKey={supplierFormKey}
          onSubmitRecord={submitSupplierRecord}
          onPatchRecord={patchSupplierRecord}
          onDeleteRecord={deleteSupplierRecord}
          onSetEditing={setEditing}
          onExport={exportSupplierPng}
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
          prices={data.boosterPrices}
          permissions={permissions}
          editing={editing}
          formKey={boosterFormKey}
          onSubmitRecord={submitBoosterRecord}
          onPatchRecord={patchBoosterRecord}
          onDeleteRecord={deleteBoosterRecord}
          onSetEditing={setEditing}
          onMarkPaid={markBoosterPaid}
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
          supplierRecords={[...data.supplierRecords, ...data.supplierHistory]}
          boosterRecords={data.boosterRecords}
          onAddPriceRow={addPriceRow}
          onTogglePriceRow={togglePriceRowStatus}
          onUpdatePriceRow={updatePriceRow}
          onSaveSupplierPrices={saveSupplierPrices}
          onSaveBoosterPrices={saveBoosterPrices}
          />
        )}
      </div>

      <ConfirmDialog options={confirmOptions} onConfirm={() => closeConfirm(true)} onCancel={() => closeConfirm(false)} />
      <Toaster />
    </main>
  );
}

function validateRateRows(rows, key, label) {
  const names = rows.map((row) => String(row[key] || "").trim()).filter(Boolean);
  if (names.length !== rows.length) throw new Error(`Every ${label} rate needs a name.`);
  const normalizedNames = names.map((name) => name.toLocaleLowerCase());
  if (new Set(normalizedNames).size !== normalizedNames.length) throw new Error(`Duplicate ${label} names are not allowed.`);
}
