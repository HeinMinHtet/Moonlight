import React, { useEffect, useMemo, useState } from "react";
import { BoosterRecordForm } from "./BoosterRecordForm.jsx";
import { BoosterRecordsTable } from "./BoosterRecordsTable.jsx";
import { money } from "../../utils/format.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card } from "@/components/ui/card.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { NativeSelect } from "@/components/ui/native-select.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.jsx";

const filterDefaults = {
  view: "open",
  booster: "all",
  level: "all",
  dateFrom: "",
  dateTo: ""
};

export function BoosterPayoutPage({
  isAdmin,
  user,
  loading,
  loadError,
  records,
  prices,
  permissions,
  editing,
  formKey,
  onSubmitRecord,
  onPatchRecord,
  onDeleteRecord,
  onSetEditing,
  onMarkPaid
}) {
  const [filters, setFilters] = useState(filterDefaults);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const activePrices = useMemo(() => prices.filter((price) => price.active !== false), [prices]);
  const boosterOptions = useMemo(
    () => uniqueSorted(records.map((record) => record.boosterName)),
    [records]
  );
  const levelOptions = useMemo(
    () => uniqueSorted(records.map((record) => record.level)),
    [records]
  );
  const filteredRecords = useMemo(
    () => records.filter((record) => matchesFilters(record, filters)),
    [records, filters]
  );
  const visibleOpenRows = useMemo(() => filteredRecords.filter((record) => !record.paid), [filteredRecords]);
  const selectedRows = useMemo(
    () => visibleOpenRows.filter((record) => selectedIds.has(record.id)),
    [selectedIds, visibleOpenRows]
  );
  const openTotal = visibleOpenRows.reduce((sum, record) => sum + Number(record.totalBalance || 0), 0);
  const unpaidBoosterCount = new Set(visibleOpenRows.map((record) => record.discordId || record.boosterName)).size;
  const reviewCount = visibleOpenRows.filter(needsReview).length;
  const paidThisWeek = records
    .filter((record) => record.paid && isThisWeek(record.paidAt))
    .reduce((sum, record) => sum + Number(record.totalBalance || 0), 0);
  const personalUnpaidBalance = records
    .filter((record) => !record.paid)
    .reduce((sum, record) => sum + Number(record.totalBalance || 0), 0);
  const personalEarnedBalance = records
    .reduce((sum, record) => sum + Number(record.totalBalance || 0), 0);
  const balanceRows = useMemo(() => buildBoosterBalances(visibleOpenRows), [visibleOpenRows]);
  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setSelectedIds(new Set());
  };

  useEffect(() => {
    if (!isAdmin && filters.view === "all") updateFilter("view", "open");
  }, [filters.view, isAdmin]);

  useEffect(() => {
    const eligibleIds = new Set(records.filter((record) => !record.paid).map((record) => record.id));
    setSelectedIds((current) => new Set([...current].filter((id) => eligibleIds.has(id))));
  }, [records]);
  const toggleRow = (id, checked) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const toggleAllVisible = (checked) => {
    setSelectedIds(checked ? new Set(visibleOpenRows.map((record) => record.id)) : new Set());
  };

  return (
    <section className="tab-panel active">
      <Card asChild><article className={`sheet-main booster-workspace ${isAdmin ? "admin-workspace" : "personal-workspace"}`}>
        <div className="section-head">
          <div>
            <p className="section-kicker">{isAdmin ? "Admin payout workspace" : "Personal booster ledger"}</p>
            <h2>{isAdmin ? "Booster payment queue" : "My Mythic+ payouts"}</h2>
            <p className="panel-note">
              {permissions.canUseBooster
                ? isAdmin
                  ? "Review every booster, select open rows, and complete payouts as one confirmed batch."
                  : "Record completed runs and track only your own open and paid payouts."
                : "Sign in with an allowed Discord role to view payout records."}
            </p>
          </div>
          <div className="section-actions">
            {isAdmin && (
              <Button type="button" onClick={() => onMarkPaid(selectedRows)} disabled={!permissions.canMarkBoosterPaid || !selectedRows.length}>
                Pay selected ({selectedRows.length})
              </Button>
            )}
            <span>{filteredRecords.length} shown</span>
          </div>
        </div>

        <section className={`batch-bar booster-stat-bar ${isAdmin ? "" : "personal-stat-bar"}`} aria-label={isAdmin ? "Admin booster payout totals" : "My payout totals"}>
          {isAdmin ? (
            <>
              <div><span className="batch-label">Filtered open payout</span><strong>{money(openTotal)}</strong></div>
              <div><span className="batch-label">Boosters unpaid</span><strong>{unpaidBoosterCount}</strong></div>
              <div><span className="batch-label">Paid this week</span><strong>{money(paidThisWeek)}</strong></div>
              <div><span className="batch-label">Needs review</span><strong>{reviewCount}</strong></div>
            </>
          ) : (
            <>
              <div><span className="batch-label">Unpaid balance</span><strong>{money(personalUnpaidBalance)}</strong></div>
              <div><span className="batch-label">Total earned</span><strong>{money(personalEarnedBalance)}</strong></div>
            </>
          )}
        </section>

        {isAdmin && (
          <section className="booster-balance-panel" aria-label="Open payout by booster">
            <div className="subsection-head">
              <div><h3>Balances to pay</h3><p>Totals follow the current filters.</p></div>
              <span>{balanceRows.length} boosters</span>
            </div>
            <div className="balance-list balance-grid">
              {!balanceRows.length && <p className="muted compact">No open booster balances match the current filters.</p>}
              {balanceRows.map((row) => (
                <div className="balance-row" key={row.discordId || row.boosterName}>
                  <span>{row.boosterName}</span><strong>{money(row.openTotal)}</strong>
                  <small>{row.openCount} open row{row.openCount === 1 ? "" : "s"}</small>
                </div>
              ))}
            </div>
          </section>
        )}

        <Tabs value={filters.view} onValueChange={(value) => updateFilter("view", value)} className="border-b border-border px-4 pt-3" aria-label="Payout record view">
          <TabsList className="bg-transparent p-0">
            {[
              ["open", "Open payouts"],
              ["paid", "Paid history"],
              ...(isAdmin ? [["all", "All records"]] : [])
            ].map(([value, label]) => <TabsTrigger key={value} value={value}>{label}</TabsTrigger>)}
          </TabsList>
        </Tabs>

        <section className="filter-bar booster-filter-bar" aria-label="Booster payout filters">
          {isAdmin && (
            <Label>Booster<NativeSelect value={filters.booster} onChange={(event) => updateFilter("booster", event.target.value)}>
              <option value="all">All boosters</option>
              {boosterOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </NativeSelect></Label>
          )}
          <Label>Key level<NativeSelect value={filters.level} onChange={(event) => updateFilter("level", event.target.value)}>
            <option value="all">All key levels</option>
            {levelOptions.map((level) => <option key={level} value={level}>{level}</option>)}
          </NativeSelect></Label>
          <Label>From<Input type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} /></Label>
          <Label>To<Input type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} /></Label>
          <Button variant="outline" type="button" onClick={() => { setFilters(filterDefaults); setSelectedIds(new Set()); }}>Clear filters</Button>
        </section>

        {loading && <div className="space-y-2 p-4" aria-label="Loading booster payouts"><Skeleton className="h-10 w-full" /><Skeleton className="h-32 w-full" /></div>}
        {!loading && loadError && <Alert variant="destructive" className="m-4"><AlertTitle>Could not load booster payouts</AlertTitle><AlertDescription>{loadError}</AlertDescription></Alert>}
        {!loading && !loadError && (
          <>
            {filters.view !== "paid" && (
              <BoosterRecordForm key={formKey} disabled={!permissions.canUseBooster || !activePrices.length} prices={activePrices} onSubmit={onSubmitRecord} />
            )}
            <BoosterRecordsTable
              records={filteredRecords}
              prices={activePrices}
              user={user}
              isAdmin={isAdmin}
              permissions={permissions}
              editing={editing}
              selectedIds={selectedIds}
              visibleOpenRows={visibleOpenRows}
              emptyMessage={emptyMessage(filters.view)}
              onSetEditing={onSetEditing}
              onPatchRecord={onPatchRecord}
              onDeleteRecord={onDeleteRecord}
              onToggleRow={toggleRow}
              onToggleAllVisible={toggleAllVisible}
            />
          </>
        )}
      </article></Card>
    </section>
  );
}

function matchesFilters(record, filters) {
  if (filters.view === "open" && record.paid) return false;
  if (filters.view === "paid" && !record.paid) return false;
  if (filters.booster !== "all" && record.boosterName !== filters.booster) return false;
  if (filters.level !== "all" && record.level !== filters.level) return false;
  const recordDate = String(record.createdAt || "").slice(0, 10);
  if (filters.dateFrom && recordDate < filters.dateFrom) return false;
  if (filters.dateTo && recordDate > filters.dateTo) return false;
  return true;
}

function needsReview(record) {
  return !String(record.note || "").trim() || Number(record.totalBalance || 0) <= 0 || Number(record.quantity || 0) > 20;
}

function isThisWeek(value) {
  if (!value) return false;
  const paidAt = new Date(value);
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - 6);
  return paidAt >= weekStart;
}

function buildBoosterBalances(records) {
  const balances = new Map();
  for (const record of records) {
    const key = record.discordId || record.boosterName || "unknown";
    const row = balances.get(key) || { discordId: record.discordId, boosterName: record.boosterName || "Unknown booster", openCount: 0, openTotal: 0 };
    row.openCount += 1;
    row.openTotal += Number(record.totalBalance || 0);
    balances.set(key, row);
  }
  return [...balances.values()].sort((a, b) => b.openTotal - a.openTotal);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function emptyMessage(view) {
  if (view === "paid") return "No paid booster payouts match these filters.";
  if (view === "open") return "No open booster payouts match these filters. Record a completed run or clear the filters.";
  return "No booster payouts match these filters.";
}
