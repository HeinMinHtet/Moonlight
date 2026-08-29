import React, { useMemo, useState } from "react";
import { AlertCircle, ArrowDownRight, ArrowUpRight, CheckCircle2, Wallet, X } from "lucide-react";
import { money } from "../../utils/format.js";
import { supplierBatchWarnings } from "../../utils/supplierBatch.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card } from "@/components/ui/card.jsx";
import { cn } from "@/lib/utils.js";

export function SupplierBatchPaidDialog({
  isOpen,
  records = [],
  withdrawals = [],
  onConfirm,
  onClose
}) {
  const [settleWithdrawals, setSettleWithdrawals] = useState(true);

  const verifiedRecords = useMemo(
    () => records.filter((r) => r.correct && !r.paid),
    [records]
  );

  const activeWithdrawals = useMemo(
    () => (withdrawals || []).filter((w) => !w.settled && Number(w.amount || 0) > 0),
    [withdrawals]
  );

  const verifiedSalesTotal = useMemo(
    () => verifiedRecords.reduce((sum, r) => sum + Number(r.totalCost || 0), 0),
    [verifiedRecords]
  );

  const activeWithdrawalsTotal = useMemo(
    () => activeWithdrawals.reduce((sum, w) => sum + Number(w.amount || 0), 0),
    [activeWithdrawals]
  );

  const activeWithdrawalsCount = activeWithdrawals.length;
  const hasActiveWithdrawals = activeWithdrawalsCount > 0 && activeWithdrawalsTotal > 0;

  const netWithWithdrawals = verifiedSalesTotal - activeWithdrawalsTotal;
  const isDeficit = netWithWithdrawals < 0;

  const warnings = useMemo(() => supplierBatchWarnings(verifiedRecords), [verifiedRecords]);

  if (!isOpen || !verifiedRecords.length) return null;

  const effectiveNetPayout = hasActiveWithdrawals && settleWithdrawals
    ? Math.max(0, netWithWithdrawals)
    : verifiedSalesTotal;

  const handleConfirm = () => {
    onConfirm({
      settleWithdrawals: hasActiveWithdrawals ? settleWithdrawals : false
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-paid-dialog-title"
    >
      <Card className="w-full max-w-lg overflow-hidden border-border/80 bg-popover shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 p-4 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Wallet className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h3 id="batch-paid-dialog-title" className="text-base font-bold text-foreground">
                Mark Batch Paid
              </h3>
              <p className="text-xs text-muted-foreground">
                Confirm settlement and move verified sales to paid history.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-bold">
              {verifiedRecords.length} sales record{verifiedRecords.length === 1 ? "" : "s"}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Warnings */}
          {warnings.length > 0 && (
            <Alert variant="warning" className="bg-amber-950/20 border-amber-500/30">
              <AlertCircle className="size-4 text-amber-400" />
              <AlertTitle className="text-amber-200">Review Warnings</AlertTitle>
              <AlertDescription className="text-amber-300 text-xs space-y-0.5 mt-1">
                {warnings.map((w, i) => (
                  <p key={i}>• {w}</p>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {/* Settlement Options when active withdrawals exist */}
          {hasActiveWithdrawals ? (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Choose Settlement Option
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {/* Option 1: Settle with withdraw balance */}
                <button
                  type="button"
                  className={cn(
                    "relative flex flex-col gap-2 rounded-xl border p-3.5 text-left transition-all cursor-pointer",
                    settleWithdrawals
                      ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40"
                      : "border-border/70 bg-card/60 hover:bg-card/90"
                  )}
                  onClick={() => setSettleWithdrawals(true)}
                  aria-pressed={settleWithdrawals}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "flex size-4 items-center justify-center rounded-full border",
                        settleWithdrawals
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40 bg-transparent"
                      )}>
                        {settleWithdrawals && <div className="size-1.5 rounded-full bg-primary-foreground" />}
                      </div>
                      <span className="text-sm font-bold text-foreground">
                        Settle with withdraw balance
                      </span>
                    </div>
                    <Badge variant="success" className="text-[10px] px-1.5 py-0.5 font-bold">
                      Recommended
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">
                    Offsets active pre-withdrawals (-{money(activeWithdrawalsTotal)}) against sales total. {activeWithdrawalsCount} withdrawal{activeWithdrawalsCount === 1 ? "" : "s"} will be marked settled.
                  </p>
                  <div className="flex items-center justify-between pl-6 pt-1 text-xs font-mono border-t border-border/40 mt-1">
                    <span className="text-muted-foreground">Net payable:</span>
                    <span className={cn("font-bold", isDeficit ? "text-rose-400" : "text-emerald-300")}>
                      {money(netWithWithdrawals)}
                    </span>
                  </div>
                </button>

                {/* Option 2: Settle without withdraw balance */}
                <button
                  type="button"
                  className={cn(
                    "relative flex flex-col gap-2 rounded-xl border p-3.5 text-left transition-all cursor-pointer",
                    !settleWithdrawals
                      ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40"
                      : "border-border/70 bg-card/60 hover:bg-card/90"
                  )}
                  onClick={() => setSettleWithdrawals(false)}
                  aria-pressed={!settleWithdrawals}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "flex size-4 items-center justify-center rounded-full border",
                        !settleWithdrawals
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40 bg-transparent"
                      )}>
                        {!settleWithdrawals && <div className="size-1.5 rounded-full bg-primary-foreground" />}
                      </div>
                      <span className="text-sm font-bold text-foreground">
                        Settle without withdraw balance
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                      Full sales
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">
                    Pays full sales total without deducting pre-withdrawals. Active withdrawals will remain active and unsettled.
                  </p>
                  <div className="flex items-center justify-between pl-6 pt-1 text-xs font-mono border-t border-border/40 mt-1">
                    <span className="text-muted-foreground">Gross payable:</span>
                    <span className="font-bold text-emerald-300">
                      {money(verifiedSalesTotal)}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border/70 bg-card/60 p-3.5 text-xs text-muted-foreground">
              <p>No active pre-withdrawals found. The entire verified sales batch will be marked paid.</p>
            </div>
          )}

          {/* Breakdown List */}
          <div className="rounded-xl border border-border/70 bg-card/60 divide-y divide-border/40 text-xs sm:text-sm">
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="size-4 text-emerald-400" aria-hidden="true" />
                <span>Verified sales total ({verifiedRecords.length} rows)</span>
              </div>
              <span className="font-mono font-bold text-emerald-400">
                +{money(verifiedSalesTotal)}
              </span>
            </div>

            {hasActiveWithdrawals && settleWithdrawals && (
              <div className="flex items-center justify-between p-3 bg-amber-500/5">
                <div className="flex items-center gap-2">
                  <ArrowDownRight className="size-4 text-amber-400" aria-hidden="true" />
                  <div>
                    <span>Active withdraw balance offset ({activeWithdrawalsCount})</span>
                    <small className="block text-[11px] text-muted-foreground">
                      Deducted from sales payout
                    </small>
                  </div>
                </div>
                <span className="font-mono font-bold text-amber-400">
                  -{money(activeWithdrawalsTotal)}
                </span>
              </div>
            )}
          </div>

          {/* Result Card */}
          {hasActiveWithdrawals && settleWithdrawals && isDeficit ? (
            <Alert variant="destructive" className="bg-rose-950/20 border-rose-500/30">
              <AlertCircle className="size-4 text-rose-400" />
              <AlertTitle className="text-rose-200">Withdrawals Exceed Sales Total</AlertTitle>
              <AlertDescription className="text-rose-300 text-xs space-y-1 mt-1">
                <p>
                  Active withdraw balance ({money(activeWithdrawalsTotal)}) exceeds verified sales ({money(verifiedSalesTotal)}).
                </p>
                <p>
                  Settling will apply <strong>{money(verifiedSalesTotal)}</strong> toward reducing supplier debt. Remaining withdraw balance after settlement: <strong className="font-mono font-bold">{money(Math.abs(netWithWithdrawals))}</strong>.
                </p>
                <p className="font-semibold pt-1 text-rose-200">
                  ⚠️ No gold will be traded in-game.
                </p>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 text-center space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Actual In-Game Gold to Trade / Pay
              </span>
              <div className="text-2xl sm:text-3xl font-black font-mono text-primary">
                {money(effectiveNetPayout)}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {hasActiveWithdrawals && settleWithdrawals
                  ? `All ${verifiedRecords.length} sales and active withdrawals will be marked settled.`
                  : `All ${verifiedRecords.length} sales will be marked paid. Active withdrawals remain open.`}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 border-t border-border/70 p-4 bg-muted/20">
          <Button
            variant="outline"
            type="button"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className={cn(
              "font-bold shadow-md",
              hasActiveWithdrawals && settleWithdrawals && isDeficit
                ? "bg-rose-600 hover:bg-rose-700 text-white"
                : "bg-primary text-primary-foreground"
            )}
            onClick={handleConfirm}
          >
            <CheckCircle2 className="size-4 mr-1.5" aria-hidden="true" />
            {hasActiveWithdrawals && settleWithdrawals && isDeficit
              ? `Offset Sales to Debt (${money(verifiedSalesTotal)})`
              : `Confirm Mark Paid (${money(effectiveNetPayout)})`}
          </Button>
        </div>
      </Card>
    </div>
  );
}
