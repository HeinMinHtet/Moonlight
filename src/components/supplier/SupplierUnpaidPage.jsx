import React, { useMemo } from "react";
import { AccessDenied } from "../AccessDenied.jsx";
import { SupplierRecordForm } from "./SupplierRecordForm.jsx";
import { SupplierRecordsTable } from "./SupplierRecordsTable.jsx";
import { SupplierSummary } from "./SupplierSummary.jsx";
import { buildSupplierSummary } from "../../utils/supplierBatch.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card } from "@/components/ui/card.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";

export function SupplierUnpaidPage({
  isAdmin,
  loading,
  loadError,
  records,
  services,
  armorTypes,
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
  const activeServices = useMemo(() => services.filter((service) => service.active !== false), [services]);
  const visibleVerifiedRows = useMemo(
    () => records.filter((record) => record.correct && !record.paid),
    [records]
  );
  const batchRows = visibleVerifiedRows;
  const batchSummary = useMemo(() => buildSupplierSummary(batchRows), [batchRows]);
  const batchTotal = useMemo(
    () => batchRows.reduce((sum, record) => sum + Number(record.totalCost || 0), 0),
    [batchRows]
  );
  if (!isAdmin) return <AccessDenied />;

  return (
    <section className="tab-panel active">
      <section className="sheet-layout grid-cols-1">
        <Card asChild><article className="sheet-main">
          <SupplierSummary rows={batchSummary} grandTotal={batchTotal} embedded>
            <Button variant="outline" type="button" onClick={() => onExport(batchRows, batchSummary, batchTotal)} disabled={!batchRows.length}>
              Export batch PNG
            </Button>
            <Button type="button" onClick={() => onMarkPaid(batchRows)} disabled={!permissions.canMarkSupplierPaid || !batchRows.length}>
              Mark batch paid
            </Button>
            <span>{records.length} unpaid</span>
          </SupplierSummary>

          <section className="supplier-records-panel" aria-label="Supplier records workspace">
            {!loading && !loadError && (
              <SupplierRecordForm
                key={formKey}
                disabled={!permissions.canUseSupplier}
                services={activeServices}
                armorTypes={armorTypes}
                onSubmit={onSubmitRecord}
              />
            )}

            {loading && <div className="space-y-2 p-4" aria-label="Loading unpaid sales records"><Skeleton className="h-10 w-full" /><Skeleton className="h-32 w-full" /></div>}
            {!loading && loadError && <Alert variant="destructive" className="m-4"><AlertTitle>Could not load unpaid sales</AlertTitle><AlertDescription>{loadError}</AlertDescription></Alert>}
            {!loading && !loadError && (
              <SupplierRecordsTable
                records={records}
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
        </article></Card>
      </section>
    </section>
  );
}
