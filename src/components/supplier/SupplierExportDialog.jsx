import React, { useEffect, useMemo, useState } from "react";
import { Calendar, Download, FileImage, Sparkles, X } from "lucide-react";
import { money } from "../../utils/format.js";
import { buildSupplierSummary } from "../../utils/supplierBatch.js";
import { Badge } from "@/components/ui/badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card } from "@/components/ui/card.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";

export function SupplierExportDialog({
  isOpen,
  records = [],
  defaultDateFrom = "",
  defaultDateTo = "",
  onClose,
  onExport
}) {
  const verifiedRecords = useMemo(
    () => records.filter((record) => record.correct && !record.paid),
    [records]
  );

  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);

  useEffect(() => {
    if (isOpen) {
      setDateFrom(defaultDateFrom);
      setDateTo(defaultDateTo);
    }
  }, [isOpen, defaultDateFrom, defaultDateTo]);

  const allVerifiedTotal = useMemo(
    () => verifiedRecords.reduce((sum, r) => sum + Number(r.totalCost || 0), 0),
    [verifiedRecords]
  );

  const dateRangeVerifiedRecords = useMemo(() => {
    return verifiedRecords.filter((record) => {
      const recordDate = String(record.date || "").slice(0, 10);
      if (dateFrom && recordDate < dateFrom) return false;
      if (dateTo && recordDate > dateTo) return false;
      return true;
    });
  }, [verifiedRecords, dateFrom, dateTo]);

  const dateRangeTotal = useMemo(
    () => dateRangeVerifiedRecords.reduce((sum, r) => sum + Number(r.totalCost || 0), 0),
    [dateRangeVerifiedRecords]
  );

  if (!isOpen) return null;

  const handleInstantExport = () => {
    if (!verifiedRecords.length) return;
    const summary = buildSupplierSummary(verifiedRecords);
    onExport(verifiedRecords, summary, allVerifiedTotal);
    onClose();
  };

  const handleDateRangeExport = () => {
    if (!dateRangeVerifiedRecords.length) return;
    const summary = buildSupplierSummary(dateRangeVerifiedRecords);
    onExport(dateRangeVerifiedRecords, summary, dateRangeTotal);
    onClose();
  };

  const handleSetQuickRange = (type) => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (type === "today") {
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (type === "week") {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      setDateFrom(start.toISOString().slice(0, 10));
      setDateTo(todayStr);
    } else if (type === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setDateFrom(start.toISOString().slice(0, 10));
      setDateTo(todayStr);
    } else if (type === "all") {
      setDateFrom("");
      setDateTo("");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-title"
    >
      <Card className="w-full max-w-lg overflow-hidden border-border/80 bg-popover shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/70 p-4 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <FileImage className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h3 id="export-dialog-title" className="text-base font-bold text-foreground">
                Export Supplier Batch PNG
              </h3>
              <p className="text-xs text-muted-foreground">
                Generate high-resolution PNG reports for buyers and suppliers.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-full"
            onClick={onClose}
            aria-label="Close export dialog"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4">
          {/* Option 1: Instant Export */}
          <div className="rounded-xl border border-border/70 bg-card/60 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-sky-400" aria-hidden="true" />
                <h4 className="text-sm font-semibold text-foreground">Instant Export (All Verified)</h4>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {verifiedRecords.length} records
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Immediately export all {verifiedRecords.length} verified unpaid sales records in the current batch.
            </p>
            <div className="flex items-center justify-between pt-1">
              <span className="font-mono text-sm font-bold text-sky-300">
                {money(allVerifiedTotal)}
              </span>
              <Button
                type="button"
                size="sm"
                onClick={handleInstantExport}
                disabled={!verifiedRecords.length}
                className="font-semibold"
              >
                <Download className="size-3.5 mr-1.5" />
                Instant Export All ({verifiedRecords.length})
              </Button>
            </div>
          </div>

          {/* Option 2: Date Range Export */}
          <div className="rounded-xl border border-border/70 bg-card/60 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-emerald-400" aria-hidden="true" />
                <h4 className="text-sm font-semibold text-foreground">Date Range Export</h4>
              </div>
              <Badge
                variant={dateRangeVerifiedRecords.length > 0 ? "secondary" : "outline"}
                className="font-mono text-xs"
              >
                {dateRangeVerifiedRecords.length} in range
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Export verified sales matching a custom date range.
            </p>

            {/* Quick date range presets */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => handleSetQuickRange("today")}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => handleSetQuickRange("week")}
              >
                Past 7 Days
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => handleSetQuickRange("month")}
              >
                This Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => handleSetQuickRange("all")}
              >
                Reset Dates
              </Button>
            </div>

            {/* Date Inputs */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Label className="text-xs flex flex-col gap-1.5">
                From Date
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="text-xs"
                />
              </Label>
              <Label className="text-xs flex flex-col gap-1.5">
                To Date
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="text-xs"
                />
              </Label>
            </div>

            {/* Range Result & Action */}
            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <div>
                <span className="text-[11px] text-muted-foreground block">Selected Range Total</span>
                <span className="font-mono text-sm font-bold text-emerald-300">
                  {money(dateRangeTotal)}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleDateRangeExport}
                disabled={!dateRangeVerifiedRecords.length}
                className="font-semibold"
              >
                <Download className="size-3.5 mr-1.5" />
                Export Range ({dateRangeVerifiedRecords.length})
              </Button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-border/70 p-4 bg-muted/20">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}
