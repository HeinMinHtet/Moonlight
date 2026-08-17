import React, { useMemo, useState } from "react";
import { AccessDenied } from "../AccessDenied.jsx";
import { SupplierRecordForm } from "./SupplierRecordForm.jsx";
import { SupplierRecordsTable } from "./SupplierRecordsTable.jsx";
import { SupplierSummary } from "./SupplierSummary.jsx";
import { dateOnly, money } from "../../utils/format.js";
import { buildSupplierSummary } from "../../utils/supplierBatch.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card } from "@/components/ui/card.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { NativeSelect } from "@/components/ui/native-select.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";

const filterDefaults = {
  status: "all",
  service: "all",
  dateFrom: "",
  dateTo: ""
};

export function SupplierUnpaidPage({
  isAdmin,
  loading,
  loadError,
  records,
  services,
  armorTypes,
  paidHistory,
  permissions,
  editing,
  formKey,
  onSubmitRecord,
  onPatchRecord,
  onDeleteRecord,
  onSetEditing,
  onExport,
  onMarkPaid
}) {
  const [filters, setFilters] = useState(filterDefaults);
  const activeServices = useMemo(() => services.filter((service) => service.active !== false), [services]);

  const filteredRecords = useMemo(
    () => records.filter((record) => matchesFilters(record, filters)),
    [records, filters]
  );
  const visibleVerifiedRows = useMemo(
    () => filteredRecords.filter((record) => record.correct && !record.paid),
    [filteredRecords]
  );
  const reviewCount = useMemo(
    () => filteredRecords.filter((record) => !record.correct).length,
    [filteredRecords]
  );
  const batchRows = visibleVerifiedRows;
  const batchSummary = useMemo(() => buildSupplierSummary(batchRows), [batchRows]);
  const batchTotal = useMemo(
    () => batchRows.reduce((sum, record) => sum + Number(record.totalCost || 0), 0),
    [batchRows]
  );
  const lastPaidAt = paidHistory?.[0]?.paidAt || "";
  const serviceOptions = useMemo(
    () => [...new Set(records.map((record) => record.serviceType).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [records]
  );

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  if (!isAdmin) return <AccessDenied />;

  return (
    <section className="tab-panel active">
      <section className="sheet-layout">
        <Card asChild><article className="sheet-main">
          <div className="section-head">
            <div>
              <h2>Unpaid sales records</h2>
              <p className="panel-note">
                {permissions.canUseSupplier
                  ? "Filter the unpaid ledger. Only the matching verified rows are exported or marked paid."
                  : "Locked to Discord admins."}
              </p>
            </div>
            <div className="section-actions">
              <Button variant="outline" type="button" onClick={() => onExport(batchRows, batchSummary, batchTotal)} disabled={!batchRows.length}>
                Export batch PNG
              </Button>
              <Button type="button" onClick={() => onMarkPaid(batchRows)} disabled={!permissions.canMarkSupplierPaid || !batchRows.length}>
                Mark batch paid
              </Button>
              <span>{records.length} unpaid</span>
            </div>
          </div>

          <section className="batch-bar" aria-label="Current supplier payout batch">
            <div>
              <span className="batch-label">Filtered verified batch</span>
              <strong>{money(batchTotal)}</strong>
            </div>
            <div>
              <span className="batch-label">Rows</span>
              <strong>{batchRows.length}</strong>
            </div>
            <div>
              <span className="batch-label">Needs review</span>
              <strong>{reviewCount}</strong>
            </div>
            <div>
              <span className="batch-label">Last paid</span>
              <strong>{lastPaidAt ? dateOnly(lastPaidAt) : "None"}</strong>
            </div>
          </section>

          <section className="filter-bar" aria-label="Supplier record filters">
            <Label>
              Status
              <NativeSelect value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
                <option value="all">All unpaid</option>
                <option value="verified">Verified only</option>
                <option value="review">Needs review</option>
              </NativeSelect>
            </Label>
            <Label>
              Service
              <NativeSelect value={filters.service} onChange={(event) => updateFilter("service", event.target.value)}>
                <option value="all">All services</option>
                {serviceOptions.map((service) => <option key={service} value={service}>{service}</option>)}
              </NativeSelect>
            </Label>
            <Label>
              From
              <Input type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} />
            </Label>
            <Label>
              To
              <Input type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} />
            </Label>
            <Button
              variant="outline"
              type="button"
              onClick={() => setFilters(filterDefaults)}
            >
              Clear filters
            </Button>
          </section>

          {loading && <div className="space-y-2 p-4" aria-label="Loading unpaid sales records"><Skeleton className="h-10 w-full" /><Skeleton className="h-32 w-full" /></div>}
          {!loading && loadError && <Alert variant="destructive" className="m-4"><AlertTitle>Could not load unpaid sales</AlertTitle><AlertDescription>{loadError}</AlertDescription></Alert>}
          {!loading && !loadError && (
            <>
              <SupplierRecordForm
                key={formKey}
                disabled={!permissions.canUseSupplier}
                services={activeServices}
                armorTypes={armorTypes}
                onSubmit={onSubmitRecord}
              />
              <SupplierRecordsTable
                records={filteredRecords}
                services={activeServices}
                armorTypes={armorTypes}
                editing={editing}
                onSetEditing={onSetEditing}
                permissions={permissions}
                onPatchRecord={onPatchRecord}
                onDeleteRecord={onDeleteRecord}
              />
            </>
          )}
        </article></Card>

        <SupplierSummary rows={batchSummary} grandTotal={batchTotal} />
      </section>
    </section>
  );
}

function matchesFilters(record, filters) {
  if (filters.status === "verified" && !record.correct) return false;
  if (filters.status === "review" && record.correct) return false;
  if (filters.service !== "all" && record.serviceType !== filters.service) return false;
  if (filters.dateFrom && String(record.date || "") < filters.dateFrom) return false;
  if (filters.dateTo && String(record.date || "") > filters.dateTo) return false;
  return true;
}
