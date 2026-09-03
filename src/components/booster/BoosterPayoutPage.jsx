import React, { useEffect, useMemo, useState } from "react";
import { BoosterBalanceTab } from "./BoosterBalanceTab.jsx";
import { BoosterRecordForm } from "./BoosterRecordForm.jsx";
import { BoosterRecordsTable } from "./BoosterRecordsTable.jsx";
import { mmk, money } from "../../utils/format.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.jsx";
import { Badge } from "@/components/ui/badge.jsx";
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
  records = [],
  adjustments = [],
  vaultTransactions = [],
  prices = [],
  permissions = {},
  editing,
  formKey,
  onSubmitRecord,
  onPatchRecord,
  onDeleteRecord,
  onSetEditing,
  onMarkPaid,
  onAddAdjustment,
  onUpdateAdjustment,
  onDeleteAdjustment,
  onSettleBooster,
  onWithdrawVaultCash,
  onAskConfirm
}) {
  const [filters, setFilters] = useState(filterDefaults);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const activePrices = useMemo(() => prices.filter((price) => price.active !== false), [prices]);
  const boosterOptions = useMemo(
    () => uniqueSorted([
      ...records.map((record) => record.boosterName),
      ...adjustments.map((adj) => adj.boosterName),
      ...vaultTransactions.map((tx) => tx.boosterName)
    ]),
    [records, adjustments, vaultTransactions]
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

  // Booster personal calculations
  const personalRecords = records.filter(
    (record) => !isAdmin || record.discordId === user?.id || record.boosterName === user?.username
  );
  const personalUnpaidBalance = personalRecords
    .filter((record) => !record.paid)
    .reduce((sum, record) => sum + Number(record.totalBalance || 0), 0);

  const personalAdjustments = adjustments.filter(
    (adj) => !isAdmin || adj.discordId === user?.id || adj.boosterName === user?.username
  );
  const activePersonalAdjustments = personalAdjustments.filter((adj) => !adj.settled);
  const personalNetAdjustments = activePersonalAdjustments.reduce(
    (sum, adj) => sum + (adj.type === "add" ? Number(adj.amount || 0) : -Number(adj.amount || 0)),
    0
  );
  const personalCurrentBalance = personalUnpaidBalance + personalNetAdjustments;
  const personalEarnedBalance =
    personalRecords.reduce((sum, record) => sum + Number(record.totalBalance || 0), 0) +
    personalAdjustments.filter((adj) => adj.type === "add").reduce((sum, adj) => sum + Number(adj.amount || 0), 0);

  const personalVaultTransactions = vaultTransactions.filter(
    (tx) => !isAdmin || tx.discordId === user?.id || tx.boosterName === user?.username
  );
  const personalVaultDeposits = personalVaultTransactions.filter((tx) => tx.type === "deposit").reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const personalVaultWithdraws = personalVaultTransactions.filter((tx) => tx.type === "withdraw").reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const personalStoredCash = personalVaultDeposits - personalVaultWithdraws;

  // Admin calculations
  const activeAdjustments = adjustments.filter((adj) => !adj.settled);
  const allNetAdjustments = activeAdjustments.reduce(
    (sum, adj) => sum + (adj.type === "add" ? Number(adj.amount || 0) : -Number(adj.amount || 0)),
    0
  );
  const adminTotalCurrentBalance = openTotal + allNetAdjustments;
  const adminTotalVaultDeposits = vaultTransactions.filter((tx) => tx.type === "deposit").reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const adminTotalVaultWithdraws = vaultTransactions.filter((tx) => tx.type === "withdraw").reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const adminTotalStoredCash = adminTotalVaultDeposits - adminTotalVaultWithdraws;

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setSelectedIds(new Set());
  };

  useEffect(() => {
    if (!isAdmin && (filters.view === "all" || filters.view === "balances")) {
      updateFilter("view", "open");
    }
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
      <Card asChild>
        <article className={`sheet-main booster-workspace ${isAdmin ? "admin-workspace" : "personal-workspace"}`}>
          <div className="section-head">
            <div>
              <p className="section-kicker">{isAdmin ? "Admin payout workspace" : "Personal booster ledger"}</p>
              <h2>{isAdmin ? "Booster payment queue" : "My Mythic+ payouts & stored cash"}</h2>
              <p className="panel-note">
                {permissions.canUseBooster
                  ? isAdmin
                    ? "Review booster runs, settle balances (Pay Now / Hold in Vault), and release MMK cash."
                    : "Record completed runs and track your current balance and stored MMK cash."
                  : "Sign in with an allowed Discord role to view payout records."}
              </p>
            </div>
            <div className="section-actions">
              {isAdmin && filters.view !== "balances" && filters.view !== "vault" && (
                <Button
                  type="button"
                  onClick={() => onMarkPaid(selectedRows)}
                  disabled={!permissions.canMarkBoosterPaid || !selectedRows.length}
                >
                  Pay selected ({selectedRows.length})
                </Button>
              )}
              {filters.view !== "balances" && filters.view !== "vault" && <span>{filteredRecords.length} shown</span>}
            </div>
          </div>

          {/* Stat Bar with Stored Cash MMK and Gold Balances */}
          <section
            className={`batch-bar booster-stat-bar ${isAdmin ? "" : "personal-stat-bar"}`}
            aria-label={isAdmin ? "Admin booster payout totals" : "My payout totals"}
          >
            {isAdmin ? (
              <>
                <div className="border-t-2 border-t-sky-400/80">
                  <span className="batch-label">Total current balance</span>
                  <strong className={adminTotalCurrentBalance < 0 ? "text-rose-400" : "text-sky-300"}>
                    {money(adminTotalCurrentBalance)}
                  </strong>
                </div>
                <div className="border-t-2 border-t-emerald-400/80">
                  <span className="batch-label">Held in vault</span>
                  <strong className="text-emerald-300 font-mono">
                    {mmk(adminTotalStoredCash)}
                  </strong>
                </div>
                <div className="border-t-2 border-t-amber-400/80">
                  <span className="batch-label">Filtered open payout</span>
                  <strong className="text-amber-300">{money(openTotal)}</strong>
                </div>
                <div className="border-t-2 border-t-sky-500/80">
                  <span className="batch-label">Boosters unpaid</span>
                  <strong className="text-sky-300">{unpaidBoosterCount}</strong>
                </div>
                <div className="border-t-2 border-t-emerald-500/80">
                  <span className="batch-label">Paid this week</span>
                  <strong className="text-emerald-300">{money(paidThisWeek)}</strong>
                </div>
              </>
            ) : (
              <>
                <div className="border-t-2 border-t-emerald-400/80">
                  <span className="batch-label">Stored cash in vault</span>
                  <strong className="text-emerald-300 font-mono text-base sm:text-lg">
                    {mmk(personalStoredCash)}
                  </strong>
                </div>
                <div className="border-t-2 border-t-sky-400/80">
                  <span className="batch-label">Current balance</span>
                  <strong className={personalCurrentBalance < 0 ? "text-rose-400" : "text-sky-300"}>
                    {money(personalCurrentBalance)}
                  </strong>
                </div>
                <div className="border-t-2 border-t-amber-400/80">
                  <span className="batch-label">Unpaid runs</span>
                  <strong className="text-amber-300">{money(personalUnpaidBalance)}</strong>
                </div>
                <div className="border-t-2 border-t-indigo-400/80">
                  <span className="batch-label">Net adjustments</span>
                  <strong
                    className={
                      personalNetAdjustments > 0
                        ? "text-emerald-300"
                        : personalNetAdjustments < 0
                        ? "text-rose-300"
                        : "text-slate-300"
                    }
                  >
                    {personalNetAdjustments > 0 ? `+${money(personalNetAdjustments)}` : money(personalNetAdjustments)}
                  </strong>
                </div>
                <div className="border-t-2 border-t-emerald-500/80">
                  <span className="batch-label">Total earned</span>
                  <strong className="text-emerald-300">{money(personalEarnedBalance)}</strong>
                </div>
              </>
            )}
          </section>

          {/* Workspace Sub-Tabs */}
          <Tabs
            value={filters.view}
            onValueChange={(value) => updateFilter("view", value)}
            className="border-b border-border px-4 pt-3"
            aria-label="Payout record view"
          >
            <TabsList className="bg-transparent p-0">
              {[
                ["open", "Open payouts"],
                ["paid", "Paid history"],
                ...(isAdmin
                  ? [
                      ["all", "All records"],
                      ["balances", "Booster balances & Vault"]
                    ]
                  : [["vault", "My Stored Cash (MMK)"]])
              ].map(([value, label]) => (
                <TabsTrigger key={value} value={value}>
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {loading && (
            <div className="space-y-2 p-4" aria-label="Loading booster payouts">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}

          {!loading && loadError && (
            <Alert variant="destructive" className="m-4">
              <AlertTitle>Could not load booster payouts</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}

          {!loading && !loadError && (
            <>
              {filters.view === "balances" && isAdmin ? (
                <BoosterBalanceTab
                  records={records}
                  adjustments={adjustments}
                  vaultTransactions={vaultTransactions}
                  isAdmin={isAdmin}
                  permissions={permissions}
                  onAddAdjustment={onAddAdjustment}
                  onUpdateAdjustment={onUpdateAdjustment}
                  onDeleteAdjustment={onDeleteAdjustment}
                  onSettleBooster={onSettleBooster}
                  onWithdrawVaultCash={onWithdrawVaultCash}
                  onAskConfirm={onAskConfirm}
                />
              ) : filters.view === "vault" ? (
                <section className="p-4 space-y-6" aria-label="Personal stored cash vault">
                  {/* Personal Vault Summary Card */}
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                        My Stored Cash Balance in Vault
                      </span>
                      <div className="text-2xl sm:text-4xl font-black font-mono text-emerald-300">
                        {mmk(personalStoredCash)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        This cash is held safely by the team admin. You can request a payout at any time.
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono">
                      <div className="rounded-xl border border-border/80 bg-card/60 p-3 text-right">
                        <span className="text-[11px] text-muted-foreground block">Total Stored</span>
                        <strong className="text-amber-300 text-sm">{mmk(personalVaultDeposits)}</strong>
                      </div>
                      <div className="rounded-xl border border-border/80 bg-card/60 p-3 text-right">
                        <span className="text-[11px] text-muted-foreground block">Total Paid Out</span>
                        <strong className="text-emerald-400 text-sm">{mmk(personalVaultWithdraws)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Personal Vault Ledger Table */}
                  <Card className="overflow-hidden border-border/80 bg-card/90">
                    <div className="flex items-center justify-between border-b border-border/70 p-4 bg-muted/20">
                      <div>
                        <h3 className="text-base font-bold text-foreground">Stored Cash (MMK) History</h3>
                        <p className="text-xs text-muted-foreground">
                          Record of gold runs converted to stored MMK and cash payouts you received.
                        </p>
                      </div>
                      <Badge variant="success" className="font-bold">{personalVaultTransactions.length} Transactions</Badge>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-border/80 bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3 text-right">Amount (MMK)</th>
                            <th className="px-4 py-3 text-right">Conversion Details</th>
                            <th className="px-4 py-3">Payment Note / Reference</th>
                            <th className="px-4 py-3">Admin</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 font-medium text-xs sm:text-sm">
                          {personalVaultTransactions.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-10 text-center text-xs text-muted-foreground">
                                No stored cash transactions yet.
                              </td>
                            </tr>
                          ) : (
                            personalVaultTransactions.map((tx) => (
                              <tr key={tx.id} className="transition-colors hover:bg-muted/20">
                                <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                                  <TableDateCell date={tx.date} createdAt={tx.createdAt} className="items-start" />
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {tx.type === "deposit" ? (
                                    <Badge variant="outline" className="text-[11px] font-bold border-amber-500/40 text-amber-300 bg-amber-500/10">
                                      + Stored in Vault
                                    </Badge>
                                  ) : (
                                    <Badge variant="success" className="text-[11px] font-bold">
                                      - Cash Paid Out
                                    </Badge>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">
                                  <span className={tx.type === "deposit" ? "text-amber-300" : "text-emerald-400"}>
                                    {tx.type === "deposit" ? `+${mmk(tx.amount)}` : `-${mmk(tx.amount)}`}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                                  {tx.type === "deposit" && tx.goldAmount > 0 ? (
                                    <span>{money(tx.goldAmount)} Gold @ {tx.rate} MMK</span>
                                  ) : (
                                    <span>-</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-foreground/90 max-w-xs truncate" title={tx.note}>
                                  {tx.paymentMethod ? <Badge variant="neutral" className="mr-1.5 text-[10px] py-0">{tx.paymentMethod}</Badge> : null}
                                  {tx.note}
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                  {tx.createdByName || "Admin"}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </section>
              ) : (
                <>
                  {/* Payout Filters */}
                  <section className="filter-bar booster-filter-bar" aria-label="Booster payout filters">
                    {isAdmin && (
                      <Label className="filter-select">
                        Booster
                        <NativeSelect
                          value={filters.booster}
                          onChange={(event) => updateFilter("booster", event.target.value)}
                        >
                          <option value="all">All boosters</option>
                          {boosterOptions.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </NativeSelect>
                      </Label>
                    )}
                    <Label className="filter-select">
                      Key level
                      <NativeSelect
                        value={filters.level}
                        onChange={(event) => updateFilter("level", event.target.value)}
                      >
                        <option value="all">All key levels</option>
                        {levelOptions.map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </NativeSelect>
                    </Label>
                    <Label className="filter-date">
                      From
                      <Input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(event) => updateFilter("dateFrom", event.target.value)}
                      />
                    </Label>
                    <Label className="filter-date">
                      To
                      <Input
                        type="date"
                        value={filters.dateTo}
                        onChange={(event) => updateFilter("dateTo", event.target.value)}
                      />
                    </Label>
                    <Button
                      className="filter-action"
                      variant="outline"
                      type="button"
                      onClick={() => {
                        setFilters(filterDefaults);
                        setSelectedIds(new Set());
                      }}
                    >
                      Clear filters
                    </Button>
                  </section>

                  {filters.view !== "paid" && (
                    <BoosterRecordForm
                      key={formKey}
                      disabled={!permissions.canUseBooster || !activePrices.length}
                      prices={activePrices}
                      isAdmin={isAdmin}
                      boosterOptions={boosterOptions}
                      onSubmit={onSubmitRecord}
                    />
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
            </>
          )}
        </article>
      </Card>
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
  return (
    !String(record.note || "").trim() ||
    Number(record.totalBalance || 0) <= 0 ||
    Number(record.quantity || 0) > 20
  );
}

function isThisWeek(value) {
  if (!value) return false;
  const paidAt = new Date(value);
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - 6);
  return paidAt >= weekStart;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function emptyMessage(view) {
  if (view === "paid") return "No paid booster payouts match these filters.";
  if (view === "open")
    return "No open booster payouts match these filters. Record a completed run or clear the filters.";
  return "No booster payouts match these filters.";
}
