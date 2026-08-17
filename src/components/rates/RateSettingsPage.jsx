import React, { useMemo } from "react";
import { AccessDenied } from "../AccessDenied.jsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card } from "@/components/ui/card.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";

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
  onUpdatePriceRow,
  onSaveSupplierPrices,
  onSaveBoosterPrices
}) {
  if (!isAdmin) return <AccessDenied />;
  if (loading) return <section className="tab-panel active space-y-3"><Skeleton className="h-28 w-full" /><Skeleton className="h-72 w-full" /></section>;
  if (loadError) return <section className="tab-panel active"><Alert variant="destructive"><AlertTitle>Could not load default rates</AlertTitle><AlertDescription>{loadError}</AlertDescription></Alert></section>;

  return (
    <section className="tab-panel active rate-settings-page">
      <header className="rate-page-head">
        <div>
          <p className="section-kicker">Admin-only defaults</p>
          <h2>Default rates</h2>
          <p>Changes affect new records only. Existing supplier sales and booster payouts keep their saved rates.</p>
        </div>
        <Badge variant="admin">Admin controls</Badge>
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
          onChange={(index, change) => onUpdatePriceRow("boosterPrices", index, change)}
          onSubmit={onSaveBoosterPrices}
        />
      </section>
    </section>
  );
}

function PricePanel({ title, itemLabel, rows, historyRecords, itemKey, historyKey, addLabel, saveLabel, disabled, onAdd, onToggle, onChange, onSubmit }) {
  const duplicateNames = useMemo(() => findDuplicateNames(rows, itemKey), [rows, itemKey]);
  const indexedRows = rows.map((row, index) => ({ row, index }));
  const activeRows = indexedRows.filter(({ row }) => row.active !== false);
  const archivedRows = indexedRows.filter(({ row }) => row.active === false);

  return (
    <Card asChild><form className="price-panel" onSubmit={onSubmit}>
      <div className="section-head">
        <div><h2>{title}</h2><p className="panel-note">Used only when a new record is created.</p></div>
        <Button type="button" onClick={onAdd} disabled={disabled}>{addLabel}</Button>
      </div>

      <RateGroup
        title="Active rates"
        emptyMessage={`No active ${itemLabel} rates. Restore an archived rate or add a new one.`}
        rows={activeRows}
        {...{ itemLabel, itemKey, historyKey, historyRecords, duplicateNames, disabled, onToggle, onChange }}
      />
      {archivedRows.length > 0 && (
        <RateGroup
          title="Archived rates"
          emptyMessage=""
          rows={archivedRows}
          archived
          {...{ itemLabel, itemKey, historyKey, historyRecords, duplicateNames, disabled, onToggle, onChange }}
        />
      )}

      {duplicateNames.size > 0 && <p className="form-error" role="alert">Duplicate {itemLabel} names must be changed before saving.</p>}
      <div className="price-save-bar">
        <span>{activeRows.length} active / {archivedRows.length} archived</span>
        <Button type="submit" disabled={disabled || duplicateNames.size > 0}>{saveLabel}</Button>
      </div>
    </form></Card>
  );
}

function RateGroup({ title, emptyMessage, rows, archived = false, itemLabel, itemKey, historyKey, historyRecords, duplicateNames, disabled, onToggle, onChange }) {
  return (
    <section className={`rate-group ${archived ? "archived" : ""}`}>
      <div className="rate-group-head"><h3>{title}</h3><span>{rows.length}</span></div>
      {!rows.length && <p className="rate-empty">{emptyMessage}</p>}
      <div className="price-rows">
        {rows.map(({ row, index }) => {
          const normalizedName = String(row[itemKey] || "").trim().toLocaleLowerCase();
          const duplicate = duplicateNames.has(normalizedName);
          const historyCount = historyRecords.filter((record) => record[historyKey] === row[itemKey]).length;
          return (
            <div className={`price-row ${archived ? "archived-row" : ""} ${duplicate ? "invalid-row" : ""}`} key={`${itemKey}-${index}`}>
              <Label>
                <span>{itemLabel === "service" ? "Service" : "Mythic+ key level"}</span>
                <Input value={row[itemKey] || ""} onChange={(event) => onChange(index, { [itemKey]: event.target.value })} disabled={disabled} placeholder={itemLabel === "service" ? "Service name" : "Key level"} aria-invalid={duplicate} />
              </Label>
              <Label><span>Default rate</span><Input type="number" min="0" step="0.01" value={row.price ?? 0} onChange={(event) => onChange(index, { price: Number(event.target.value) })} disabled={disabled} /></Label>
              <div className="rate-row-meta">
                <Badge variant={archived ? "neutral" : "success"}>{archived ? "Archived" : "Active"}</Badge>
                <Button variant="outline" size="sm" type="button" onClick={() => onToggle(index)} disabled={disabled}>{archived ? "Restore" : "Archive"}</Button>
              </div>
              {duplicate && <small className="field-error">Duplicate name</small>}
              {historyCount > 0 && <small className="history-warning">Used by {historyCount} saved record{historyCount === 1 ? "" : "s"}. Historical rates will remain unchanged.</small>}
            </div>
          );
        })}
      </div>
    </section>
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
