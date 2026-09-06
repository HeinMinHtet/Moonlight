import React, { useState, useRef } from "react";
import {
  Pin,
  PinOff,
  Copy,
  Check,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Plus,
  Palette,
  Clock,
  Calendar,
  X,
  Pencil
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu.jsx";
import { cn } from "@/lib/utils.js";
import { toast } from "sonner";

const CARD_COLORS = {
  default: "bg-card/90 border-border text-foreground",
  blue: "bg-sky-950/30 border-sky-500/30 text-sky-100",
  purple: "bg-purple-950/30 border-purple-500/30 text-purple-100",
  emerald: "bg-emerald-950/30 border-emerald-500/30 text-emerald-100",
  amber: "bg-amber-950/30 border-amber-500/30 text-amber-100",
  rose: "bg-rose-950/30 border-rose-500/30 text-rose-100"
};

const COLOR_MENU_ITEMS = [
  { id: "default", label: "Default Slate" },
  { id: "blue", label: "Sky (Heroic)" },
  { id: "purple", label: "Purple (Mythic)" },
  { id: "emerald", label: "Emerald (Normal)" },
  { id: "amber", label: "Amber (Gold)" },
  { id: "rose", label: "Rose" }
];

export function RaidNoteCard({ note, onUpdateNote, onDeleteNote }) {
  const [newBuyer, setNewBuyer] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedItemId, setCopiedItemId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(note.title || "");
  const [dateDraft, setDateDraft] = useState(note.raidDate || "");
  const [timeDraft, setTimeDraft] = useState(note.raidTime || "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  const items = Array.isArray(note.items) ? note.items : [];
  const totalItems = items.length;
  const completedCount = items.filter((item) => item.completed).length;
  const percent = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  const colorClass = CARD_COLORS[note.color] || CARD_COLORS.default;

  const handleToggleItem = async (itemId, completed) => {
    const updatedItems = items.map((item) => (item.id === itemId ? { ...item, completed } : item));
    await onUpdateNote(note.id, { items: updatedItems });
  };

  const handleDeleteItem = async (itemId) => {
    const updatedItems = items.filter((item) => item.id !== itemId);
    await onUpdateNote(note.id, { items: updatedItems });
  };

  const handleCopyBuyerName = async (item, e) => {
    e?.stopPropagation?.();
    const text = String(item?.text || "").trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItemId(item.id);
      toast.success(`Copied "${text}"`);
      setTimeout(() => {
        setCopiedItemId((current) => (current === item.id ? null : current));
      }, 1800);
    } catch {
      toast.error("Failed to copy to clipboard.");
    }
  };

  const handleAddBuyer = async () => {
    const trimmed = newBuyer.trim();
    if (!trimmed) return;

    // Support multi-line paste directly in this field
    const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const newItems = lines.map((text) => ({
      text,
      completed: false
    }));

    const updatedItems = [...items, ...newItems];
    await onUpdateNote(note.id, { items: updatedItems });
    setNewBuyer("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddBuyer();
    }
  };

  const handleCopyBuyers = async () => {
    const title = String(note.title || "").trim();
    const time = String(note.raidTime || "").trim();

    // Check if title already includes the time (e.g. "10 am" vs "10:00 AM")
    const cleanTitle = title.toLowerCase().replace(/[:\s]/g, "");
    const cleanTime = time.toLowerCase().replace(/[:\s]/g, "");
    const normalizedTime = cleanTime.replace(/00(?=[ap]m)/, "");

    let header = title;
    if (time && (!cleanTime || !cleanTitle.includes(normalizedTime))) {
      header = `${title} ${time}`;
    }

    const buyerLines = items.map((item) => item.text).filter(Boolean);
    const textToCopy = buyerLines.length > 0 ? `${header}\n${buyerLines.join("\n")}` : header;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success("Copied raid title, time & buyers to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard.");
    }
  };

  const handleStartEdit = () => {
    setTitleDraft(note.title || "");
    setDateDraft(note.raidDate || "");
    setTimeDraft(note.raidTime || "");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setTitleDraft(note.title || "");
    setDateDraft(note.raidDate || "");
    setTimeDraft(note.raidTime || "");
    setIsEditing(false);
  };

  const handleSaveDetails = async () => {
    const trimmedTitle = titleDraft.trim();
    if (!trimmedTitle) {
      toast.error("Raid title cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      await onUpdateNote(note.id, {
        title: trimmedTitle,
        raidDate: dateDraft || "",
        raidTime: timeDraft.trim()
      });
      setIsEditing(false);
      toast.success("Raid details updated!");
    } catch {
      toast.error("Failed to update raid details.");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePin = async () => {
    await onUpdateNote(note.id, { pinned: !note.pinned });
  };

  const handleToggleComplete = async () => {
    await onUpdateNote(note.id, { archived: !note.archived });
    toast.success(note.archived ? "Raid restored to Active." : "Raid marked as Completed!");
  };

  const handleChangeColor = async (colorId) => {
    await onUpdateNote(note.id, { color: colorId });
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-xl border p-4 shadow-sm hover:shadow-md transition-all",
        colorClass,
        note.pinned && "ring-1 ring-amber-400/40"
      )}
    >
      {/* Header: Normal mode vs Edit Mode for Title, Date & Time */}
      {isEditing ? (
        <div className="space-y-2 mb-3 pb-2.5 border-b border-border/40">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
              <Pencil className="size-3" />
              Edit Details
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                disabled={saving}
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveDetails}
                disabled={saving}
                className="h-6 px-2.5 text-xs font-semibold gap-1 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
              >
                <Check className="size-3" />
                Save
              </Button>
            </div>
          </div>

          {/* Title input */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground block mb-0.5">
              Title
            </label>
            <Input
              aria-label="Edit raid title"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveDetails();
                if (e.key === "Escape") handleCancelEdit();
              }}
              placeholder="Raid Title (e.g. Heroic 8/8 10 am)"
              className="h-7 text-xs font-bold bg-field/90 border-border/80 focus-visible:ring-1 focus-visible:ring-primary"
              autoFocus
            />
          </div>

          {/* Date & Time Row */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block mb-0.5 flex items-center gap-1">
                <Calendar className="size-2.5" />
                Date
              </label>
              <Input
                type="date"
                aria-label="Edit raid date"
                value={dateDraft}
                onChange={(e) => setDateDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveDetails();
                  if (e.key === "Escape") handleCancelEdit();
                }}
                className="h-7 text-xs bg-field/90 border-border/80 px-2 cursor-pointer focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-medium text-muted-foreground block mb-0.5 flex items-center gap-1">
                <Clock className="size-2.5" />
                Time
              </label>
              <Input
                type="text"
                aria-label="Edit raid time"
                value={timeDraft}
                onChange={(e) => setTimeDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveDetails();
                  if (e.key === "Escape") handleCancelEdit();
                }}
                placeholder="e.g. 10:00 AM"
                className="h-7 text-xs font-mono bg-field/90 border-border/80 px-2 focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-border/30">
          {/* Title area */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <h3
              onClick={handleStartEdit}
              className="text-sm font-bold truncate cursor-pointer hover:underline decoration-dashed decoration-primary underline-offset-4 text-foreground"
              title="Click to edit details"
            >
              {note.title}
            </h3>
          </div>

          {/* Right side: Time Badge, Date Badge, Edit Button, and Pin Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            {note.raidTime && (
              <Badge
                variant="outline"
                onClick={handleStartEdit}
                className="px-1.5 py-0.5 text-[11px] font-mono font-semibold bg-sky-500/15 text-sky-300 border-sky-500/30 flex items-center gap-1 cursor-pointer hover:bg-sky-500/25 transition-colors"
                title="Click to edit raid time"
              >
                <Clock className="size-3 text-sky-400" />
                {note.raidTime}
              </Badge>
            )}

            {note.raidDate && (
              <Badge
                variant="outline"
                onClick={handleStartEdit}
                className="px-1.5 py-0.5 text-[11px] font-mono bg-field/70 text-muted-foreground border-border/60 flex items-center gap-1 cursor-pointer hover:bg-field transition-colors"
                title="Click to edit raid date"
              >
                <Calendar className="size-3 text-muted-foreground/80" />
                {note.raidDate}
              </Badge>
            )}

            {note.archived && (
              <Badge
                variant="outline"
                className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
              >
                Completed
              </Badge>
            )}

            {/* Edit button in header */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleStartEdit}
              className="size-7 text-muted-foreground opacity-60 hover:opacity-100 hover:text-primary transition-opacity"
              title="Edit title, date & time"
              aria-label="Edit title, date & time"
            >
              <Pencil className="size-3.5" />
            </Button>

            {/* Pin toggle */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleTogglePin}
              className={cn(
                "size-7 transition-opacity ml-0.5",
                note.pinned
                  ? "text-amber-400 fill-amber-400 opacity-100"
                  : "text-muted-foreground opacity-60 hover:opacity-100 hover:text-amber-400"
              )}
              title={note.pinned ? "Unpin note" : "Pin note"}
            >
              {note.pinned ? <Pin className="size-3.5 fill-amber-400" /> : <PinOff className="size-3.5" />}
            </Button>
          </div>
        </div>
      )}

      {/* Progress Bar (if items exist) */}
      {totalItems > 0 && (
        <div className="mb-3 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Buyers checked</span>
            <span className="font-mono font-medium">
              {completedCount}/{totalItems} ({percent}%)
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-field/80">
            <div
              className={cn(
                "h-full transition-all duration-300",
                percent === 100 ? "bg-emerald-500" : "bg-primary"
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Checklist - All Items directly visible, completed items crossed out with line */}
      <div className="space-y-1 flex-1">
        {items.map((item) => {
          const isDone = Boolean(item.completed);
          return (
            <div
              key={item.id}
              className={cn(
                "group/item flex items-center justify-between gap-2 px-1.5 py-1 rounded hover:bg-black/10 transition-colors",
                isDone && "opacity-60"
              )}
            >
              <label
                className={cn(
                  "flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer select-none",
                  isDone && "line-through text-muted-foreground"
                )}
              >
                <Checkbox
                  checked={isDone}
                  onCheckedChange={(checked) => handleToggleItem(item.id, Boolean(checked))}
                  className="size-4 shrink-0"
                />
                <span className="text-xs font-mono truncate">{item.text}</span>
              </label>

              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={(e) => handleCopyBuyerName(item, e)}
                  className={cn(
                    "p-1 rounded text-muted-foreground/60 hover:text-foreground hover:bg-black/15 transition-colors",
                    copiedItemId === item.id && "text-emerald-400 hover:text-emerald-400"
                  )}
                  title={`Copy ${item.text}`}
                  aria-label={`Copy ${item.text}`}
                >
                  {copiedItemId === item.id ? (
                    <Check className="size-3 text-emerald-400" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteItem(item.id)}
                  className="p-1 rounded text-muted-foreground/50 hover:text-destructive hover:bg-black/15 opacity-0 group-hover/item:opacity-100 transition-opacity"
                  title="Delete item"
                  aria-label={`Delete ${item.text}`}
                >
                  <X className="size-3" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Rapid Inline Add Input */}
        <div className="flex items-center gap-2 pt-1">
          <Plus className="size-3.5 text-muted-foreground shrink-0 ml-1" />
          <Input
            ref={inputRef}
            placeholder="Add buyer (hit Enter)..."
            value={newBuyer}
            onChange={(e) => setNewBuyer(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-7 text-xs font-mono bg-transparent border-none px-1 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60"
          />
          {newBuyer.trim() && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleAddBuyer}
              className="h-6 text-[11px] px-2 text-primary"
            >
              Add
            </Button>
          )}
        </div>
      </div>

      {/* Card Footer Toolbar */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/40 text-muted-foreground">
        {/* Left: Copy title, time & buyer names */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCopyBuyers}
          className="h-7 px-2 text-xs hover:text-primary gap-1"
          title="Copy title, time and buyer names to clipboard"
        >
          {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
          <span>{copied ? "Copied" : "Copy list"}</span>
        </Button>

        {/* Right actions: Edit, Color, Archive, Delete */}
        <div className="flex items-center gap-1">
          {/* Edit details */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleStartEdit}
            className="size-7 hover:text-primary text-muted-foreground"
            title="Edit title, date & time"
            aria-label="Edit details"
          >
            <Pencil className="size-3.5" />
          </Button>

          {/* Color dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="size-7 hover:text-primary" title="Change color">
                <Palette className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              {COLOR_MENU_ITEMS.map((c) => (
                <DropdownMenuItem key={c.id} onClick={() => handleChangeColor(c.id)} className="text-xs">
                  <span className={cn("size-2.5 rounded-full mr-2 border", CARD_COLORS[c.id])} />
                  {c.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mark Complete / Restore to Active */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleToggleComplete}
            className={cn(
              "size-7 transition-colors",
              note.archived
                ? "text-muted-foreground hover:text-sky-400 hover:bg-sky-500/10"
                : "text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10"
            )}
            title={note.archived ? "Restore to Active" : "Mark as Completed"}
          >
            {note.archived ? <RotateCcw className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
          </Button>

          {/* Delete */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onDeleteNote(note.id)}
            className="size-7 hover:text-destructive"
            title="Delete note"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
