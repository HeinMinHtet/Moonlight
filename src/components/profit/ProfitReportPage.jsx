import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../api.js";
import { dateOnly, money, today } from "../../utils/format.js";
import { AccessDenied } from "../AccessDenied.jsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card } from "@/components/ui/card.jsx";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { cn } from "@/lib/utils.js";

const currentDate = today();
const currentMonth = currentDate.slice(0, 7);

export function ProfitReportPage({ isAdmin, refreshVersion }) {
  const [mode, setMode] = useState("daily");
  const [day, setDay] = useState(currentDate);
  const [month, setMonth] = useState(currentMonth);
  const [dateFrom, setDateFrom] = useState(`${currentMonth}-01`);
  const [dateTo, setDateTo] = useState(currentDate);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const requestOptions = useMemo(() => reportOptions(mode, { day, month, dateFrom, dateTo }), [mode, day, month, dateFrom, dateTo]);

  useEffect(() => {
    if (!isAdmin || !requestOptions) return;
    let cancelled = false;
    const load = async () => {
      if (!report) setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams(requestOptions);
        const payload = await api(`/api/profit-report?${params}`);
        if (!cancelled) setReport(payload);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [isAdmin, refreshVersion, requestOptions]);

  if (!isAdmin) return <AccessDenied />;

  const totals = report?.totals || emptyTotals;
  const rows = report?.rows || [];
  const netTone = totals.netProfit < 0 ? "profit-negative" : "profit-positive";
  const profitMargin = totals.supplierPaidTotal > 0
    ? Math.round((totals.netProfit / totals.supplierPaidTotal) * 100)
    : 0;

  return (
    <section className="tab-panel active">
      <Card asChild><article className="sheet-main profit-report-page">
        <header className="section-head">
          <div>
            <p className="section-kicker">Admin financial report</p>
            <h2>Profit report</h2>
            <p className="panel-note">Paid supplier sales minus paid booster payouts, grouped by the saved payment date.</p>
          </div>
          <span>{rangeLabel(report?.range || requestOptions)}</span>
        </header>

        <section className="report-controls" aria-label="Profit report period">
          <div className="report-mode-switch" role="group" aria-label="Report mode">
            {[["daily", "Daily"], ["monthly", "Monthly"], ["range", "Date range"]].map(([value, label]) => (
              <Button key={value} variant={mode === value ? "default" : "outline"} type="button" onClick={() => setMode(value)}>{label}</Button>
            ))}
          </div>
          <div className="report-date-fields">
            {mode === "daily" && <Label>Payment day<Input type="date" value={day} onChange={(event) => setDay(event.target.value)} /></Label>}
            {mode === "monthly" && <Label>Payment month<Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></Label>}
            {mode === "range" && (
              <>
                <Label>From<Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></Label>
                <Label>To<Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></Label>
              </>
            )}
          </div>
        </section>

        <section className="batch-bar profit-stat-bar" aria-label="Profit totals">
          <div className="border-t-2 border-t-emerald-500/80">
            <span className="batch-label">Supplier paid</span>
            <strong className="text-emerald-300">{money(totals.supplierPaidTotal)}</strong>
            <small>{totals.supplierRecordCount} sales rows</small>
          </div>
          <div className="border-t-2 border-t-sky-400/80">
            <span className="batch-label">Booster payouts</span>
            <strong className="text-sky-300">{money(totals.boosterPayoutTotal)}</strong>
            <small>{totals.boosterRecordCount} payout rows</small>
          </div>
          <div className={cn(netTone, totals.netProfit < 0 ? "border-t-2 border-t-rose-500/80" : "border-t-2 border-t-emerald-500/80")}>
            <div className="flex items-center justify-between">
              <span className="batch-label">Net profit</span>
              {totals.supplierPaidTotal > 0 && (
                <Badge variant={totals.netProfit >= 0 ? "success" : "destructive"} className="text-[10px] px-1.5 py-0.5">
                  {profitMargin}% margin
                </Badge>
              )}
            </div>
            <strong className={totals.netProfit < 0 ? "text-rose-300" : "text-emerald-300"}>{money(totals.netProfit)}</strong>
            <small>Supplier paid minus booster paid</small>
          </div>
        </section>

        {loading && !report && <div className="space-y-2 p-4" aria-label="Loading profit report"><Skeleton className="h-10 w-full" /><Skeleton className="h-28 w-full" /></div>}
        {!loading && error && <Alert variant="destructive" className="m-4"><AlertTitle>Could not load the profit report</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        {!loading && !error && !rows.length && <Empty><EmptyTitle>No paid records in this period</EmptyTitle><EmptyDescription>Choose another payment day, month, or date range.</EmptyDescription></Empty>}
        {!error && rows.length > 0 && (
          <div className="table-wrap profit-table-wrap">
            <Table className="profit-table">
              <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Supplier paid</TableHead><TableHead>Booster payouts</TableHead><TableHead>Net profit</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.period}>
                    <TableCell>{periodLabel(row.period, report.groupBy)}</TableCell>
                    <TableCell>{money(row.supplierPaidTotal)}</TableCell>
                    <TableCell>{money(row.boosterPayoutTotal)}</TableCell>
                    <TableCell className={row.netProfit < 0 ? "profit-negative-text" : "profit-positive-text"}>{money(row.netProfit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </article></Card>
    </section>
  );
}

const emptyTotals = {
  supplierPaidTotal: 0,
  boosterPayoutTotal: 0,
  netProfit: 0,
  supplierRecordCount: 0,
  boosterRecordCount: 0
};

function reportOptions(mode, filters) {
  if (mode === "daily") return filters.day ? { from: filters.day, to: filters.day, groupBy: "daily" } : null;
  if (mode === "monthly") {
    if (!/^\d{4}-\d{2}$/.test(filters.month)) return null;
    const [year, month] = filters.month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { from: `${filters.month}-01`, to: `${filters.month}-${String(lastDay).padStart(2, "0")}`, groupBy: "monthly" };
  }
  if (!filters.dateFrom || !filters.dateTo) return null;
  return { from: filters.dateFrom, to: filters.dateTo, groupBy: "daily" };
}

function periodLabel(period, groupBy) {
  if (groupBy === "monthly") {
    return new Date(`${period}-01T00:00:00.000Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
  }
  return dateOnly(`${period}T00:00:00.000Z`);
}

function rangeLabel(range) {
  if (!range?.from || !range?.to) return "Choose a valid period";
  if (range.from === range.to) return dateOnly(`${range.from}T00:00:00.000Z`);
  return `${dateOnly(`${range.from}T00:00:00.000Z`)} - ${dateOnly(`${range.to}T00:00:00.000Z`)}`;
}
