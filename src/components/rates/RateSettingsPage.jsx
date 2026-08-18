import React, { useMemo, useState } from "react";
import { Plus, Star, Trash2 } from "lucide-react";
import { AccessDenied } from "../AccessDenied.jsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card } from "@/components/ui/card.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { cn } from "@/lib/utils.js";

export function RateSettingsPage({
  isAdmin,
  loading,
  loadError,
  canEditPrices,
  supplierServices,
  boosterPrices,
  supplierRecords,
  boosterRecords,
  onAddPriceRow,
  onTogglePriceRow,
  onDeletePriceRow,
  onSetDefaultPriceRow,
  onUpdatePriceRow,
  onSaveSupplierPrices,
  onSaveBoosterPrices
}) {
  if (!isAdmin) return <AccessDenied />;
  if (loading) {
    return (
      <section className="tab-panel active space-y-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-96 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </section>
    );
  }
  if (loadError) {
    return (
      <section className="tab-panel active">
        <Alert variant="destructive">
          <AlertTitle>Could not load default rates</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </section>
    );
  }

  return (
    <section className="tab-panel active rate-settings-page space-y-4">
      <header className="rate-page-head">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">Default rates</h2>
            <Badge variant="admin">Admin controls</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Changes affect new records only. Existing supplier sales and booster payouts keep their saved rates.
          </p>
        </div>
      </header>

      <section className="price-grid">
        <PricePanel
          title="Supplier sale rates"
          itemLabel="service"
          rows={supplierServices}
          historyRecords={supplierRecords}
          itemKey="type"
          historyKey="serviceType"
          addLabel="Add service"
          saveLabel="Save supplier defaults"
          disabled={!canEditPrices}
          onAdd={() => onAddPriceRow("supplierServices", "type")}
          onToggle={(index) => onTogglePriceRow("supplierServices", index)}
          onDelete={(index) => onDeletePriceRow?.("supplierServices", index)}
          onSetDefault={(index) => onSetDefaultPriceRow?.("supplierServices", index)}
          onChange={(index, change) => onUpdatePriceRow("supplierServices", index, change)}
          onSubmit={onSaveSupplierPrices}
        />
        <PricePanel
          title="Booster payout rates"
          itemLabel="key level"
          rows={boosterPrices}
          historyRecords={boosterRecords}
          itemKey="level"
          historyKey="level"
          addLabel="Add key level"
          saveLabel="Save booster defaults"
          disabled={!canEditPrices}
          onAdd={() => onAddPriceRow("boosterPrices", "level")}
          onToggle={(index) => onTogglePriceRow("boosterPrices", index)}
          onDelete={(index) => onDeletePriceRow?.("boosterPrices", index)}
          onSetDefault={(index) => onSetDefaultPriceRow?.("boosterPrices", index)}
          onChange={(index, change) => onUpdatePriceRow("boosterPrices", index, change)}
          onSubmit={onSaveBoosterPrices}
        />
      </section>
    </section>
  );
}

function PricePanel({
  title,
  itemLabel,
  rows,
  historyRecords,
  itemKey,
  historyKey,
  addLabel,
  saveLabel,
  disabled,
  onAdd,
  onToggle,
  onDelete,
  onSetDefault,
  onChange,
  onSubmit
}) {
  const [activeTab, setActiveTab] = useState("active");
  const duplicateNames = useMemo(() => findDuplicateNames(rows, itemKey), [rows, itemKey]);
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
            <p className="panel-note text-xs text-muted-foreground">Used only when a new record is created.</p>
          </div>
          <div className="section-actions flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              className="border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary font-semibold shadow-xs"
              onClick={() => {
                onAdd();
                setActiveTab("active");
              }}
              disabled={disabled}
            >
              <Plus className="size-3.5 mr-1" aria-hidden="true" />
              {addLabel}
            </Button>
            <Button
              type="submit"
              size="sm"
              className="font-bold shadow-md"
              disabled={disabled || duplicateNames.size > 0}
            >
              {saveLabel}
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
              Duplicate {itemLabel} names found
            </span>
          )}
        </div>

        {/* Compact Table */}
        <div className="rate-table-wrapper w-full overflow-x-auto">
          <div className="min-w-[500px]">
            {/* Table Header */}
            <div
              className="rate-table-header grid items-center gap-2 border-b border-border/80 bg-muted/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"
              style={{ gridTemplateColumns: "36px minmax(130px, 1fr) 110px 85px 130px" }}
            >
              <span className="text-center" title="Default selection for new records">Def</span>
              <span>{itemLabel === "service" ? "Service" : "Mythic+ Key Level"}</span>
              <span className="text-right">Default Rate</span>
              <span className="text-center">History</span>
              <span className="text-right pr-1">Actions</span>
            </div>

            {/* Table Rows Body */}
            <div className="rate-table-body max-h-[460px] divide-y divide-border/40 overflow-y-auto">
              {displayedRows.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  {activeTab === "active"
                    ? `No active ${itemLabel} rates. Restore an archived rate or add a new one.`
                    : `No archived ${itemLabel} rates.`}
                </div>
              ) : (
                displayedRows.map(({ row, index }) => {
                  const normalizedName = String(row[itemKey] || "").trim().toLocaleLowerCase();
                  const duplicate = duplicateNames.has(normalizedName);
                  const historyCount = historyRecords.filter((record) =>
                    String(record[historyKey] || "").trim().toLocaleLowerCase() === normalizedName
                  ).length;
                  const isDefault = Boolean(row.isDefault);
                  const isArchived = activeTab === "archived";

                  return (
                    <div
                      key={`${itemKey}-${index}`}
                      className={cn(
                        "rate-table-row grid items-center gap-2 px-3 py-1.5 transition-colors hover:bg-muted/20",
                        isArchived && "opacity-75 bg-muted/10",
                        duplicate && "bg-rose-950/20 border-l-2 border-rose-500",
                        isDefault && "bg-amber-500/[0.06] border-l-2 border-amber-400"
                      )}
                      style={{ gridTemplateColumns: "36px minmax(130px, 1fr) 110px 85px 130px" }}
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
                          title={isDefault ? "Default selection for new records" : "Set as default selection for new records"}
                          aria-label={isDefault ? `Unmark ${row[itemKey] || itemLabel} as default` : `Set ${row[itemKey] || itemLabel} as default`}
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

                      {/* Col 2: Service/Level Name Input */}
                      <div className="min-w-0">
                        <Input
                          value={row[itemKey] || ""}
                          onChange={(e) => onChange(index, { [itemKey]: e.target.value })}
                          disabled={disabled}
                          placeholder={itemLabel === "service" ? "Service name" : "Key level"}
                          aria-label={itemLabel === "service" ? "Service name" : "Key level"}
                          aria-invalid={duplicate}
                          className={cn(
                            "h-8 min-h-0 text-xs sm:text-sm px-2.5 bg-popover/80 rounded-lg",
                            duplicate && "border-rose-500 focus-visible:ring-rose-500"
                          )}
                        />
                      </div>

                      {/* Col 3: Price Input */}
                      <div>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.price ?? 0}
                          onChange={(e) => onChange(index, { price: Number(e.target.value) })}
                          disabled={disabled}
                          aria-label="Default rate"
                          className="h-8 min-h-0 text-xs sm:text-sm px-2.5 text-right font-mono bg-popover/80 rounded-lg"
                        />
                      </div>

                      {/* Col 4: Usage History Badge */}
                      <div className="flex justify-center">
                        {historyCount > 0 ? (
                          <Badge
                            variant="warning"
                            className="text-[10px] px-1.5 py-0.5 font-semibold cursor-help whitespace-nowrap"
                            title={`Used by ${historyCount} historical record${historyCount === 1 ? "" : "s"}. Existing saved records will keep their rates.`}
                          >
                            {historyCount} used
                          </Badge>
                        ) : (
                          <Badge variant="neutral" className="text-[10px] px-1.5 py-0.5 opacity-60 whitespace-nowrap" title="Not used by any historical records.">
                            0 used
                          </Badge>
                        )}
                      </div>

                      {/* Col 5: Actions */}
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
                          onClick={() => onToggle(index)}
                          disabled={disabled}
                          title={isArchived ? "Restore rate" : "Archive rate"}
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
                            title={`Delete ${row[itemKey] || itemLabel}`}
                            aria-label={`Delete ${row[itemKey] || itemLabel}`}
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

function findDuplicateNames(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    const name = String(row[key] || "").trim().toLocaleLowerCase();
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name));
}
