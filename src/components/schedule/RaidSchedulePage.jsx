import React, { useMemo, useState } from "react";
import { AccessDenied } from "../AccessDenied.jsx";
import {
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Plus,
  Search,
  Trash2,
  Users,
  CheckCircle2,
  RotateCcw,
  X,
  Swords,
  Lock,
  Unlock
} from "lucide-react";
import { Input } from "@/components/ui/input.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.jsx";
import { cn } from "@/lib/utils.js";
import { toast as notify } from "sonner";

// Default standard WoW raids in current season
const DEFAULT_RAIDS = [
  "Liberation of Undermine",
  "Nerub-ar Palace",
  "Blackrock Depths"
];

// Difficulty options
const DIFFICULTIES = ["Normal", "Heroic", "Mythic"];

// Loot options
const LOOT_OPTIONS = [
  { value: "Unsaved", label: "Unsaved (Fresh Lockout)", short: "Unsaved" },
  { value: "Saved", label: "Saved (Team Locked)", short: "Saved" }
];

// Helper: Get Tuesday-anchored week dates (Tuesday to Monday)
function getLockoutWeekDays(weekOffset = 0) {
  const now = new Date();
  const day = now.getDay(); // 0 is Sunday, 2 is Tuesday
  // Calculate days back to most recent Tuesday
  const diffToTuesday = (day >= 2 ? day - 2 : day + 5);
  const tuesday = new Date(now);
  tuesday.setDate(now.getDate() - diffToTuesday + (weekOffset * 7));
  tuesday.setHours(0, 0, 0, 0);

  const days = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayStr = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < 7; i++) {
    const d = new Date(tuesday);
    d.setDate(tuesday.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dayNum = String(d.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${dayNum}`;

    days.push({
      dateStr,
      dayShort: dayNames[d.getDay()],
      dayNum,
      monthShort: d.toLocaleString("en-US", { month: "short" }),
      isTuesdayReset: d.getDay() === 2,
      isToday: dateStr === todayStr
    });
  }
  return days;
}

function formatDisplayTime(timeStr) {
  if (!timeStr) return "TBD";
  if (timeStr.includes("AM") || timeStr.includes("PM")) return timeStr;
  try {
    const [h, m] = timeStr.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm} EST`;
  } catch {
    return timeStr;
  }
}

export function RaidSchedulePage({
  isAdmin,
  loading,
  loadError,
  schedules = [],
  onSubmitSchedule,
  onPatchSchedule,
  onDeleteSchedule,
  onAddBuyer,
  onRemoveBuyer
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [showEntireWeek, setShowEntireWeek] = useState(false);

  // Quick Add form state
  const [quickTime, setQuickTime] = useState("20:00");
  const [quickRaid, setQuickRaid] = useState(DEFAULT_RAIDS[0]);
  const [quickDifficulty, setQuickDifficulty] = useState("Heroic");
  const [quickLoot, setQuickLoot] = useState("Unsaved");
  const [quickMaxBuyers, setQuickMaxBuyers] = useState(6);
  const [quickLead, setQuickLead] = useState("");
  const [quickNote, setQuickNote] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("All");
  const [filterLoot, setFilterLoot] = useState("All");
  const [filterAvailability, setFilterAvailability] = useState("All");

  // Modal for managing 8/8 buyers
  const [activeBuyerModalRun, setActiveBuyerModalRun] = useState(null);
  const [newBuyerInput, setNewBuyerInput] = useState("");

  const weekDays = useMemo(() => getLockoutWeekDays(weekOffset), [weekOffset]);
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];
  const weekRangeLabel = `${weekStart.monthShort} ${weekStart.dayNum} – ${weekEnd.monthShort} ${weekEnd.dayNum}`;

  // Counts of runs for each day
  const runsPerDay = useMemo(() => {
    const counts = new Map();
    for (const run of schedules) {
      if (run.date) counts.set(run.date, (counts.get(run.date) || 0) + 1);
    }
    return counts;
  }, [schedules]);

  // Filtered schedules
  const filteredSchedules = useMemo(() => {
    const q = search.trim().toLowerCase();

    return schedules.filter((run) => {
      // Date filter
      if (!showEntireWeek) {
        if (selectedDay !== "all" && run.date !== selectedDay) return false;
      } else {
        // Must be in active week range
        if (run.date < weekStart.dateStr || run.date > weekEnd.dateStr) return false;
      }

      // Difficulty
      if (filterDifficulty !== "All" && run.difficulty !== filterDifficulty) return false;

      // Loot
      if (filterLoot !== "All" && run.loot !== filterLoot) return false;

      // Availability
      const isFull = (run.buyers || []).length >= run.maxBuyers;
      if (filterAvailability === "Open" && isFull) return false;
      if (filterAvailability === "Full" && !isFull) return false;

      // Search
      if (q) {
        const match =
          String(run.raid || "").toLowerCase().includes(q) ||
          String(run.lead || "").toLowerCase().includes(q) ||
          String(run.note || "").toLowerCase().includes(q) ||
          String(run.timeEst || "").toLowerCase().includes(q) ||
          (run.buyers || []).some((b) => String(b).toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [
    schedules,
    showEntireWeek,
    selectedDay,
    weekStart.dateStr,
    weekEnd.dateStr,
    filterDifficulty,
    filterLoot,
    filterAvailability,
    search
  ]);

  // Overall statistics for current view
  const stats = useMemo(() => {
    let totalCap = 0;
    let totalBooked = 0;
    for (const run of filteredSchedules) {
      totalCap += Number(run.maxBuyers || 0);
      totalBooked += (run.buyers || []).length;
    }
    return {
      runCount: filteredSchedules.length,
      totalCap,
      totalBooked,
      availableSpots: Math.max(0, totalCap - totalBooked)
    };
  }, [filteredSchedules]);

  // Quick Add submit handler
  const handleQuickAddSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    const targetDate = showEntireWeek ? (selectedDay === "all" ? weekStart.dateStr : selectedDay) : selectedDay;

    await onSubmitSchedule({
      date: targetDate,
      timeEst: quickTime,
      raid: quickRaid,
      difficulty: quickDifficulty,
      loot: quickLoot,
      maxBuyers: Number(quickMaxBuyers) || 6,
      lead: quickLead,
      note: quickNote,
      buyers: []
    });
  };

  // Copy for Discord
  const handleCopyDiscord = () => {
    let text = `📅 **MOONLIGHT RAID SCHEDULE (${weekRangeLabel})**\n\n`;

    const grouped = new Map();
    for (const d of weekDays) grouped.set(d.dateStr, []);
    for (const run of filteredSchedules) {
      if (!grouped.has(run.date)) grouped.set(run.date, []);
      grouped.get(run.date).push(run);
    }

    let hasAnyRuns = false;
    for (const [dateStr, runs] of grouped.entries()) {
      if (runs.length > 0) {
        hasAnyRuns = true;
        const dObj = weekDays.find((d) => d.dateStr === dateStr);
        const dayTitle = dObj ? `${dObj.dayShort.toUpperCase()} (${dateStr})` : dateStr;
        text += `**${dayTitle}:**\n`;

        for (const r of runs) {
          const booked = (r.buyers || []).length;
          const open = Math.max(0, r.maxBuyers - booked);
          const spotInfo = open > 0 ? `(${open} spots open)` : `🔴 FULL`;
          const displayTime = formatDisplayTime(r.timeEst);
          text += `• \`${displayTime}\` - **${r.difficulty} ${r.raid}** [${r.loot}] - 8/8 Cap: ${booked}/${r.maxBuyers} ${spotInfo}\n`;
        }
        text += `\n`;
      }
    }

    if (!hasAnyRuns) {
      text += `_No raids currently scheduled for this period._\n`;
    }

    navigator.clipboard.writeText(text);
    notify("Copied Discord schedule announcement to clipboard!");
  };

  // Buyer modal actions
  const openBuyerModal = (run) => {
    setActiveBuyerModalRun(run);
    setNewBuyerInput("");
  };

  const closeBuyerModal = () => {
    setActiveBuyerModalRun(null);
    setNewBuyerInput("");
  };

  const handleAddBuyer = async () => {
    if (!activeBuyerModalRun || !newBuyerInput.trim()) return;
    await onAddBuyer(activeBuyerModalRun.id, newBuyerInput.trim());
    setNewBuyerInput("");
  };

  // Active run from updated schedules
  const currentModalRun = useMemo(() => {
    if (!activeBuyerModalRun) return null;
    return schedules.find((s) => s.id === activeBuyerModalRun.id) || activeBuyerModalRun;
  }, [schedules, activeBuyerModalRun]);

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider font-mono">
              <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" aria-hidden="true" />
              Lockout Week
            </span>
            <span className="text-xs text-muted-foreground">Tuesday NA Reset Cycle</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="size-5 text-primary" />
            Daily Raid Schedule
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Organize daily raid lockouts, monitor 8/8 buyer caps, and manage Saved/Unsaved rosters.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyDiscord}
            className="text-xs gap-1.5 border-border bg-card hover:bg-secondary"
            title="Copy schedule formatted for Discord announcements"
          >
            <Copy className="size-3.5 text-indigo-400" />
            <span>Copy for Discord</span>
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => {
              const el = document.getElementById("schedule-quick-add");
              el?.scrollIntoView({ behavior: "smooth" });
              document.getElementById("quick-time-input")?.focus();
            }}
            className="text-xs gap-1.5"
          >
            <Plus className="size-4" />
            <span>Schedule Run</span>
          </Button>
        </div>
      </div>

      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>Failed to load raid schedules</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {/* 2. Lockout Week Navigator & 7-Day Strip */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-4">
        {/* Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setWeekOffset((w) => w - 1)}
              title="Previous lockout week"
              aria-label="Previous week"
            >
              <ChevronLeft className="size-4" />
            </Button>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary block font-mono">
                {weekOffset === 0 ? "Current Reset" : weekOffset > 0 ? `+${weekOffset} Week Ahead` : `${weekOffset} Week Prior`}
              </span>
              <span className="text-sm font-bold text-foreground tracking-tight">
                {weekRangeLabel}
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setWeekOffset((w) => w + 1)}
              title="Next lockout week"
              aria-label="Next week"
            >
              <ChevronRight className="size-4" />
            </Button>

            {weekOffset !== 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setWeekOffset(0);
                  setSelectedDay(new Date().toISOString().slice(0, 10));
                }}
              >
                Reset to Current Week
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={showEntireWeek ? "default" : "outline"}
              size="sm"
              onClick={() => setShowEntireWeek(!showEntireWeek)}
              className="text-xs h-8"
            >
              <Calendar className="size-3.5 mr-1" />
              {showEntireWeek ? "Showing Entire Week" : "Show Entire Week"}
            </Button>
          </div>
        </div>

        {/* 7-Day Lockout Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2" role="group" aria-label="Raid week days">
          {weekDays.map((day) => {
            const isSelected = !showEntireWeek && selectedDay === day.dateStr;
            const runCount = runsPerDay.get(day.dateStr) || 0;

            return (
              <button
                key={day.dateStr}
                type="button"
                onClick={() => {
                  setSelectedDay(day.dateStr);
                  setShowEntireWeek(false);
                }}
                className={cn(
                  "p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between min-h-[72px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isSelected
                    ? "bg-primary/15 border-primary shadow-xs ring-1 ring-primary"
                    : "bg-field/70 border-border/70 hover:border-border hover:bg-secondary/60"
                )}
                aria-pressed={isSelected}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={cn(
                      "text-[11px] font-bold uppercase font-mono tracking-wider",
                      isSelected ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {day.dayShort}
                  </span>
                  {day.isToday && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-primary text-primary-foreground">
                      TODAY
                    </span>
                  )}
                  {day.isTuesdayReset && !day.isToday && (
                    <span className="text-[9px] font-semibold px-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      RESET
                    </span>
                  )}
                </div>

                <div className="mt-1 flex items-baseline justify-between w-full">
                  <span className={cn("text-base font-bold", isSelected ? "text-foreground" : "text-foreground/90")}>
                    {day.dayNum} <span className="text-[10px] font-normal text-muted-foreground">{day.monthShort}</span>
                  </span>
                  <span
                    className={cn(
                      "text-[11px] font-mono px-1.5 py-0.5 rounded",
                      runCount > 0
                        ? isSelected
                          ? "bg-primary text-primary-foreground font-bold"
                          : "bg-muted text-foreground font-semibold"
                        : "text-muted-foreground/60"
                    )}
                  >
                    {runCount} {runCount === 1 ? "run" : "runs"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. INPUT UNDER THE DATE FILTER (Express Quick-Add Scheduling Bar) */}
      {isAdmin && (
        <div id="schedule-quick-add" className="rounded-xl border border-primary/40 bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-primary/10 text-primary">
                <Plus className="size-4" />
              </span>
              <h2 className="text-xs font-semibold text-foreground">
                Quick Schedule Raid for{" "}
                <span className="text-primary font-bold">
                  {showEntireWeek ? `Week of ${weekRangeLabel}` : selectedDay}
                </span>
              </h2>
            </div>
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              Input under date filter • Enter to publish
            </span>
          </div>

          <form onSubmit={handleQuickAddSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
            {/* Date */}
            <div>
              <label htmlFor="quick-date-input" className="block text-[11px] font-medium text-muted-foreground mb-1">Date</label>
              <Input
                id="quick-date-input"
                type="date"
                required
                value={showEntireWeek ? selectedDay : selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="h-8 text-xs bg-field"
              />
            </div>

            {/* Time (EST) */}
            <div>
              <label htmlFor="quick-time-input" className="block text-[11px] font-medium text-muted-foreground mb-1">Time (EST)</label>
              <Input
                id="quick-time-input"
                type="time"
                required
                value={quickTime}
                onChange={(e) => setQuickTime(e.target.value)}
                className="h-8 text-xs font-mono bg-field"
              />
            </div>

            {/* Raid */}
            <div>
              <label htmlFor="quick-raid-select" className="block text-[11px] font-medium text-muted-foreground mb-1">Raid</label>
              <select
                id="quick-raid-select"
                value={quickRaid}
                onChange={(e) => setQuickRaid(e.target.value)}
                className="w-full h-8 text-xs rounded-md border border-border bg-field px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {DEFAULT_RAIDS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty */}
            <div>
              <label htmlFor="quick-difficulty-select" className="block text-[11px] font-medium text-muted-foreground mb-1">Difficulty</label>
              <select
                id="quick-difficulty-select"
                value={quickDifficulty}
                onChange={(e) => setQuickDifficulty(e.target.value)}
                className="w-full h-8 text-xs rounded-md border border-border bg-field px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Loot */}
            <div>
              <label htmlFor="quick-loot-select" className="block text-[11px] font-medium text-muted-foreground mb-1">Loot</label>
              <select
                id="quick-loot-select"
                value={quickLoot}
                onChange={(e) => setQuickLoot(e.target.value)}
                className="w-full h-8 text-xs rounded-md border border-border bg-field px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {LOOT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.short}
                  </option>
                ))}
              </select>
            </div>

            {/* Maximum 8/8 */}
            <div>
              <label htmlFor="quick-max-buyers-input" className="block text-[11px] font-medium text-muted-foreground mb-1">Maximum 8/8</label>
              <Input
                id="quick-max-buyers-input"
                type="number"
                min="1"
                max="25"
                required
                value={quickMaxBuyers}
                onChange={(e) => setQuickMaxBuyers(e.target.value)}
                placeholder="Max 8/8 buyers"
                className="h-8 text-xs font-mono bg-field"
              />
            </div>

            {/* Submit Button */}
            <div className="flex items-end">
              <Button type="submit" size="sm" className="w-full h-8 text-xs font-bold gap-1">
                <Plus className="size-3.5" />
                <span>Add Run</span>
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* 4. Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search raid, time, leader, buyer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-field"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-[11px]">Difficulty:</span>
            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              className="h-7 text-xs rounded-md border border-border bg-field px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="All">All Difficulties</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-[11px]">Loot:</span>
            <select
              value={filterLoot}
              onChange={(e) => setFilterLoot(e.target.value)}
              className="h-7 text-xs rounded-md border border-border bg-field px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="All">All Loot</option>
              <option value="Unsaved">Unsaved Only</option>
              <option value="Saved">Saved Only</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-[11px]">Slots:</span>
            <select
              value={filterAvailability}
              onChange={(e) => setFilterAvailability(e.target.value)}
              className="h-7 text-xs rounded-md border border-border bg-field px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="All">All Runs</option>
              <option value="Open">Has Open 8/8 Slots</option>
              <option value="Full">Fully Booked</option>
            </select>
          </div>

          {(search || filterDifficulty !== "All" || filterLoot !== "All" || filterAvailability !== "All") && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setFilterDifficulty("All");
                setFilterLoot("All");
                setFilterAvailability("All");
              }}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3 mr-1" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* 5. Master Schedule Data Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredSchedules.length === 0 ? (
          <div className="text-center py-12 px-4 border-b border-border/40">
            <Swords className="size-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-foreground">No raid runs scheduled</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {search || filterDifficulty !== "All" || filterLoot !== "All" || filterAvailability !== "All"
                ? "No raids match your active search or filters. Try adjusting them."
                : showEntireWeek
                ? `No raids scheduled for the week of ${weekRangeLabel}. Use the Quick Add form above to schedule a run!`
                : `No raids scheduled for ${selectedDay}. Use the Quick Add form above to schedule a run!`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Time (EST)</th>
                  <th className="py-3 px-4">Raid Instance</th>
                  <th className="py-3 px-4">Difficulty</th>
                  <th className="py-3 px-4">Loot</th>
                  <th className="py-3 px-4">Maximum 8/8 (Cap)</th>
                  <th className="py-3 px-4">Lead / Team</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredSchedules.map((run) => {
                  const booked = (run.buyers || []).length;
                  const maxCap = Number(run.maxBuyers || 6);
                  const isFull = booked >= maxCap;
                  const openSpots = Math.max(0, maxCap - booked);
                  const pct = Math.min(100, Math.round((booked / maxCap) * 100));

                  // Difficulty badge styling
                  let diffVariant = "bg-muted text-foreground border-border";
                  if (run.difficulty === "Normal") {
                    diffVariant = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
                  } else if (run.difficulty === "Heroic") {
                    diffVariant = "bg-purple-500/15 text-purple-300 border-purple-500/30";
                  } else if (run.difficulty === "Mythic") {
                    diffVariant = "bg-amber-500/15 text-amber-300 border-amber-500/30";
                  }

                  return (
                    <tr key={run.id} className="hover:bg-secondary/30 transition-colors">
                      {/* Date */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-muted-foreground">
                        {run.date}
                      </td>

                      {/* Time EST */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-bold text-foreground font-mono">
                          {formatDisplayTime(run.timeEst)}
                        </span>
                      </td>

                      {/* Raid */}
                      <td className="py-3 px-4 whitespace-nowrap font-semibold text-foreground">
                        {run.raid}
                      </td>

                      {/* Difficulty */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={cn("px-2 py-0.5 rounded-md font-semibold text-[11px] border", diffVariant)}>
                          {run.difficulty}
                        </span>
                      </td>

                      {/* Loot */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isAdmin ? (
                          <select
                            value={run.loot}
                            onChange={(e) => onPatchSchedule(run.id, { loot: e.target.value })}
                            className={cn(
                              "h-6 text-[11px] font-semibold rounded px-1.5 border focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer",
                              run.loot === "Unsaved"
                                ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                                : "bg-slate-700/40 text-slate-300 border-slate-600/40"
                            )}
                          >
                            <option value="Unsaved">Unsaved</option>
                            <option value="Saved">Saved</option>
                          </select>
                        ) : (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border",
                              run.loot === "Unsaved"
                                ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                                : "bg-slate-700/40 text-slate-300 border-slate-600/40"
                            )}
                          >
                            {run.loot === "Unsaved" ? (
                              <Unlock className="size-3 text-cyan-400" />
                            ) : (
                              <Lock className="size-3 text-slate-400" />
                            )}
                            {run.loot}
                          </span>
                        )}
                      </td>

                      {/* Maximum 8/8 */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={cn("font-mono font-bold", isFull ? "text-rose-400" : "text-primary")}>
                            {booked} / {maxCap}
                          </span>
                          {isFull ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              FULL
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                              {openSpots} open
                            </span>
                          )}
                        </div>
                        <div className="w-28 bg-field rounded-full h-1.5 mt-1 overflow-hidden border border-border">
                          <div
                            className={cn("h-full rounded-full transition-all", isFull ? "bg-rose-500" : "bg-primary")}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>

                      {/* Lead */}
                      <td className="py-3 px-4 whitespace-nowrap text-muted-foreground">
                        {run.lead || "Unassigned"}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openBuyerModal(run)}
                            className="h-7 text-[11px] gap-1 px-2 border-border"
                          >
                            <Users className="size-3 text-primary" />
                            <span>Buyers ({booked})</span>
                          </Button>

                          {isAdmin && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => onDeleteSchedule(run)}
                              className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title="Delete raid run"
                              aria-label="Delete run"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary Footer */}
        <div className="border-t border-border bg-muted/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground">
          <div>Showing {stats.runCount} scheduled runs</div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <div>
              Total 8/8 Slots: <strong className="text-foreground">{stats.totalCap}</strong>
            </div>
            <div>
              Booked Buyers: <strong className="text-primary">{stats.totalBooked}</strong>
            </div>
            <div>
              Available: <strong className="text-emerald-400">{stats.availableSpots}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Manage 8/8 Buyers Modal */}
      {currentModalRun && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="rounded-xl border border-border bg-card w-full max-w-md p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  Manage 8/8 Buyers
                </h3>
                <p className="text-xs text-muted-foreground">
                  {currentModalRun.date} @ {formatDisplayTime(currentModalRun.timeEst)} • {currentModalRun.difficulty}{" "}
                  {currentModalRun.raid}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={closeBuyerModal}
                className="size-7 text-muted-foreground hover:text-foreground"
                aria-label="Close modal"
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Enrolled Buyers:</span>
                <span className="font-mono font-bold text-primary">
                  {(currentModalRun.buyers || []).length} / {currentModalRun.maxBuyers} Cap
                </span>
              </div>

              {/* List of buyers */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {(currentModalRun.buyers || []).length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
                    No 8/8 buyers assigned yet.
                  </div>
                ) : (
                  (currentModalRun.buyers || []).map((b, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-field border border-border/80 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground">#{idx + 1}</span>
                        <span className="font-semibold text-foreground font-mono">{b}</span>
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => onRemoveBuyer(currentModalRun.id, idx)}
                          className="text-muted-foreground hover:text-destructive p-1 rounded"
                          title="Remove buyer"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Add buyer input */}
              {isAdmin && (
                <div className="pt-2 border-t border-border flex gap-2">
                  <Input
                    placeholder="Character-Realm (e.g. Grommash-Illidan)"
                    value={newBuyerInput}
                    onChange={(e) => setNewBuyerInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddBuyer();
                      }
                    }}
                    className="h-8 text-xs bg-field flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddBuyer}
                    disabled={!newBuyerInput.trim() || (currentModalRun.buyers || []).length >= currentModalRun.maxBuyers}
                    className="h-8 text-xs font-semibold"
                  >
                    Add Buyer
                  </Button>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button type="button" variant="outline" size="sm" onClick={closeBuyerModal} className="text-xs">
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
