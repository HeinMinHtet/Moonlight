import React, { useMemo, useState } from "react";
import { AlertCircle, ArrowDownRight, ArrowUpRight, Banknote, CheckCircle2, Lock, ShieldAlert, Wallet } from "lucide-react";
import { mmk, money } from "../../utils/format.js";
import { calculateBoosterSettlement } from "../../utils/boosterBalance.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card } from "@/components/ui/card.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { cn } from "@/lib/utils.js";

export function BoosterSettleDialog({
  isOpen,
  booster = null, // { boosterName, discordId, currentBalance, storedCash }
  records = [],
  adjustments = [],
  defaultRate = 180,
  onConfirm,
  onClose
}) {
  const [rate, setRate] = useState(() => String(defaultRate || 180));
  const [note, setNote] = useState("");

  const key = booster?.discordId || booster?.boosterName || "";

  const openRecords = useMemo(() => {
    if (!isOpen || !booster) return [];
    return records.filter(
      (r) => !r.paid && (r.discordId === key || r.boosterName === key || (booster.discordId && r.discordId === booster.discordId) || r.boosterName === booster.boosterName)
    );
  }, [isOpen, records, key, booster]);

  const activeAdjustments = useMemo(() => {
    if (!isOpen || !booster) return [];
    return adjustments.filter(
      (a) => !a.settled && (a.discordId === key || a.boosterName === key || (booster.discordId && a.discordId === booster.discordId) || a.boosterName === booster.boosterName)
    );
  }, [isOpen, adjustments, key, booster]);

  const settlement = useMemo(() => {
    if (!booster) return {};
    return calculateBoosterSettlement(booster, openRecords, activeAdjustments, Number(rate) || 0);
  }, [booster, openRecords, activeAdjustments, rate]);

  if (!isOpen || !booster) return null;

  const numericRate = Number(rate) || 0;
  const cashAmountMmk = (settlement.netPayoutAmount || 0) * numericRate;

  const handlePayNow = () => {
    onConfirm({
      discordId: booster.discordId || "",
      boosterName: booster.boosterName || "",
      rate: numericRate,
      action: "pay_now",
      note: note.trim()
    });
  };

  const handleHoldCash = () => {
    onConfirm({
      discordId: booster.discordId || "",
      boosterName: booster.boosterName || "",
      rate: numericRate,
      action: "hold_cash",
      note: note.trim()
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <Card className="w-full max-w-xl overflow-hidden border-border/80 bg-popover shadow-2xl">
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
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Breakdown List */}
          <div className="rounded-xl border border-border/70 bg-card/60 divide-y divide-border/40 text-xs sm:text-sm">
            {/* Open Runs */}
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="size-4 text-success-text" aria-hidden="true" />
                <span>
                  Unpaid Runs ({settlement.openRunsCount} completed)
                </span>
              </div>
              <span className="font-mono font-bold text-success-text">
                +{money(settlement.openRunsTotal)}
              </span>
            </div>

            {/* Active Deductions (Loans / Fines / Advances) */}
            {settlement.deductAdjustmentsCount > 0 && (
              <div className="flex items-center justify-between p-3 bg-destructive/5">
                <div className="flex items-center gap-2">
                  <ArrowDownRight className="size-4 text-danger-text" aria-hidden="true" />
                  <div>
                    <span>Active Debt Deductions ({settlement.deductAdjustmentsCount})</span>
                    <small className="block text-[11px] text-muted-foreground">
                      Loans, advance payouts, or penalties
                    </small>
                  </div>
                </div>
                <span className="font-mono font-bold text-danger-text">
                  -{money(settlement.deductAdjustmentsTotal)}
                </span>
              </div>
            )}

            {/* Active Bonuses */}
            {settlement.addAdjustmentsCount > 0 && (
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="size-4 text-info-text" aria-hidden="true" />
                  <span>Credit Bonuses ({settlement.addAdjustmentsCount})</span>
                </div>
                <span className="font-mono font-bold text-info-text">
                  +{money(settlement.addAdjustmentsTotal)}
                </span>
              </div>
            )}
          </div>

          {/* Rate & Cash Conversion Section */}
          {!settlement.isDeficit && (
            <div className="rounded-xl border border-border/80 bg-muted/10 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Label htmlFor="settle-rate" className="text-xs font-bold text-foreground">
                  Exchange Rate (MMK / Gold)
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Rate:</span>
                  <Input
                    id="settle-rate"
                    type="number"
                    min="0"
                    step="any"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="h-8 w-28 text-right font-mono font-bold text-sm bg-background"
                    placeholder="180"
                  />
                  <span className="text-xs font-semibold text-muted-foreground">MMK</span>
                </div>
              </div>

              {/* Cash Conversion Highlight Card */}
              <div className="rounded-lg bg-primary/15 border border-primary/30 p-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs text-info-text/80 font-medium">Converted Payout Value:</span>
                  <div className="text-xl sm:text-2xl font-black font-mono text-info-text">
                    {mmk(cashAmountMmk)}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {money(settlement.netPayoutAmount)} Gold × {numericRate} MMK rate
                  </span>
                </div>
                {booster.storedCash > 0 && (
                  <div className="text-right">
                    <span className="text-[11px] text-muted-foreground block">Currently in Vault:</span>
                    <strong className="text-warning-text font-mono text-sm">{mmk(booster.storedCash)}</strong>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Result Card for Deficit */}
          {settlement.isDeficit ? (
            <Alert variant="destructive" className="bg-destructive/15 border-destructive/30">
              <AlertCircle className="size-4 text-danger-text" />
              <AlertTitle className="text-danger-text">Booster is in Deficit</AlertTitle>
              <AlertDescription className="text-danger-text text-xs space-y-1 mt-1">
                <p>
                  Current balance is <strong className="font-mono font-bold">{money(settlement.currentBalance)}</strong>.
                </p>
                <p>
                  Settling will apply <strong>{money(settlement.openRunsTotal)}</strong> in completed runs toward reducing their debt. Remaining debt after settlement: <strong className="font-mono font-bold">{money(settlement.remainingDebt)}</strong>.
                </p>
                <p className="font-semibold pt-1 text-danger-text">
                  ⚠️ No gold will be traded in-game.
                </p>
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-border/70 p-4 bg-muted/20">
          <Button
            variant="outline"
            type="button"
            onClick={onClose}
          >
            Cancel
          </Button>

          {settlement.isDeficit ? (
            <Button
              type="button"
              className="bg-destructive/90 hover:bg-destructive/90 text-white font-bold shadow-md"
              onClick={handlePayNow}
            >
              <CheckCircle2 className="size-4 mr-1.5" aria-hidden="true" />
              Offset Runs to Debt ({money(settlement.debtOffsetAmount)})
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="font-bold border-warning/40 bg-warning/10 hover:bg-warning/20 text-warning-text gap-1.5"
                onClick={handleHoldCash}
                disabled={numericRate <= 0}
                title="Settle runs and store the converted MMK amount in the booster's vault"
              >
                <Lock className="size-3.5" aria-hidden="true" />
                Hold in Vault ({mmk(cashAmountMmk)})
              </Button>
              <Button
                type="button"
                className="bg-success/90 hover:bg-success text-white font-bold shadow-md gap-1.5"
                onClick={handlePayNow}
              >
                <Banknote className="size-4" aria-hidden="true" />
                Confirm Payout ({money(settlement.netPayoutAmount)})
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
