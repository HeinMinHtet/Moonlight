import React, { useMemo } from "react";
import { AlertCircle, ArrowDownRight, ArrowUpRight, CheckCircle2, Wallet } from "lucide-react";
import { money } from "../../utils/format.js";
import { calculateBoosterSettlement } from "../../utils/boosterBalance.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card } from "@/components/ui/card.jsx";
import { cn } from "@/lib/utils.js";

export function BoosterSettleDialog({
  isOpen,
  booster = null, // { boosterName, discordId, currentBalance }
  records = [],
  adjustments = [],
  onConfirm,
  onClose
}) {
  if (!isOpen || !booster) return null;

  const key = booster.discordId || booster.boosterName;

  const openRecords = useMemo(() => {
    return records.filter(
      (r) => !r.paid && (r.discordId === key || r.boosterName === key || (booster.discordId && r.discordId === booster.discordId) || r.boosterName === booster.boosterName)
    );
  }, [records, key, booster]);

  const activeAdjustments = useMemo(() => {
    return adjustments.filter(
      (a) => !a.settled && (a.discordId === key || a.boosterName === key || (booster.discordId && a.discordId === booster.discordId) || a.boosterName === booster.boosterName)
    );
  }, [adjustments, key, booster]);

  const settlement = useMemo(() => {
    return calculateBoosterSettlement(booster, openRecords, activeAdjustments);
  }, [booster, openRecords, activeAdjustments]);

  const handleConfirm = () => {
    onConfirm({
      discordId: booster.discordId || "",
      boosterName: booster.boosterName || ""
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <Card className="w-full max-w-lg overflow-hidden border-border/80 bg-popover shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 p-4 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Wallet className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Settle Booster Payout</h3>
              <p className="text-xs text-muted-foreground">
                Booster: <strong className="text-foreground">{booster.boosterName}</strong>
              </p>
            </div>
          </div>
          {settlement.isDeficit ? (
            <Badge variant="destructive" className="font-bold">In Deficit</Badge>
          ) : (
            <Badge variant="success" className="font-bold">Ready to Pay</Badge>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Breakdown List */}
          <div className="rounded-xl border border-border/70 bg-card/60 divide-y divide-border/40 text-xs sm:text-sm">
            {/* Open Runs */}
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="size-4 text-emerald-400" aria-hidden="true" />
                <span>
                  Unpaid Runs ({settlement.openRunsCount} completed)
                </span>
              </div>
              <span className="font-mono font-bold text-emerald-400">
                +{money(settlement.openRunsTotal)}
              </span>
            </div>

            {/* Active Deductions (Loans / Fines / Advances) */}
            {settlement.deductAdjustmentsCount > 0 && (
              <div className="flex items-center justify-between p-3 bg-rose-500/5">
                <div className="flex items-center gap-2">
                  <ArrowDownRight className="size-4 text-rose-400" aria-hidden="true" />
                  <div>
                    <span>Active Debt Deductions ({settlement.deductAdjustmentsCount})</span>
                    <small className="block text-[11px] text-muted-foreground">
                      Loans, advance payouts, or penalties
                    </small>
                  </div>
                </div>
                <span className="font-mono font-bold text-rose-400">
                  -{money(settlement.deductAdjustmentsTotal)}
                </span>
              </div>
            )}

            {/* Active Bonuses */}
            {settlement.addAdjustmentsCount > 0 && (
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="size-4 text-sky-400" aria-hidden="true" />
                  <span>Credit Bonuses ({settlement.addAdjustmentsCount})</span>
                </div>
                <span className="font-mono font-bold text-sky-400">
                  +{money(settlement.addAdjustmentsTotal)}
                </span>
              </div>
            )}
          </div>

          {/* Result Card */}
          {settlement.isDeficit ? (
            <Alert variant="destructive" className="bg-rose-950/20 border-rose-500/30">
              <AlertCircle className="size-4 text-rose-400" />
              <AlertTitle className="text-rose-200">Booster is in Deficit</AlertTitle>
              <AlertDescription className="text-rose-300 text-xs space-y-1 mt-1">
                <p>
                  Current balance is <strong className="font-mono font-bold">{money(settlement.currentBalance)}</strong>.
                </p>
                <p>
                  Settling will apply <strong>{money(settlement.openRunsTotal)}</strong> in completed runs toward reducing their debt. Remaining debt after settlement: <strong className="font-mono font-bold">{money(settlement.remainingDebt)}</strong>.
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
                {money(settlement.netPayoutAmount)}
              </div>
              <p className="text-[11px] text-muted-foreground">
                All {settlement.openRunsCount} runs and active adjustments will be marked settled.
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
              settlement.isDeficit
                ? "bg-rose-600 hover:bg-rose-700 text-white"
                : "bg-primary text-primary-foreground"
            )}
            onClick={handleConfirm}
          >
            <CheckCircle2 className="size-4 mr-1.5" aria-hidden="true" />
            {settlement.isDeficit
              ? `Offset Runs to Debt (${money(settlement.debtOffsetAmount)})`
              : `Confirm Payout (${money(settlement.netPayoutAmount)})`}
          </Button>
        </div>
      </Card>
    </div>
  );
}
