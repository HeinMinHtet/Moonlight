import React, { useMemo, useState } from "react";
import { Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import { Card } from "@/components/ui/card.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { cn } from "@/lib/utils.js";

export function ArmorStacksPanel({
  title = "Armor stack options",
  rows = [],
  supplierRecords = [],
  disabled = false,
  onAdd,
  onToggle,
  onDelete,
  onSetDefault,
  onChange,
  onSubmit
}) {
  const [activeTab, setActiveTab] = useState("active");
  const duplicateNames = useMemo(() => findDuplicateArmorNames(rows), [rows]);
  const indexedRows = rows.map((row, index) => ({ row, index }));
  const activeRows = indexedRows.filter(({ row }) => row.active !== false);
  const archivedRows = indexedRows.filter(({ row }) => row.active === false);

  const displayedRows = activeTab === "active" ? activeRows : archivedRows;

  return (
    <Card asChild>
      <form className="price-panel flex flex-col overflow-hidden" onSubmit={onSubmit}>
        <div className="section-head flex flex-wrap items-center justify-between gap-3 border-b border-border/70 p-4">
          <div>
            <h2 className="text-base font-bold text-foreground">{title}</h2>
            <p className="panel-note text-xs text-muted-foreground">Armor stack categories available when recording supplier sales.</p>
          </div>
          <div className="section-actions flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              className="border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary font-semibold shadow-xs"
              onClick={() => {
                onAdd?.();
                setActiveTab("active");
              }}
              disabled={disabled}
            >
              <Plus className="size-3.5 mr-1" aria-hidden="true" />
              Add armor stack
            </Button>
            <Button
              type="submit"
              size="sm"
              className="font-bold shadow-md"
              disabled={disabled || duplicateNames.size > 0}
            >
              Save armor stacks
            </Button>
          </div>
        </div>

        {/* Segmented active / archived tab bar */}
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/25 px-4 py-2">
          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card/90 p-0.5 text-xs">
            <button
              type="button"
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer",
                activeTab === "active"
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setActiveTab("active")}
            >
              Active ({activeRows.length})
            </button>
            <button
              type="button"
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer",
                activeTab === "archived"
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setActiveTab("archived")}
            >
              Archived ({archivedRows.length})
            </button>
          </div>

          {duplicateNames.size > 0 && (
            <span className="text-xs font-semibold text-rose-400" role="alert">
              Duplicate armor stack names found
            </span>
          )}
        </div>

        {/* Compact Table */}
        <div className="rate-table-wrapper w-full overflow-x-auto">
          <div className="min-w-[440px]">
            {/* Table Header */}
            <div
              className="rate-table-header grid items-center gap-2 border-b border-border/80 bg-muted/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"
              style={{ gridTemplateColumns: "36px minmax(160px, 1fr) 95px 130px" }}
            >
              <span className="text-center" title="Default selection for new sales records">Def</span>
              <span>Armor Stack Name</span>
              <span className="text-center">History</span>
              <span className="text-right pr-1">Actions</span>
            </div>

            {/* Table Rows Body */}
            <div className="rate-table-body max-h-[460px] divide-y divide-border/40 overflow-y-auto">
              {displayedRows.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  {activeTab === "active"
                    ? "No active armor stacks. Restore an archived option or add a new one."
                    : "No archived armor stacks."}
                </div>
              ) : (
                displayedRows.map(({ row, index }) => {
                  const normalizedName = String(row.name || "").trim().toLocaleLowerCase();
                  const duplicate = duplicateNames.has(normalizedName);
                  const historyCount = supplierRecords.filter((record) =>
                    String(record.armorType || "").trim().toLocaleLowerCase() === normalizedName
                  ).length;
                  const isDefault = Boolean(row.isDefault);
                  const isArchived = activeTab === "archived";

                  return (
                    <div
                      key={`armor-${index}`}
                      className={cn(
                        "rate-table-row grid items-center gap-2 px-3 py-1.5 transition-colors hover:bg-muted/20",
                        isArchived && "opacity-75 bg-muted/10",
                        duplicate && "bg-rose-950/20 border-l-2 border-rose-500",
                        isDefault && "bg-amber-500/[0.06] border-l-2 border-amber-400"
                      )}
                      style={{ gridTemplateColumns: "36px minmax(160px, 1fr) 95px 130px" }}
                    >
                      {/* Col 1: Star */}
                      <div className="flex justify-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          className="size-7 rounded-md text-slate-400 hover:text-amber-400 hover:bg-amber-400/10"
                          onClick={() => onSetDefault?.(index)}
                          disabled={disabled || isArchived}
                          title={isDefault ? "Default selection for new sales records" : "Set as default selection for new sales records"}
                          aria-label={isDefault ? `Unmark ${row.name || "armor stack"} as default` : `Set ${row.name || "armor stack"} as default`}
                        >
                          <Star
                            className={cn(
                              "size-4 transition-transform active:scale-125",
                              isDefault ? "fill-amber-400 text-amber-400" : "text-slate-500 hover:text-amber-400"
                            )}
                            aria-hidden="true"
                          />
                        </Button>
                      </div>

                      {/* Col 2: Armor Stack Name Input */}
                      <div className="min-w-0">
                        <Input
                          value={row.name || ""}
                          onChange={(e) => onChange?.(index, { name: e.target.value })}
                          disabled={disabled}
                          placeholder="Armor stack name"
                          aria-label="Armor stack name"
                          aria-invalid={duplicate}
                          className={cn(
                            "h-8 min-h-0 text-xs sm:text-sm px-2.5 bg-popover/80 rounded-lg",
                            duplicate && "border-rose-500 focus-visible:ring-rose-500"
                          )}
                        />
                      </div>

                      {/* Col 3: Usage History Badge */}
                      <div className="flex justify-center">
                        {historyCount > 0 ? (
                          <Badge
                            variant="warning"
                            className="text-[10px] px-1.5 py-0.5 font-semibold cursor-help whitespace-nowrap"
                            title={`Used by ${historyCount} historical sales record${historyCount === 1 ? "" : "s"}.`}
                          >
                            {historyCount} used
                          </Badge>
                        ) : (
                          <Badge variant="neutral" className="text-[10px] px-1.5 py-0.5 opacity-60 whitespace-nowrap" title="Not used by any sales records.">
                            0 used
                          </Badge>
                        )}
                      </div>

                      {/* Col 4: Actions */}
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          className={cn(
                            "h-7 px-2 text-xs rounded-md font-medium border-border/80",
                            isArchived
                              ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20"
                              : "text-slate-300 hover:text-white hover:bg-secondary"
                          )}
                          onClick={() => onToggle?.(index)}
                          disabled={disabled}
                          title={isArchived ? "Restore armor stack" : "Archive armor stack"}
                        >
                          {isArchived ? "Restore" : "Archive"}
                        </Button>
                        {historyCount === 0 ? (
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            className="h-7 px-2 text-xs rounded-md font-medium border-rose-500/40 text-rose-300 bg-rose-500/5 hover:bg-rose-500/20 hover:text-rose-200"
                            onClick={() => onDelete?.(index)}
                            disabled={disabled}
                            title={`Delete ${row.name || "armor stack"}`}
                            aria-label={`Delete ${row.name || "armor stack"}`}
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </Button>
                        ) : (
                          <div className="w-[30px]" aria-hidden="true" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Panel Footer */}
        <div className="price-save-bar flex items-center justify-between border-t border-border/70 bg-card/60 px-4 py-2.5 text-xs text-muted-foreground">
          <span>{activeRows.length} active / {archivedRows.length} archived</span>
        </div>
      </form>
    </Card>
  );
}

function findDuplicateArmorNames(rows) {
  const counts = new Map();
  for (const row of rows) {
    const name = String(row.name || "").trim().toLocaleLowerCase();
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name));
}
