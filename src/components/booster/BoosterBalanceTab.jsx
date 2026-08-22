import React, { useMemo, useState } from "react";
import { Edit2, Plus, Search, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { BoosterAdjustmentDialog } from "./BoosterAdjustmentDialog.jsx";
import { BoosterSettleDialog } from "./BoosterSettleDialog.jsx";
import { money } from "../../utils/format.js";
import { calculateBoosterBalances } from "../../utils/boosterBalance.js";
import { Badge } from "@/components/ui/badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card } from "@/components/ui/card.jsx";
import { Input } from "@/components/ui/input.jsx";
import { cn } from "@/lib/utils.js";

export function BoosterBalanceTab({
  records = [],
  adjustments = [],
  isAdmin,
  permissions,
  onAddAdjustment,
  onUpdateAdjustment,
  onDeleteAdjustment,
  onSettleBooster,
  onAskConfirm
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState("create"); // "create" | "edit"
  const [selectedBoosterData, setSelectedBoosterData] = useState(null);
  const [editingAdjustment, setEditingAdjustment] = useState(null);
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [settleBoosterData, setSettleBoosterData] = useState(null);

  // Compute aggregated balances per booster
  const boosterBalances = useMemo(
    () => calculateBoosterBalances(records, adjustments),
    [records, adjustments]
  );

  const filteredBalances = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return boosterBalances;
    return boosterBalances.filter(
      (b) => b.boosterName.toLowerCase().includes(q) || b.discordId.toLowerCase().includes(q)
    );
  }, [boosterBalances, searchQuery]);

  const filteredAdjustments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return adjustments;
    return adjustments.filter(
      (adj) =>
        adj.boosterName.toLowerCase().includes(q) ||
        adj.note.toLowerCase().includes(q) ||
        (adj.createdByName && adj.createdByName.toLowerCase().includes(q))
    );
  }, [adjustments, searchQuery]);

  const totalCurrentBalance = boosterBalances.reduce((sum, b) => sum + b.currentBalance, 0);
  const totalOpenRuns = boosterBalances.reduce((sum, b) => sum + b.openRunsTotal, 0);
  const totalNetAdjustments = boosterBalances.reduce((sum, b) => sum + b.adjustmentsTotal, 0);

  const handleOpenSettleDialog = (booster) => {
    setSettleBoosterData(booster);
    setIsSettleOpen(true);
  };

  const handleConfirmSettle = async (payload) => {
    if (onSettleBooster) {
      await onSettleBooster(payload);
    }
    setIsSettleOpen(false);
  };

  const handleOpenCreateDialog = (booster = null) => {
    setDialogMode("create");
    setSelectedBoosterData(booster ? { boosterName: booster.boosterName, discordId: booster.discordId } : null);
    setEditingAdjustment(null);
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (adj) => {
    setDialogMode("edit");
    setEditingAdjustment(adj);
    setSelectedBoosterData(null);
    setIsDialogOpen(true);
  };

  const handleSaveDialog = async (formData) => {
    if (dialogMode === "create") {
      await onAddAdjustment(formData);
    } else if (dialogMode === "edit" && editingAdjustment) {
      await onUpdateAdjustment(editingAdjustment.id, formData);
    }
    setIsDialogOpen(false);
  };

  const handleDeleteAdjustment = async (adj) => {
    if (!onAskConfirm) {
      onDeleteAdjustment(adj.id);
      return;
    }
    const confirmed = await onAskConfirm({
      title: `Delete Balance Adjustment?`,
      body: `Remove ${adj.type === "add" ? "+" : "-"}${money(adj.amount)} adjustment for ${adj.boosterName} ("${adj.note}")? This will update the booster's current balance immediately.`,
      confirmLabel: "Delete Adjustment",
      dangerous: true
    });
    if (confirmed) {
      onDeleteAdjustment(adj.id);
    }
  };

  return (
    <section className="space-y-6 pt-4">
      {/* Search & Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search booster name, reason, or admin..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs sm:text-sm bg-popover/80 rounded-xl"
          />
        </div>
        {isAdmin && (
          <Button
            type="button"
            onClick={() => handleOpenCreateDialog()}
            disabled={!permissions.canMarkBoosterPaid}
            className="font-bold shadow-md h-9 gap-1.5"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add / Deduct Balance
          </Button>
        )}
      </div>

      {/* Booster Balances Overview Table */}
      <Card className="overflow-hidden border-border/80 bg-card/90">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 p-4 bg-muted/20">
          <div>
            <h3 className="text-base font-bold text-foreground">Booster Current Balances</h3>
            <p className="text-xs text-muted-foreground">
              Aggregated unpaid Mythic+ runs and manual balance adjustments per booster.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">
              Total Owed: <strong className="text-foreground text-sm font-mono">{money(totalCurrentBalance)}</strong>
            </span>
            <Badge variant="admin">{boosterBalances.length} Boosters</Badge>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Booster</th>
                <th className="px-4 py-3 text-right">Unpaid Runs</th>
                <th className="px-4 py-3 text-right">Net Adjustments</th>
                <th className="px-4 py-3 text-right">Current Balance</th>
                <th className="px-4 py-3 text-right">Lifetime Paid</th>
                <th className="px-4 py-3 text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-medium">
              {filteredBalances.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs text-muted-foreground">
                    No booster balances match the search query.
                  </td>
                </tr>
              ) : (
                filteredBalances.map((b) => (
                  <tr key={b.discordId || b.boosterName} className="transition-colors hover:bg-muted/20">
                    <td className="px-4 py-3 font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        <span>{b.boosterName}</span>
                        {b.currentBalance < 0 && (
                          <Badge variant="destructive" className="text-[10px] py-0 px-1">
                            In Deficit
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs sm:text-sm text-slate-300">
                      <div>{money(b.openRunsTotal)}</div>
                      <small className="text-[11px] text-muted-foreground">
                        {b.openRunsCount} open run{b.openRunsCount === 1 ? "" : "s"}
                      </small>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs sm:text-sm">
                      <div
                        className={cn(
                          b.adjustmentsTotal > 0 && "text-emerald-400 font-bold",
                          b.adjustmentsTotal < 0 && "text-rose-400 font-bold",
                          b.adjustmentsTotal === 0 && "text-muted-foreground"
                        )}
                      >
                        {b.adjustmentsTotal > 0 ? `+${money(b.adjustmentsTotal)}` : money(b.adjustmentsTotal)}
                      </div>
                      <small className="text-[11px] text-muted-foreground">
                        {b.adjustmentsCount} adjustment{b.adjustmentsCount === 1 ? "" : "s"}
                      </small>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm sm:text-base font-bold">
                      <span
                        className={cn(
                          b.currentBalance > 0 && "text-sky-300",
                          b.currentBalance < 0 && "text-rose-400",
                          b.currentBalance === 0 && "text-slate-400"
                        )}
                      >
                        {money(b.currentBalance)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs sm:text-sm text-muted-foreground">
                      {money(b.paidRunsTotal)}
                    </td>
                    <td className="px-4 py-3 text-right pr-4">
                      {isAdmin && (
                        <div className="flex items-center justify-end gap-1.5">
                          {b.currentBalance > 0 ? (
                            <Button
                              variant="default"
                              size="sm"
                              type="button"
                              className="h-7 px-2.5 text-xs font-bold shadow-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                              onClick={() => handleOpenSettleDialog(b)}
                              disabled={!permissions.canMarkBoosterPaid}
                            >
                              Pay Balance
                            </Button>
                          ) : b.currentBalance < 0 && b.openRunsCount > 0 ? (
                            <Button
                              variant="outline"
                              size="sm"
                              type="button"
                              className="h-7 px-2.5 text-xs font-semibold border-rose-500/40 text-rose-300 bg-rose-500/10 hover:bg-rose-500/20"
                              onClick={() => handleOpenSettleDialog(b)}
                              disabled={!permissions.canMarkBoosterPaid}
                            >
                              Offset Runs
                            </Button>
                          ) : (
                            <Badge variant="neutral" className="text-[10px] py-0.5 px-2 font-mono">
                              Settled
                            </Badge>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            className="h-7 px-2 text-xs font-semibold border-border/80 bg-card/60 hover:bg-secondary text-muted-foreground hover:text-foreground"
                            onClick={() => handleOpenCreateDialog(b)}
                            disabled={!permissions.canMarkBoosterPaid}
                          >
                            + / - Adjust
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Adjustments Audit Log / Ledger Table */}
      <Card className="overflow-hidden border-border/80 bg-card/90">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 p-4 bg-muted/20">
          <div>
            <h3 className="text-base font-bold text-foreground">Balance Adjustment Audit Log</h3>
            <p className="text-xs text-muted-foreground">
              History of manual credits, advance payouts, bonuses, and penalty deductions.
            </p>
          </div>
          <Badge variant="neutral">{filteredAdjustments.length} Records</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Booster</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Reason / Note</th>
                <th className="px-4 py-3">Adjusted By</th>
                {isAdmin && <th className="px-4 py-3 text-right pr-4">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-medium text-xs sm:text-sm">
              {filteredAdjustments.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="py-10 text-center text-xs text-muted-foreground">
                    No balance adjustments recorded yet.
                  </td>
                </tr>
              ) : (
                filteredAdjustments.map((adj) => (
                  <tr key={adj.id} className="transition-colors hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                      {adj.date}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                      {adj.boosterName}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {adj.type === "add" ? (
                        <Badge variant="success" className="gap-1 text-[11px] font-bold">
                          <TrendingUp className="size-3" aria-hidden="true" />
                          + Credit
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1 text-[11px] font-bold">
                          <TrendingDown className="size-3" aria-hidden="true" />
                          - Debit
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">
                      <span className={adj.type === "add" ? "text-emerald-400" : "text-rose-400"}>
                        {adj.type === "add" ? `+${money(adj.amount)}` : `-${money(adj.amount)}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground/90 max-w-xs truncate" title={adj.note}>
                      {adj.note}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {adj.createdByName || "Admin"}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right pr-4 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            className="size-7 text-slate-400 hover:text-white"
                            onClick={() => handleOpenEditDialog(adj)}
                            disabled={!permissions.canMarkBoosterPaid}
                            title="Edit adjustment"
                            aria-label={`Edit adjustment for ${adj.boosterName}`}
                          >
                            <Edit2 className="size-3.5" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            className="size-7 text-rose-400 hover:text-rose-200 hover:bg-rose-500/15"
                            onClick={() => handleDeleteAdjustment(adj)}
                            disabled={!permissions.canMarkBoosterPaid}
                            title="Delete adjustment"
                            aria-label={`Delete adjustment for ${adj.boosterName}`}
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create / Edit Dialog */}
      {isDialogOpen && (
        <BoosterAdjustmentDialog
          isOpen={isDialogOpen}
          mode={dialogMode}
          initialData={dialogMode === "edit" ? editingAdjustment : selectedBoosterData}
          boosters={boosterBalances}
          onSave={handleSaveDialog}
          onClose={() => setIsDialogOpen(false)}
        />
      )}

      {/* Settle Booster Payout Dialog */}
      <BoosterSettleDialog
        isOpen={isSettleOpen}
        booster={settleBoosterData}
        records={records}
        adjustments={adjustments}
        onConfirm={handleConfirmSettle}
        onClose={() => setIsSettleOpen(false)}
      />
    </section>
  );
}
