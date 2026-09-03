import React, { useId, useMemo, useState } from "react";
import { Calculator, Check, Copy, Download, Plus, RotateCcw, Trash2 } from "lucide-react";
import { AccessDenied } from "../AccessDenied.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card } from "@/components/ui/card.jsx";
import { Input } from "@/components/ui/input.jsx";
import { money } from "../../utils/format.js";
import { calculateTieredDiscounts, formatCalculationOutput } from "../../utils/priceCalculator.js";
import { cn } from "@/lib/utils.js";
import { toast as notify } from "sonner";

const DEFAULT_ROWS = [
  { id: "example-1", serviceName: "Mythic+ 10", originalPrice: 100 },
  { id: "example-2", serviceName: "Mythic+ 12", originalPrice: 150 },
  { id: "example-3", serviceName: "Heroic Raid Full Clear", originalPrice: 300 }
];

export function PriceCalculatorPage({ isAdmin = true, supplierServices = [] }) {
  if (!isAdmin) return <AccessDenied />;

  const [rows, setRows] = useState(DEFAULT_ROWS);
  const [discount1Pct, setDiscount1Pct] = useState(10);
  const [discount2Pct, setDiscount2Pct] = useState(10);
  const [outputFormat, setOutputFormat] = useState("list");
  const [copied, setCopied] = useState(false);
  const tier1InputId = useId();
  const tier2InputId = useId();
  const copyAreaId = useId();

  // Calculate items with tiered discounts
  const calculatedItems = useMemo(() => {
    return rows.map((row) => {
      const calc = calculateTieredDiscounts(row.originalPrice, discount1Pct, discount2Pct);
      return {
        id: row.id,
        serviceName: row.serviceName,
        originalPrice: calc.originalPrice,
        discountedPrice1: calc.discountedPrice1,
        discountedPrice2: calc.discountedPrice2,
        discount1Amount: calc.discount1Amount,
        discount2Amount: calc.discount2Amount,
        totalDiscountAmount: calc.totalDiscountAmount
      };
    });
  }, [rows, discount1Pct, discount2Pct]);

  // Overall totals
  const totals = useMemo(() => {
    return calculatedItems.reduce(
      (acc, item) => {
        acc.original += item.originalPrice;
        acc.tier1 += item.discountedPrice1;
        acc.tier2 += item.discountedPrice2;
        acc.savings += item.totalDiscountAmount;
        return acc;
      },
      { original: 0, tier1: 0, tier2: 0, savings: 0 }
    );
  }, [calculatedItems]);

  // Formatted copyable text
  const copyableText = useMemo(() => {
    return formatCalculationOutput(calculatedItems, {
      discount1Pct,
      discount2Pct,
      format: outputFormat
    });
  }, [calculatedItems, discount1Pct, discount2Pct, outputFormat]);

  const handleAddRow = () => {
    const newId = `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setRows((current) => [...current, { id: newId, serviceName: "", originalPrice: 0 }]);
  };

  const handleUpdateRow = (id, field, value) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const handleDeleteRow = (id) => {
    setRows((current) => current.filter((row) => row.id !== id));
  };

  const handleResetExample = () => {
    setRows(DEFAULT_ROWS);
    setDiscount1Pct(10);
    setDiscount2Pct(10);
    notify("Reset calculator to example values.");
  };

  const handleClearAll = () => {
    setRows([]);
    notify("Cleared all calculator rows.");
  };

  const handleImportDefaultRates = () => {
    const activeServices = (supplierServices || []).filter((s) => s.active !== false && Number(s.price || 0) > 0);
    if (!activeServices.length) {
      notify("No active default rates found to import.");
      return;
    }
    const importedRows = activeServices.map((s, idx) => ({
      id: `imported-${idx}-${Date.now()}`,
      serviceName: s.type || `Service ${idx + 1}`,
      originalPrice: Number(s.price || 0)
    }));
    setRows(importedRows);
    notify(`Imported ${importedRows.length} active service rates.`);
  };

  const handleCopyToClipboard = async () => {
    if (!copyableText) {
      notify("No price calculation data to copy.");
      return;
    }
    try {
      await navigator.clipboard.writeText(copyableText);
      setCopied(true);
      notify("Copied price calculation to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      notify("Could not access clipboard. Please copy manually from the box below.");
    }
  };

  return (
    <section className="tab-panel active rate-settings-page space-y-4">
      {/* Header */}
      <header className="rate-page-head flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">Price Calculator</h2>
            <Badge variant="admin">Admin tool</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Calculate tiered discounts: Initial {discount1Pct}% discount, followed by an additional {discount2Pct}% discount on the discounted price.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {supplierServices?.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary font-semibold shadow-xs"
              onClick={handleImportDefaultRates}
              title="Import rates currently configured in Default Rates"
            >
              <Download className="size-3.5 mr-1" aria-hidden="true" />
              Import Default Rates
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            type="button"
            className="border border-border/80 text-xs"
            onClick={handleResetExample}
            title="Reset to initial example rows"
          >
            <RotateCcw className="size-3.5 mr-1" aria-hidden="true" />
            Reset Example
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="text-xs text-muted-foreground hover:text-rose-300 hover:bg-rose-500/10"
            onClick={handleClearAll}
          >
            Clear all
          </Button>
        </div>
      </header>

      {/* Discount Rate Settings Bar */}
      <Card className="flex flex-wrap items-center justify-between gap-3 border border-border/70 bg-card/80 p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <Calculator className="size-4 text-primary" aria-hidden="true" />
            Discount percentages:
          </span>
          <div className="flex items-center gap-1.5">
            <label htmlFor={tier1InputId} className="text-muted-foreground">Tier 1:</label>
            <div className="relative">
              <Input
                id={tier1InputId}
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={discount1Pct}
                onChange={(e) => setDiscount1Pct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                aria-label="Tier 1 discount percentage"
                className="h-7 w-16 px-2 text-right font-mono text-xs pr-5"
              />
              <span className="absolute right-1.5 top-1.5 text-xs text-muted-foreground pointer-events-none">%</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <label htmlFor={tier2InputId} className="text-muted-foreground">Tier 2 (Extra):</label>
            <div className="relative">
              <Input
                id={tier2InputId}
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={discount2Pct}
                onChange={(e) => setDiscount2Pct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                aria-label="Tier 2 discount percentage"
                className="h-7 w-16 px-2 text-right font-mono text-xs pr-5"
              />
              <span className="absolute right-1.5 top-1.5 text-xs text-muted-foreground pointer-events-none">%</span>
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Formula: <span className="font-mono text-foreground font-medium">Original × (1 - {discount1Pct}%) × (1 - {discount2Pct}%)</span>
        </div>
      </Card>

      {/* Main Grid: Calculator Table + Copyable Output Box */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Left Column: Calculation Table (7 cols on XL) */}
        <Card className="flex flex-col overflow-hidden xl:col-span-7">
          <div className="section-head flex items-center justify-between border-b border-border/70 p-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Service Price Rows</h3>
              <p className="text-xs text-muted-foreground">Enter service names and original prices to see live discounted rates.</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              className="border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary font-semibold shadow-xs"
              onClick={handleAddRow}
            >
              <Plus className="size-3.5 mr-1" aria-hidden="true" />
              Add service
            </Button>
          </div>

          {/* Table Container */}
          <div className="rate-table-wrapper w-full overflow-x-auto">
            <div className="min-w-[620px]">
              {/* Header */}
              <div
                className="rate-table-header grid items-center gap-2 border-b border-border/80 bg-muted/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"
                style={{ gridTemplateColumns: "minmax(140px, 1fr) 110px 115px 125px 44px" }}
              >
                <span>Service Name</span>
                <span className="text-right">Original</span>
                <span className="text-right text-sky-400">-{discount1Pct}% Off</span>
                <span className="text-right text-amber-400">-{discount2Pct}% Extra</span>
                <span className="text-center">Action</span>
              </div>

              {/* Rows */}
              <div className="rate-table-body max-h-[460px] divide-y divide-border/40 overflow-y-auto">
                {calculatedItems.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
                    <p>No service rows entered yet.</p>
                    <Button variant="outline" size="sm" onClick={handleAddRow}>
                      <Plus className="size-3.5 mr-1" aria-hidden="true" />
                      Add your first service
                    </Button>
                  </div>
                ) : (
                  calculatedItems.map((item) => (
                    <div
                      key={item.id}
                      className="rate-table-row grid items-center gap-2 px-3 py-2 transition-colors hover:bg-muted/20"
                      style={{ gridTemplateColumns: "minmax(140px, 1fr) 110px 115px 125px 44px" }}
                    >
                      {/* Service Name */}
                      <div className="min-w-0">
                        <Input
                          value={item.serviceName}
                          onChange={(e) => handleUpdateRow(item.id, "serviceName", e.target.value)}
                          placeholder="Service name (e.g. M+ 10)"
                          aria-label="Service name"
                          className="h-8 text-xs sm:text-sm px-2.5 bg-popover/80 rounded-lg"
                        />
                      </div>

                      {/* Original Price */}
                      <div>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={item.originalPrice || ""}
                          onChange={(e) => handleUpdateRow(item.id, "originalPrice", Number(e.target.value))}
                          placeholder="0"
                          aria-label="Original price"
                          className="h-8 text-xs sm:text-sm px-2.5 text-right font-mono bg-popover/80 rounded-lg"
                        />
                      </div>

                      {/* Tier 1 Discount */}
                      <div className="text-right font-mono text-xs sm:text-sm font-semibold text-sky-300 pr-1">
                        {money(item.discountedPrice1)}
                      </div>

                      {/* Tier 2 Discount (Extra) */}
                      <div className="text-right font-mono text-xs sm:text-sm font-bold text-amber-300 pr-1">
                        {money(item.discountedPrice2)}
                      </div>

                      {/* Action */}
                      <div className="flex justify-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          className="size-7 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                          onClick={() => handleDeleteRow(item.id)}
                          title="Delete service row"
                          aria-label="Delete service row"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Table Footer: Totals */}
          {calculatedItems.length > 0 && (
            <div className="border-t border-border/70 bg-card/90 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">{calculatedItems.length} service row{calculatedItems.length === 1 ? "" : "s"}</span>
              <div className="flex items-center gap-4 font-mono">
                <span>Orig Total: <strong className="text-foreground">{money(totals.original)}</strong></span>
                <span>Tier 1 Total: <strong className="text-sky-300">{money(totals.tier1)}</strong></span>
                <span>Final Total: <strong className="text-amber-300">{money(totals.tier2)}</strong></span>
              </div>
            </div>
          )}
        </Card>

        {/* Right Column: Copyable Result Box (5 cols on XL) */}
        <Card className="flex flex-col overflow-hidden xl:col-span-5">
          <div className="section-head flex flex-wrap items-center justify-between gap-2 border-b border-border/70 p-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Copyable Results Box</h3>
              <p className="text-xs text-muted-foreground">Service name + final discounted price only.</p>
            </div>
            <Button
              variant="default"
              size="sm"
              type="button"
              className={cn(
                "font-bold shadow-md transition-all",
                copied ? "bg-emerald-600 hover:bg-emerald-600 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
              onClick={handleCopyToClipboard}
              disabled={!copyableText}
            >
              {copied ? (
                <>
                  <Check className="size-3.5 mr-1" aria-hidden="true" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="size-3.5 mr-1" aria-hidden="true" />
                  Copy all results
                </>
              )}
            </Button>
          </div>

          {/* Format selector bar */}
          <div className="flex items-center justify-between border-b border-border/60 bg-muted/25 px-4 py-2 text-xs">
            <span className="text-muted-foreground font-medium">Output format:</span>
            <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card/90 p-0.5">
              <button
                type="button"
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer",
                  outputFormat === "list"
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setOutputFormat("list")}
              >
                List
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer",
                  outputFormat === "bullet"
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setOutputFormat("bullet")}
              >
                Bullet
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer",
                  outputFormat === "dash"
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setOutputFormat("dash")}
              >
                Dash
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer",
                  outputFormat === "table"
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setOutputFormat("table")}
              >
                Table
              </button>
            </div>
          </div>

          {/* Copyable Box content area */}
          <div className="p-4 flex-1 flex flex-col">
            <label htmlFor={copyAreaId} className="sr-only">Copyable price calculation results</label>
            <textarea
              id={copyAreaId}
              readOnly
              value={copyableText || "Enter service rows on the left to generate copyable price results."}
              onClick={(e) => e.target.select()}
              className="w-full flex-1 min-h-[300px] rounded-xl border border-border/80 bg-field p-3.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary select-all resize-none shadow-inner"
              placeholder="Calculation output will appear here..."
              aria-label="Copyable price calculation results"
            />
            <p className="mt-2 text-[11px] text-muted-foreground text-right">
              Click inside the box to select all, or use the "Copy all results" button above.
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}
