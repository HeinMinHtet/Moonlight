import React, { useMemo, useState } from "react";
import { CheckCheck } from "lucide-react";
import { AccessDenied } from "../AccessDenied.jsx";
import { SupplierExportDialog } from "./SupplierExportDialog.jsx";
import { SupplierRecordForm } from "./SupplierRecordForm.jsx";
import { SupplierRecordsTable } from "./SupplierRecordsTable.jsx";
import { SupplierSummary } from "./SupplierSummary.jsx";
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
  armorType: "all",
  search: "",
  dateFrom: "",
  dateTo: ""
};

export function SupplierUnpaidPage({
  isAdmin,
  loading,
  loadError,
  records = [],
  services = [],
  armorTypes = [],
  paidHistory = [],
  permissions = {},
  editing,
  formKey,
  onSubmitRecord,
  onPatchRecord,
  onDeleteRecord,
  onSetEditing,
  onExport,
  onVerifyAll,
  onMarkPaid
}) {
  const [filters, setFilters] = useState(filterDefaults);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const activeServices = useMemo(() => services.filter((service) => service.active !== false), [services]);

  const visibleVerifiedRows = useMemo(
    () => records.filter((record) => record.correct && !record.paid),
    [records]
  );
  const unverifiedRows = useMemo(
    () => records.filter((record) => !record.correct && !record.paid),
    [records]
  );

  const batchRows = visibleVerifiedRows;
  const batchSummary = useMemo(() => buildSupplierSummary(batchRows), [batchRows]);
  const batchTotal = useMemo(
    () => batchRows.reduce((sum, record) => sum + Number(record.totalCost || 0), 0),
    [batchRows]
  );

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      if (filters.status === "verified" && !record.correct) return false;
      if (filters.status === "unverified" && record.correct) return false;
      if (filters.service !== "all" && record.serviceType !== filters.service) return false;
      if (filters.armorType !== "all" && record.armorType !== filters.armorType) return false;
      const recordDate = String(record.date || "").slice(0, 10);
      if (filters.dateFrom && recordDate < filters.dateFrom) return false;
      if (filters.dateTo && recordDate > filters.dateTo) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        const buyer = String(record.buyerName || "").toLowerCase();
        const note = String(record.note || "").toLowerCase();
        const service = String(record.serviceType || "").toLowerCase();
        if (!buyer.includes(q) && !note.includes(q) && !service.includes(q)) return false;
      }
      return true;
    });
  }, [records, filters]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  if (!isAdmin) return <AccessDenied />;

  return (
    <section className="tab-panel active">
      <section className="sheet-layout grid-cols-1">
        <Card asChild><article className="sheet-main">
          <SupplierSummary rows={batchSummary} grandTotal={batchTotal} embedded>
            <Button
              variant="secondary"
              type="button"
              onClick={() => onVerifyAll?.(unverifiedRows)}
              disabled={!permissions.canEditSupplierStatus || !unverifiedRows.length}
            >
              <CheckCheck className="size-4 mr-1.5" />
              Verify all unpaid ({unverifiedRows.length})
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => setExportDialogOpen(true)}
              disabled={!batchRows.length}
            >
              Export batch PNG
            </Button>
            <Button
              type="button"
              onClick={() => onMarkPaid(batchRows)}
              disabled={!permissions.canMarkSupplierPaid || !batchRows.length}
            >
              Mark batch paid
            </Button>
            <span>{records.length} unpaid</span>
          </SupplierSummary>

          <section className="supplier-records-panel" aria-label="Supplier records workspace">
            {!loading && !loadError && (
              <>
                <SupplierRecordForm
                  key={formKey}
                  disabled={!permissions.canUseSupplier}
                  services={activeServices}
                  armorTypes={armorTypes}
                  onSubmit={onSubmitRecord}
                />

                <section className="filter-bar supplier-filter-bar" aria-label="Supplier record filters">
                  <Label className="filter-search">
                    Search
                    <Input
                      placeholder="Buyer, note, service..."
                      value={filters.search}
                      onChange={(event) => updateFilter("search", event.target.value)}
                    />
                  </Label>
                  <Label className="filter-select">
                    Status
                    <NativeSelect
                      value={filters.status}
                      onChange={(event) => updateFilter("status", event.target.value)}
                    >
                      <option value="all">All statuses</option>
                      <option value="verified">Verified only</option>
                      <option value="unverified">Unverified only</option>
                    </NativeSelect>
                  </Label>
                  <Label className="filter-select">
                    Service
                    <NativeSelect
                      value={filters.service}
                      onChange={(event) => updateFilter("service", event.target.value)}
                    >
                      <option value="all">All services</option>
                      {activeServices.map((service) => (
                        <option key={service.type} value={service.type}>{service.type}</option>
                      ))}
                    </NativeSelect>
                  </Label>
                  <Label className="filter-select">
                    Armor stack
                    <NativeSelect
                      value={filters.armorType}
                      onChange={(event) => updateFilter("armorType", event.target.value)}
                    >
                      <option value="all">All armor stacks</option>
                      {armorTypes.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </NativeSelect>
                  </Label>
                  <Label className="filter-date">
                    From
                    <Input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(event) => updateFilter("dateFrom", event.target.value)}
                    />
                  </Label>
                  <Label className="filter-date">
                    To
                    <Input
                      type="date"
                      value={filters.dateTo}
                      onChange={(event) => updateFilter("dateTo", event.target.value)}
                    />
                  </Label>
                  <Button
                    variant="outline"
                    type="button"
                    className="filter-action"
                    onClick={() => setFilters(filterDefaults)}
                  >
                    Clear filters
                  </Button>
                </section>
              </>
            )}

            {loading && <div className="space-y-2 p-4" aria-label="Loading unpaid sales records"><Skeleton className="h-10 w-full" /><Skeleton className="h-32 w-full" /></div>}
            {!loading && loadError && <Alert variant="destructive" className="m-4"><AlertTitle>Could not load unpaid sales</AlertTitle><AlertDescription>{loadError}</AlertDescription></Alert>}
            {!loading && !loadError && (
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
            )}
          </section>

          <SupplierExportDialog
            isOpen={exportDialogOpen}
            records={records}
            defaultDateFrom={filters.dateFrom}
            defaultDateTo={filters.dateTo}
            onClose={() => setExportDialogOpen(false)}
            onExport={onExport}
          />
        </article></Card>
      </section>
    </section>
  );
}
