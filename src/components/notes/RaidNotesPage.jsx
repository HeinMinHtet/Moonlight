import React, { useMemo, useState } from "react";
import { AccessDenied } from "../AccessDenied.jsx";
import { RaidNoteCard } from "./RaidNoteCard.jsx";
import { RaidNoteQuickCreate } from "./RaidNoteQuickCreate.jsx";
import { Search, Pin, Calendar, CheckCircle2, ListTodo, X, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.jsx";
import { cn } from "@/lib/utils.js";

function getLocalDateString(offsetDays = 0) {
  const d = new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatChipDate(dateStr, todayStr, tomorrowStr, yesterdayStr) {
  if (!dateStr) return "No date";
  if (dateStr === todayStr) return "Today";
  if (dateStr === tomorrowStr) return "Tomorrow";
  if (dateStr === yesterdayStr) return "Yesterday";
  try {
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3) {
      const [year, month, day] = parts;
      const d = new Date(year, month - 1, day);
      const currentYear = new Date().getFullYear();
      if (year === currentYear) {
        return d.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric"
        });
      }
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      });
    }
  } catch {
    // fallback
  }
  return dateStr;
}

export function RaidNotesPage({
  isAdmin,
  loading,
  loadError,
  notes = [],
  onCreateNote,
  onUpdateNote,
  onDeleteNote
}) {
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("active"); // 'active' | 'completed'
  const [selectedDate, setSelectedDate] = useState("all"); // 'all' | 'YYYY-MM-DD'

  const todayStr = useMemo(() => getLocalDateString(0), []);
  const tomorrowStr = useMemo(() => getLocalDateString(1), []);
  const yesterdayStr = useMemo(() => getLocalDateString(-1), []);

  // Notes belonging to currently selected tab
  const currentTabNotes = useMemo(() => {
    return notes.filter((n) => (statusTab === "active" ? !n.archived : Boolean(n.archived)));
  }, [notes, statusTab]);

  // Dynamic date chips calculated ONLY from notes in the current tab
  const dateOptions = useMemo(() => {
    const counts = new Map();
    for (const note of currentTabNotes) {
      if (note.raidDate) {
        counts.set(note.raidDate, (counts.get(note.raidDate) || 0) + 1);
      }
    }

    const dates = Array.from(counts.keys());
    if (statusTab === "active") {
      // Ascending chronological for active upcoming runs
      dates.sort((a, b) => a.localeCompare(b));
    } else {
      // Descending chronological for past completed runs
      dates.sort((a, b) => b.localeCompare(a));
    }

    return dates.map((dateStr) => ({
      dateStr,
      label: formatChipDate(dateStr, todayStr, tomorrowStr, yesterdayStr),
      count: counts.get(dateStr)
    }));
  }, [currentTabNotes, statusTab, todayStr, tomorrowStr, yesterdayStr]);

  // Check if a custom date is selected that is not in current dynamic chips
  const isCustomSelected =
    selectedDate !== "all" && !dateOptions.some((d) => d.dateStr === selectedDate);

  // Filter notes based on statusTab, selectedDate, and search
  const filteredNotes = useMemo(() => {
    return currentTabNotes.filter((note) => {
      // 1. Date filter
      if (selectedDate !== "all" && note.raidDate !== selectedDate) {
        return false;
      }

      // 2. Search query (title, raidTime, raidDate, buyer names)
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const titleMatch = String(note.title || "").toLowerCase().includes(query);
        const timeMatch = String(note.raidTime || "").toLowerCase().includes(query);
        const dateMatch = String(note.raidDate || "").toLowerCase().includes(query);
        const buyerMatch = (note.items || []).some((item) =>
          String(item.text || "").toLowerCase().includes(query)
        );
        if (!titleMatch && !timeMatch && !dateMatch && !buyerMatch) return false;
      }

      return true;
    });
  }, [currentTabNotes, selectedDate, search]);

  // Split into pinned and others (for active tab)
  const pinnedNotes = useMemo(
    () => filteredNotes.filter((n) => n.pinned && !n.archived),
    [filteredNotes]
  );
  const otherNotes = useMemo(
    () => filteredNotes.filter((n) => !n.pinned || n.archived),
    [filteredNotes]
  );

  // Stats across all active notes
  const stats = useMemo(() => {
    const activeNotes = notes.filter((n) => !n.archived);
    const completedNotes = notes.filter((n) => Boolean(n.archived));
    const todayNotes = activeNotes.filter((n) => n.raidDate === todayStr);
    let totalBuyers = 0;
    let checkedBuyers = 0;

    for (const n of activeNotes) {
      for (const item of n.items || []) {
        totalBuyers += 1;
        if (item.completed) checkedBuyers += 1;
      }
    }

    return {
      activeCount: activeNotes.length,
      completedCount: completedNotes.length,
      todayNotesCount: todayNotes.length,
      totalBuyers,
      checkedBuyers,
      percent: totalBuyers > 0 ? Math.round((checkedBuyers / totalBuyers) * 100) : 0
    };
  }, [notes, todayStr]);

  const handleStatusTabChange = (newTab) => {
    setStatusTab(newTab);
    setSelectedDate("all"); // Reset date filter to avoid empty state on tab switch
  };

  if (!isAdmin) {
    return <AccessDenied message="Only Discord admins can view raid notes." />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <ListTodo className="size-5 text-primary" />
            Raid Sales Notes & Todo
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Google Keep-style daily raid sessions and buyer checklist tracking.
          </p>
        </div>

        {/* Quick Stat Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="px-2.5 py-1 rounded-md bg-card border border-border flex items-center gap-1.5 font-mono">
            <span className="text-muted-foreground">Today's raids:</span>
            <span className="font-bold text-primary">{stats.todayNotesCount}</span>
          </div>
          <div className="px-2.5 py-1 rounded-md bg-card border border-border flex items-center gap-1.5 font-mono">
            <span className="text-muted-foreground">Total buyers:</span>
            <span className="font-bold text-foreground">{stats.totalBuyers}</span>
          </div>
          <div className="px-2.5 py-1 rounded-md bg-card border border-border flex items-center gap-1.5 font-mono">
            <CheckCircle2 className="size-3 text-emerald-400" />
            <span className="text-muted-foreground">Completed:</span>
            <span className="font-bold text-emerald-400">
              {stats.checkedBuyers} ({stats.percent}%)
            </span>
          </div>
        </div>
      </div>

      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>Failed to load raid notes</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {/* Google Keep Quick-Create Box */}
      <RaidNoteQuickCreate onCreateNote={onCreateNote} />

      {/* Modern Filter Toolbar */}
      <div className="space-y-3 p-3.5 rounded-xl bg-card/60 border border-border shadow-xs">
        {/* Top Row: Search Input & Segmented Tab Switcher */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by buyer name, realm, title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs bg-field/80 border-border/80 rounded-lg focus-visible:ring-1 focus-visible:ring-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                title="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Segmented Tab Switcher: Active vs Completed */}
          <div className="inline-flex p-1 rounded-lg bg-field/90 border border-border/70 self-start sm:self-auto shrink-0 shadow-inner">
            <button
              type="button"
              onClick={() => handleStatusTabChange("active")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                statusTab === "active"
                  ? "bg-card text-primary font-semibold shadow-xs border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ListTodo className="size-3.5" />
              <span>Active</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                  statusTab === "active"
                    ? "bg-primary/15 text-primary font-bold"
                    : "bg-muted/80 text-muted-foreground"
                )}
              >
                {stats.activeCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleStatusTabChange("completed")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                statusTab === "completed"
                  ? "bg-card text-emerald-400 font-semibold shadow-xs border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CheckCircle2 className="size-3.5" />
              <span>Completed</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                  statusTab === "completed"
                    ? "bg-emerald-500/15 text-emerald-400 font-bold"
                    : "bg-muted/80 text-muted-foreground"
                )}
              >
                {stats.completedCount}
              </span>
            </button>
          </div>
        </div>

        {/* Bottom Row: Dynamic Date Chips & Date Picker */}
        <div className="pt-2 border-t border-border/40 flex flex-wrap items-center gap-1.5 text-xs">
          <div className="flex items-center gap-1 text-muted-foreground font-medium mr-1 text-[11px] shrink-0">
            <Calendar className="size-3.5" />
            <span>Dates:</span>
          </div>

          {/* "All" chip */}
          <button
            type="button"
            onClick={() => setSelectedDate("all")}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 border",
              selectedDate === "all"
                ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                : "bg-secondary/40 text-muted-foreground border-border/60 hover:bg-secondary hover:text-foreground"
            )}
          >
            <span>All</span>
            <span
              className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                selectedDate === "all"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-background/80 text-muted-foreground"
              )}
            >
              {currentTabNotes.length}
            </span>
          </button>

          {/* Dynamic date chips for dates that actually have notes in current tab */}
          {dateOptions.map((chip) => {
            const isSelected = selectedDate === chip.dateStr;
            return (
              <button
                key={chip.dateStr}
                type="button"
                onClick={() => setSelectedDate(isSelected ? "all" : chip.dateStr)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 border",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                    : "bg-secondary/40 text-muted-foreground border-border/60 hover:bg-secondary hover:text-foreground"
                )}
                title={`Filter by ${chip.dateStr}`}
              >
                <span>{chip.label}</span>
                <span
                  className={cn(
                    "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                    isSelected
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-background/80 text-muted-foreground"
                  )}
                >
                  {chip.count}
                </span>
              </button>
            );
          })}

          {/* Selected custom date pill (if date picked is not in dynamic chips list) */}
          {isCustomSelected && (
            <div className="px-2.5 py-1 rounded-md text-xs font-semibold bg-primary text-primary-foreground border border-primary shadow-xs flex items-center gap-1.5 shrink-0">
              <span>{formatChipDate(selectedDate, todayStr, tomorrowStr, yesterdayStr)}</span>
              <button
                type="button"
                onClick={() => setSelectedDate("all")}
                className="text-primary-foreground/80 hover:text-primary-foreground ml-0.5"
                title="Clear date filter"
              >
                <X className="size-3" />
              </button>
            </div>
          )}

          {/* Date Picker Input */}
          <div className="flex items-center gap-1 ml-auto shrink-0">
            <div className="relative flex items-center">
              <input
                type="date"
                aria-label="Pick date"
                value={selectedDate === "all" ? "" : selectedDate}
                onChange={(e) => setSelectedDate(e.target.value || "all")}
                className={cn(
                  "h-7 text-xs px-2 rounded-md border transition-colors cursor-pointer bg-field/70 border-border/60 text-foreground hover:bg-secondary/60 focus:outline-none focus:ring-1 focus:ring-primary",
                  selectedDate !== "all" && "border-primary font-semibold"
                )}
              />
            </div>
            {selectedDate !== "all" && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSelectedDate("all")}
                className="size-7 text-muted-foreground hover:text-foreground"
                title="Reset to all dates"
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-12 rounded-xl border border-dashed border-border bg-card/30 p-8">
          {statusTab === "completed" ? (
            <CheckCircle2 className="size-10 text-muted-foreground/40 mx-auto mb-3" />
          ) : (
            <ListTodo className="size-10 text-muted-foreground/40 mx-auto mb-3" />
          )}
          <h3 className="text-sm font-semibold text-foreground">
            {search || selectedDate !== "all"
              ? "No raid notes match your filter"
              : statusTab === "completed"
              ? "No completed raid notes"
              : "No active raid notes"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {search || selectedDate !== "all" ? (
              "Try adjusting your search terms or date filter."
            ) : statusTab === "completed" ? (
              "When you mark active raid runs as completed, they will appear here."
            ) : (
              "Use the 'Take a raid note' box above to quickly record your first raid run and buyer checklist!"
            )}
          </p>
          {(search || selectedDate !== "all") && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setSelectedDate("all");
              }}
              className="mt-3 text-xs gap-1"
            >
              <RotateCcw className="size-3" />
              Reset filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pinned Notes Section (Active tab only) */}
          {statusTab === "active" && pinnedNotes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 tracking-wider uppercase">
                <Pin className="size-3.5 fill-amber-400" />
                Pinned ({pinnedNotes.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pinnedNotes.map((note) => (
                  <RaidNoteCard
                    key={note.id}
                    note={note}
                    onUpdateNote={onUpdateNote}
                    onDeleteNote={onDeleteNote}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Others / Completed Section */}
          {otherNotes.length > 0 && (
            <div className="space-y-3">
              {statusTab === "active" && pinnedNotes.length > 0 ? (
                <div className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
                  Others ({otherNotes.length})
                </div>
              ) : statusTab === "completed" ? (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 tracking-wider uppercase">
                  <CheckCircle2 className="size-3.5 text-emerald-400" />
                  Completed Notes ({otherNotes.length})
                </div>
              ) : null}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {otherNotes.map((note) => (
                  <RaidNoteCard
                    key={note.id}
                    note={note}
                    onUpdateNote={onUpdateNote}
                    onDeleteNote={onDeleteNote}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

