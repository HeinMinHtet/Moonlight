import React, { useMemo, useState } from "react";
import { AccessDenied } from "../AccessDenied.jsx";
import { money } from "../../utils/format.js";
import { SupplierHistoryRecordsTable } from "./SupplierHistoryRecordsTable.jsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card } from "@/components/ui/card.jsx";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { NativeSelect } from "@/components/ui/native-select.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";

const filterDefaults = {
  buyer: "",
  service: "all",
  armorType: "all",
  paidBy: "all",
  paidFrom: "",
  paidTo: "",
  saleFrom: "",
  saleTo: ""
};

export function SupplierPaidHistoryPage({
  isAdmin,
  loading,
  loadError,
  records,
  armorTypes = [],
  canReopen,
  onExportBatch,
  onReopenBatch
}) {
  const [filters, setFilters] = useState(filterDefaults);
  const serviceOptions = useMemo(() => uniqueSorted(records.map((record) => record.serviceType)), [records]);
  const armorOptions = useMemo(() => {
    const fromConfig = (armorTypes || []).map((item) => (typeof item === "object" ? item.name : item));
    const fromRecords = records.map((record) => record.armorType);
    return uniqueSorted([...fromConfig, ...fromRecords]);
  }, [armorTypes, records]);
  const paidByOptions = useMemo(
    () => uniqueSorted(records.map((record) => record.paidByName || "Admin")),
    [records]
  );
  const filteredRecords = useMemo(
    () => records.filter((record) => matchesFilters(record, filters)),
    [records, filters]
  );
  const batches = useMemo(() => groupPaymentBatches(filteredRecords), [filteredRecords]);
  const filteredTotal = useMemo(
    () => filteredRecords.reduce((sum, record) => sum + Number(record.totalCost || 0), 0),
    [filteredRecords]
  );
  const filteredQuantity = useMemo(
    () => filteredRecords.reduce((sum, record) => sum + Number(record.quantity || 0), 0),
    [filteredRecords]
  );
  const paidByCount = useMemo(
    () => new Set(filteredRecords.map((record) => record.paidByDiscordId || record.paidByName || "Admin")).size,
    [filteredRecords]
  );
  const filteredItemSummary = useMemo(() => {
    const summaryMap = new Map();
    for (const record of filteredRecords) {
      const service = record.serviceType || "Unknown service";
      const armor = record.armorType || "No stack";
      const key = `${service}__${armor}`;
      const existing = summaryMap.get(key) || {
        service,
        armor,
        totalQty: 0,
        totalCost: 0
      };
      existing.totalQty += Number(record.quantity || 0);
      existing.totalCost += Number(record.totalCost || 0);
      summaryMap.set(key, existing);
    }
    return [...summaryMap.values()].sort(
      (a, b) => a.service.localeCompare(b.service) || a.armor.localeCompare(b.armor)
    );
  }, [filteredRecords]);

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  const isFiltered = Boolean(
    filters.buyer ||
    filters.service !== "all" ||
    filters.armorType !== "all" ||
    filters.paidBy !== "all" ||
    filters.paidFrom ||
    filters.paidTo ||
    filters.saleFrom ||
    filters.saleTo
  );

  if (!isAdmin) return <AccessDenied />;

  return (
    <section className="tab-panel active">
      <Card asChild><article className="sheet-main paid-history-page">
        <div className="section-head">
          <div>
            <h2>Paid supplier history</h2>
            <p className="panel-note">Review completed payments by batch, export the original rows, or reopen a payment made by mistake.</p>
          </div>
          <span>{records.length} paid records</span>
        </div>

        <section className="batch-bar history-stat-bar" aria-label="Filtered paid supplier totals">
          <div className="border-t-2 border-t-emerald-500/80">
            <span className="batch-label">Total sales</span>
            <strong className="text-emerald-300">{money(filteredTotal)}</strong>
            <small>{filteredQuantity} item{filteredQuantity === 1 ? "" : "s"} sold</small>
          </div>
          <div className="border-t-2 border-t-sky-400/80">
            <span className="batch-label">Items sold</span>
            <strong className="text-sky-300">{filteredQuantity}</strong>
            <small>{filteredRecords.length} sales row{filteredRecords.length === 1 ? "" : "s"}</small>
          </div>
          <div className="border-t-2 border-t-sky-400/80">
            <span className="batch-label">Payment batches</span>
            <strong className="text-sky-300">{batches.length}</strong>
            <small>Completed batches</small>
          </div>
          <div className="border-t-2 border-t-sky-400/80">
            <span className="batch-label">Sales records</span>
            <strong className="text-sky-300">{filteredRecords.length}</strong>
            <small>Across {batches.length} batch{batches.length === 1 ? "" : "es"}</small>
          </div>
          <div className="border-t-2 border-t-amber-400/80">
            <span className="batch-label">Paid by</span>
            <strong className="text-amber-300">{paidByCount}</strong>
            <small>Admin{paidByCount === 1 ? "" : "s"}</small>
          </div>
        </section>

        <section className="filter-bar history-filter-bar" aria-label="Paid supplier history filters">
          <Label className="filter-search">
            Buyer
            <Input
              type="search"
              placeholder="Search buyer..."
              value={filters.buyer}
              onChange={(event) => updateFilter("buyer", event.target.value)}
            />
          </Label>
          <Label className="filter-select">
            Service
            <NativeSelect value={filters.service} onChange={(event) => updateFilter("service", event.target.value)}>
              <option value="all">All services</option>
              {serviceOptions.map((service) => <option key={service} value={service}>{service}</option>)}
            </NativeSelect>
          </Label>
          <Label className="filter-select">
            Armor stack
            <NativeSelect value={filters.armorType} onChange={(event) => updateFilter("armorType", event.target.value)}>
              <option value="all">All armor stacks</option>
              {armorOptions.map((armor) => <option key={armor} value={armor}>{armor}</option>)}
            </NativeSelect>
          </Label>
          <Label className="filter-select">
            Paid by
            <NativeSelect value={filters.paidBy} onChange={(event) => updateFilter("paidBy", event.target.value)}>
              <option value="all">All admins</option>
              {paidByOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </NativeSelect>
          </Label>
          <Label className="filter-date">
            Paid from
            <Input type="date" value={filters.paidFrom} onChange={(event) => updateFilter("paidFrom", event.target.value)} />
          </Label>
          <Label className="filter-date">
            Paid to
            <Input type="date" value={filters.paidTo} onChange={(event) => updateFilter("paidTo", event.target.value)} />
          </Label>
          <Label className="filter-date">
            Sale from
            <Input type="date" value={filters.saleFrom} onChange={(event) => updateFilter("saleFrom", event.target.value)} />
          </Label>
          <Label className="filter-date">
            Sale to
            <Input type="date" value={filters.saleTo} onChange={(event) => updateFilter("saleTo", event.target.value)} />
          </Label>
          <Button
            className="filter-action"
            variant="outline"
            type="button"
            onClick={() => setFilters(filterDefaults)}
            disabled={!isFiltered}
          >
            Clear filters
          </Button>
        </section>

        {!loading && !loadError && filteredRecords.length > 0 && (
          <details className="history-summary-details" open={isFiltered}>
            <summary className="history-summary-toggle">
              <span>Filtered items sales lookup ({filteredItemSummary.length} item type{filteredItemSummary.length === 1 ? "" : "s"})</span>
              <strong className="text-emerald-300 font-mono font-semibold">{money(filteredTotal)}</strong>
            </summary>
            <div className="history-summary-content">
              <table className="history-summary-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Armor stack</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Total sale</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItemSummary.map((item) => (
                    <tr key={`${item.service}__${item.armor}`}>
                      <td className="font-medium">{item.service}</td>
                      <td>
                        <span className="history-armor-badge">
                          {item.armor}
                        </span>
                      </td>
                      <td className="text-right font-mono">{item.totalQty}</td>
                      <td className="text-right font-mono font-semibold text-emerald-300">
                        {money(item.totalCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>Filtered total</td>
                    <td className="text-right font-mono">{filteredQuantity}</td>
                    <td className="text-right font-mono text-emerald-300">{money(filteredTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </details>
        )}

        {loading && <div className="space-y-2 p-4" aria-label="Loading paid supplier history"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>}
        {!loading && loadError && <Alert variant="destructive" className="m-4"><AlertTitle>Could not load paid supplier history</AlertTitle><AlertDescription>{loadError}</AlertDescription></Alert>}
        {!loading && !loadError && !records.length && (
          <Empty><EmptyTitle>No supplier payments yet</EmptyTitle><EmptyDescription>Paid batches will appear here after verified supplier rows are completed.</EmptyDescription></Empty>
        )}
        {!loading && !loadError && records.length > 0 && !batches.length && (
          <Empty><EmptyTitle>No matching paid records</EmptyTitle><EmptyDescription>Clear one or more filters to see additional payment batches.</EmptyDescription></Empty>
        )}
        {!loading && !loadError && batches.length > 0 && (
          <section className="history-batch-list" aria-label="Supplier payment batches">
            {batches.map((batch, index) => (
              <PaymentBatch
                key={batch.id}
                batch={batch}
                defaultOpen={index === 0}
                canReopen={canReopen}
                onExport={onExportBatch}
                onReopen={onReopenBatch}
              />
            ))}
          </section>
        )}
      </article></Card>
    </section>
  );
}

function PaymentBatch({ batch, defaultOpen, canReopen, onExport, onReopen }) {
  return (
    <article className="history-batch">
      <header className="history-batch-head">
        <div className="history-batch-title">
          <span className="batch-label">Payment batch</span>
          <h3>{formatDateTime(batch.paidAt)}</h3>
          <code title={batch.id}>{batch.id}</code>
        </div>
        <dl className="history-batch-stats">
          <div><dt>Paid by</dt><dd>{batch.paidByName}</dd></div>
          <div><dt>Rows</dt><dd>{batch.records.length}</dd></div>
          <div><dt>Batch total</dt><dd>{money(batch.total)}</dd></div>
        </dl>
        <div className="history-batch-actions">
          <Button variant="outline" size="sm" type="button" onClick={() => onExport(batch)}>Export PNG</Button>
          <Button variant="destructive" size="sm" type="button" onClick={() => onReopen(batch)} disabled={!canReopen}>Reopen payment</Button>
        </div>
      </header>
      <details className="history-batch-details" open={defaultOpen}>
        <summary>View {batch.records.length} sales record{batch.records.length === 1 ? "" : "s"}</summary>
        <SupplierHistoryRecordsTable records={batch.records} />
      </details>
    </article>
  );
}

function groupPaymentBatches(records) {
  const groups = new Map();
  for (const record of records) {
    const id = record.paymentBatchId || `legacy_${record.paidAt || record.id}`;
    const existing = groups.get(id) || {
      id,
      paidAt: record.paidAt,
      paidByName: record.paidByName || "Admin",
      records: [],
      total: 0
    };
    existing.records.push(record);
    existing.total += Number(record.totalCost || 0);
    groups.set(id, existing);
  }
  return [...groups.values()].sort((a, b) => String(b.paidAt || "").localeCompare(String(a.paidAt || "")));
}

function matchesFilters(record, filters) {
  const buyer = String(record.buyerName || "").toLocaleLowerCase();
  if (filters.buyer && !buyer.includes(filters.buyer.trim().toLocaleLowerCase())) return false;
  if (filters.service !== "all" && record.serviceType !== filters.service) return false;
  if (filters.armorType !== "all" && (record.armorType || "No stack") !== filters.armorType) return false;
  if (filters.paidBy !== "all" && (record.paidByName || "Admin") !== filters.paidBy) return false;
  const paidDate = String(record.paidAt || "").slice(0, 10);
  const saleDate = String(record.date || "").slice(0, 10);
  if (filters.paidFrom && paidDate < filters.paidFrom) return false;
  if (filters.paidTo && paidDate > filters.paidTo) return false;
  if (filters.saleFrom && saleDate < filters.saleFrom) return false;
  if (filters.saleTo && saleDate > filters.saleTo) return false;
  return true;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function formatDateTime(value) {
  if (!value) return "Payment time unavailable";
  return new Date(value).toLocaleString();
}
