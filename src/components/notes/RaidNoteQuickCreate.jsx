import React, { useState, useRef } from "react";
import { Plus, Pin, PinOff, Palette, Check, X, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { cn } from "@/lib/utils.js";

const COLOR_OPTIONS = [
  { id: "default", label: "Default", bg: "bg-slate-800/60 border-slate-700" },
  { id: "blue", label: "Sky / Heroic", bg: "bg-sky-950/40 border-sky-500/40 text-sky-300" },
  { id: "purple", label: "Purple / Mythic", bg: "bg-purple-950/40 border-purple-500/40 text-purple-300" },
  { id: "emerald", label: "Emerald / Normal", bg: "bg-emerald-950/40 border-emerald-500/40 text-emerald-300" },
  { id: "amber", label: "Amber / Gold", bg: "bg-amber-950/40 border-amber-500/40 text-amber-300" },
  { id: "rose", label: "Rose", bg: "bg-rose-950/40 border-rose-500/40 text-rose-300" }
];

export function RaidNoteQuickCreate({ onCreateNote }) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [raidDate, setRaidDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [raidTime, setRaidTime] = useState("");
  const [color, setColor] = useState("default");
  const [pinned, setPinned] = useState(false);
  const [buyers, setBuyers] = useState([]);
  const [buyerInput, setBuyerInput] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const buyerInputRef = useRef(null);

  const handleAddBuyer = () => {
    const trimmed = buyerInput.trim();
    if (!trimmed) return;
    setBuyers((prev) => [...prev, { text: trimmed, completed: false }]);
    setBuyerInput("");
    buyerInputRef.current?.focus();
  };

  const handleBuyerKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddBuyer();
    }
  };

  const handleRemoveBuyer = (index) => {
    setBuyers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleApplyBulkText = () => {
    const lines = bulkText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length > 0) {
      setBuyers((prev) => [...prev, ...lines.map((text) => ({ text, completed: false }))]);
    }
    setBulkText("");
    setBulkMode(false);
  };

  const handleReset = () => {
    setTitle("");
    setRaidDate(new Date().toISOString().slice(0, 10));
    setRaidTime("");
    setColor("default");
    setPinned(false);
    setBuyers([]);
    setBuyerInput("");
    setBulkMode(false);
    setBulkText("");
    setExpanded(false);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    let finalBuyers = [...buyers];
    if (buyerInput.trim()) {
      finalBuyers.push({ text: buyerInput.trim(), completed: false });
    }

    setSubmitting(true);
    try {
      await onCreateNote({
        title: cleanTitle,
        raidDate: raidDate || new Date().toISOString().slice(0, 10),
        raidTime: raidTime.trim(),
        color,
        pinned,
        items: finalBuyers
      });
      handleReset();
    } finally {
      setSubmitting(false);
    }
  };

  if (!expanded) {
    return (
      <div
        onClick={() => setExpanded(true)}
        className="w-full max-w-2xl mx-auto rounded-xl border border-border bg-card/80 p-3.5 shadow-md hover:border-primary/50 transition-all cursor-pointer flex items-center justify-between text-muted-foreground hover:text-foreground"
      >
        <div className="flex items-center gap-3">
          <Plus className="size-5 text-primary" />
          <span className="text-sm font-medium">Take a raid note... (e.g. Heroic 8/8 10 am)</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs bg-secondary/50">
            Checklist mode
          </Badge>
        </div>
      </div>
    );
  }

  const selectedColorOption = COLOR_OPTIONS.find((c) => c.id === color) || COLOR_OPTIONS[0];

  return (
    <div
      className={cn(
        "w-full max-w-2xl mx-auto rounded-xl border p-4 shadow-xl transition-all space-y-4",
        selectedColorOption.bg
      )}
    >
      {/* Header: Title & Pin button */}
      <div className="flex items-start justify-between gap-2">
        <Input
          placeholder="Raid Title (e.g. Heroic 8/8 10 am, Mythic 4/8 8pm)..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          className="text-base font-semibold border-none bg-transparent px-1 focus-visible:ring-0 placeholder:text-muted-foreground/70"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setPinned(!pinned)}
          className="shrink-0 size-8 text-muted-foreground hover:text-primary"
          title={pinned ? "Unpin note" : "Pin note to top"}
        >
          {pinned ? <Pin className="size-4 text-amber-400 fill-amber-400" /> : <PinOff className="size-4" />}
        </Button>
      </div>

      {/* Date & Time fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-1">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Raid Date</label>
          <Input
            type="date"
            value={raidDate}
            onChange={(e) => setRaidDate(e.target.value)}
            className="h-9 text-xs bg-field/80 border-border"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Raid Time / Slots</label>
          <Input
            placeholder="e.g. 10:00 AM or 10pm +11:59pm"
            value={raidTime}
            onChange={(e) => setRaidTime(e.target.value)}
            className="h-9 text-xs bg-field/80 border-border"
          />
        </div>
      </div>

      {/* Buyer Checklist Entries */}
      <div className="space-y-2 pt-1 px-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-muted-foreground">
            Buyer Todo Checklist ({buyers.length})
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setBulkMode(!bulkMode)}
            className="h-6 text-xs text-primary hover:text-primary/80 px-1.5"
          >
            <ClipboardPaste className="size-3.5 mr-1" />
            {bulkMode ? "Single entry" : "Paste multiple"}
          </Button>
        </div>

        {bulkMode ? (
          <div className="space-y-2">
            <textarea
              rows={3}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"Paste buyer names (one per line):\nVeliandina-tichondrius\nSquatchlace-Tichondrius"}
              className="w-full rounded-md border border-border bg-field/80 p-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setBulkMode(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={handleApplyBulkText} disabled={!bulkText.trim()}>
                Add Lines
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              ref={buyerInputRef}
              placeholder="Type buyer (e.g. silverdaddy-illidan) and press Enter..."
              value={buyerInput}
              onChange={(e) => setBuyerInput(e.target.value)}
              onKeyDown={handleBuyerKeyDown}
              className="h-9 text-xs bg-field/80 border-border flex-1 font-mono"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleAddBuyer}
              disabled={!buyerInput.trim()}
              className="h-9 text-xs"
            >
              Add
            </Button>
          </div>
        )}

        {/* Existing Added Buyers Badges / List */}
        {buyers.length > 0 && (
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {buyers.map((buyer, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-field/60 border border-border/50 text-xs font-mono"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="size-1.5 rounded-full bg-primary/70 shrink-0" />
                  <span className="truncate">{buyer.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveBuyer(idx)}
                  className="text-muted-foreground hover:text-destructive p-0.5 rounded"
                  title="Remove buyer"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer controls: Color picker & Submit buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40">
        <div className="flex items-center gap-1.5">
          <Palette className="size-4 text-muted-foreground mr-1" />
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setColor(c.id)}
              className={cn(
                "size-5 rounded-full border transition-transform flex items-center justify-center",
                c.bg,
                color === c.id ? "ring-2 ring-primary scale-110" : "opacity-70 hover:opacity-100"
              )}
              title={c.label}
            >
              {color === c.id && <Check className="size-2.5 text-current" />}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button type="button" variant="ghost" size="sm" onClick={handleReset} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={!title.trim() || submitting}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {submitting ? "Saving..." : "Save Note"}
          </Button>
        </div>
      </div>
    </div>
  );
}
