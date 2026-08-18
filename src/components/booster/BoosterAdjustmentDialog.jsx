import React, { useEffect, useState } from "react";
import { money } from "../../utils/format.js";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { NativeSelect } from "@/components/ui/native-select.jsx";
import { cn } from "@/lib/utils.js";

export function BoosterAdjustmentDialog({
  isOpen,
  mode = "create", // "create" | "edit"
  initialData = null, // for edit or pre-selected booster
  boosters = [], // array of { boosterName, discordId, currentBalance }
  onSave,
  onClose
}) {
  const [boosterName, setBoosterName] = useState("");
  const [discordId, setDiscordId] = useState("");
  const [type, setType] = useState("add"); // "add" | "deduct"
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setBoosterName(initialData.boosterName || "");
        setDiscordId(initialData.discordId || "");
        setType(initialData.type || "add");
        setAmount(initialData.amount != null ? String(initialData.amount) : "");
        setNote(initialData.note || "");
        setDate(initialData.date || new Date().toISOString().slice(0, 10));
      } else {
        setBoosterName(boosters[0]?.boosterName || "");
        setDiscordId(boosters[0]?.discordId || "");
        setType("add");
        setAmount("");
        setNote("");
        setDate(new Date().toISOString().slice(0, 10));
      }
      setError("");
    }
  }, [isOpen, initialData, boosters]);

  if (!isOpen) return null;

  const currentBoosterInfo = boosters.find(
    (b) => (discordId && b.discordId === discordId) || b.boosterName === boosterName
  );
  const existingBalance = currentBoosterInfo ? Number(currentBoosterInfo.currentBalance || 0) : 0;
  const numericAmount = Number(amount || 0);

  // Live preview calculation
  const newProjectedBalance =
    type === "add" ? existingBalance + numericAmount : existingBalance - numericAmount;

  const handleBoosterChange = (selectedName) => {
    setBoosterName(selectedName);
    const found = boosters.find((b) => b.boosterName === selectedName);
    setDiscordId(found?.discordId || "");
  };

  const handleDeductFullBalance = () => {
    if (existingBalance > 0) {
      setAmount(String(existingBalance));
      setType("deduct");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    const cleanName = String(boosterName || "").trim();
    if (!cleanName) {
      setError("Please select or enter a booster name.");
      return;
    }
    const cleanAmount = Number(amount);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      setError("Adjustment amount must be a positive number greater than 0.");
      return;
    }
    const cleanNote = String(note || "").trim();
    if (!cleanNote) {
      setError("Please provide a reason / note for this adjustment.");
      return;
    }

    onSave({
      boosterName: cleanName,
      discordId: discordId || cleanName,
      type,
      amount: cleanAmount,
      note: cleanNote,
      date
    });
  };

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="adjustment-dialog-title">
      <div className="confirm-dialog max-w-md w-full rounded-2xl border border-border/90 bg-card/95 p-6 shadow-2xl backdrop-blur-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between border-b border-border/70 pb-3">
            <div>
              <h3 id="adjustment-dialog-title" className="text-lg font-bold text-foreground">
                {mode === "edit" ? "Edit Balance Adjustment" : "Add / Deduct Booster Balance"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {mode === "edit"
                  ? "Update adjustment reason, amount, or date."
                  : "Credit a bonus or debit a payout/penalty for a booster."}
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-rose-500/15 border border-rose-500/30 p-2.5 text-xs font-semibold text-rose-300" role="alert">
              {error}
            </div>
          )}

          {/* Booster Selection */}
          <Label className="flex flex-col gap-1.5 text-xs font-bold text-foreground">
            <span>Booster</span>
            {mode === "edit" ? (
              <Input value={boosterName} disabled className="bg-muted/50 font-semibold cursor-not-allowed" />
            ) : boosters.length > 0 ? (
              <NativeSelect
                value={boosterName}
                onChange={(e) => handleBoosterChange(e.target.value)}
                className="w-full"
              >
                {boosters.map((b) => (
                  <option key={b.discordId || b.boosterName} value={b.boosterName}>
                    {b.boosterName} (Current: {money(b.currentBalance)})
                  </option>
                ))}
              </NativeSelect>
            ) : (
              <Input
                placeholder="Booster Discord name"
                value={boosterName}
                onChange={(e) => setBoosterName(e.target.value)}
                required
              />
            )}
          </Label>

          {/* Type Toggle: Add (+) vs Deduct (-) */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-foreground">Adjustment Type</span>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl border border-border/70 bg-muted/30">
              <button
                type="button"
                className={cn(
                  "py-2 text-xs font-bold rounded-lg transition-all cursor-pointer",
                  type === "add"
                    ? "bg-emerald-500 text-slate-950 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setType("add")}
              >
                + Add Balance (Credit)
              </button>
              <button
                type="button"
                className={cn(
                  "py-2 text-xs font-bold rounded-lg transition-all cursor-pointer",
                  type === "deduct"
                    ? "bg-rose-500 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setType("deduct")}
              >
                - Deduct Balance (Debit)
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Amount ($)</span>
              {/* Suggestion #4: 1-Click Deduct Full Balance Shortcut */}
              {type === "deduct" && existingBalance > 0 && (
                <button
                  type="button"
                  onClick={handleDeductFullBalance}
                  className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                >
                  Deduct Full Balance ({money(existingBalance)})
                </button>
              )}
            </div>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono text-base font-semibold"
              required
              autoFocus
            />
          </div>

          {/* Reason / Note */}
          <Label className="flex flex-col gap-1.5 text-xs font-bold text-foreground">
            <span>Reason / Note</span>
            <Input
              placeholder="e.g. Weekly performance bonus, Advance payout, Penalty, etc."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required
            />
          </Label>

          {/* Date */}
          <Label className="flex flex-col gap-1.5 text-xs font-bold text-foreground">
            <span>Date</span>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </Label>

          {/* Live Preview Bar */}
          {currentBoosterInfo && (
            <div className="rounded-xl border border-border/60 bg-muted/40 p-3 text-xs flex items-center justify-between">
              <span className="text-muted-foreground">Resulting Balance:</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground line-through">{money(existingBalance)}</span>
                <span className="font-bold text-sm text-foreground">
                  → <span className={newProjectedBalance < 0 ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>{money(newProjectedBalance)}</span>
                </span>
              </div>
            </div>
          )}

          {/* Dialog Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/70">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className={cn(
                "font-bold",
                type === "deduct"
                  ? "bg-rose-500 hover:bg-rose-600 text-white"
                  : "bg-primary text-primary-foreground"
              )}
            >
              {mode === "edit" ? "Save Changes" : type === "add" ? "Add Balance" : "Deduct Balance"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
