import React, { useState } from "react";
import { Banknote, CheckCircle2 } from "lucide-react";
import { mmk } from "../../utils/format.js";
import { validateVaultWithdrawalPayload } from "../../utils/boosterBalance.js";
import { Alert, AlertDescription } from "@/components/ui/alert.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card } from "@/components/ui/card.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { NativeSelect } from "@/components/ui/native-select.jsx";

export function BoosterVaultWithdrawDialog({
  isOpen,
  booster = null, // { boosterName, discordId, storedCash }
  onWithdraw,
  onClose
}) {
  const currentBalance = Number(booster?.storedCash || 0);

  const [amount, setAmount] = useState(() => String(currentBalance > 0 ? currentBalance : ""));
  const [paymentMethod, setPaymentMethod] = useState("KBZPay");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !booster) return null;

  const handleSetFullAmount = () => {
    setAmount(String(currentBalance));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      validateVaultWithdrawalPayload({
        boosterName: booster.boosterName,
        amount,
        currentVaultBalance: currentBalance,
        note,
        date
      });

      setIsSubmitting(true);
      await onWithdraw({
        discordId: booster.discordId || "",
        boosterName: booster.boosterName || "",
        amount: Number(amount),
        paymentMethod,
        date,
        note: note.trim()
      });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to process withdrawal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <Card className="w-full max-w-md overflow-hidden border-border/80 bg-popover shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 p-4 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Banknote className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Release Stored Cash</h3>
              <p className="text-xs text-muted-foreground">
                Pay held MMK funds to <strong className="text-foreground">{booster.boosterName}</strong>
              </p>
            </div>
          </div>
          <Badge variant="success" className="font-mono font-bold">
            {mmk(currentBalance)}
          </Badge>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Current Vault Balance Info */}
          <div className="rounded-xl border border-border/70 bg-card/60 p-3.5 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground block">Available in Vault</span>
              <strong className="text-lg font-mono font-bold text-emerald-400">
                {mmk(currentBalance)}
              </strong>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 px-2.5 font-semibold border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
              onClick={handleSetFullAmount}
            >
              Max / Full Amount
            </Button>
          </div>

          {/* Amount to Release */}
          <div className="space-y-1.5">
            <Label htmlFor="withdraw-amount" className="text-xs font-bold">
              Release Amount (MMK) <span className="text-rose-400">*</span>
            </Label>
            <div className="relative">
              <Input
                id="withdraw-amount"
                type="number"
                min="1"
                max={currentBalance}
                step="any"
                required
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError("");
                }}
                placeholder="e.g. 50000"
                className="font-mono font-bold text-base h-10 pr-14"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                MMK
              </span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-1.5">
            <Label htmlFor="withdraw-method" className="text-xs font-bold">
              Payment Channel / Method
            </Label>
            <NativeSelect
              id="withdraw-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="h-9 text-xs sm:text-sm"
            >
              <option value="KBZPay">KBZPay (KPay)</option>
              <option value="WavePay">WavePay</option>
              <option value="CBPay">CBPay</option>
              <option value="AYA Pay">AYA Pay</option>
              <option value="Bank Transfer">Direct Bank Transfer</option>
              <option value="Cash / In-Game">Cash / In-Game Handover</option>
              <option value="Other">Other Channel</option>
            </NativeSelect>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="withdraw-date" className="text-xs font-bold">
              Payment Date
            </Label>
            <Input
              id="withdraw-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 text-xs sm:text-sm"
            />
          </div>

          {/* Payment Note / Reference */}
          <div className="space-y-1.5">
            <Label htmlFor="withdraw-note" className="text-xs font-bold">
              Payment Note / Tx Reference <span className="text-rose-400">*</span>
            </Label>
            <Input
              id="withdraw-note"
              type="text"
              required
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setError("");
              }}
              placeholder="e.g. Sent via KPay to 09xxxxxxxxx (Ref: #12345)"
              className="h-9 text-xs sm:text-sm"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/70">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !Number(amount) || Number(amount) <= 0 || Number(amount) > currentBalance}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md gap-1.5"
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Confirm Cashout ({mmk(amount)})
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
