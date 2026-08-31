import React, { useEffect, useMemo, useState } from "react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable.jsx";
import { DataTableColumnHeader } from "@/components/data-table/DataTableColumnHeader.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Checkbox } from "@/components/ui/checkbox.jsx";
import { Input } from "@/components/ui/input.jsx";
import { NativeSelect } from "@/components/ui/native-select.jsx";
import { cn } from "@/lib/utils.js";
import { TableDateCell } from "../TableDateCell.jsx";
import { dateOnly, money } from "../../utils/format.js";
import { withCurrent } from "../../utils/options.js";

const centeredHeader = "mx-auto justify-center text-center";
const centeredCell = "text-center";
const numericCell = "text-center font-mono tabular-nums";
const actionCell = "text-center";

export function SupplierRecordsTable({
  records,
  services,
  armorTypes,
  editing,
  onSetEditing,
  permissions,
  onPatchRecord,
  onDeleteRecord
}) {
  const [sorting, setSorting] = useState([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  const [columnVisibility, setColumnVisibility] = useState({});
  const [draft, setDraft] = useState({});
  const editingKey = editing?.scope === "supplier" ? String(editing.id) : "";

  useEffect(() => {
    const record = records.find((item) => String(item.id) === editingKey);
    if (!record) return;
    setDraft({
      date: record.date || "",
      buyerName: record.buyerName || "",
      serviceType: record.serviceType || "",
      quantity: record.quantity ?? 1,
      rateAtRecord: record.rateAtRecord ?? 0,
      armorType: record.armorType || (typeof armorTypes?.[0] === "string" ? armorTypes[0] : armorTypes?.[0]?.name) || "No stack",
      note: record.note || ""
    });
  }, [editingKey]);

  const columns = useMemo(() => [
    {
      id: "rowNumber",
      header: "#",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => <span className="font-mono tabular-nums">{row.index + 1}</span>,
      meta: { headClassName: "w-12 text-center", cellClassName: "w-12 text-center text-muted-foreground" }
    },
    {
      accessorKey: "date",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" className={centeredHeader} />,
      cell: ({ row, getValue, table }) => {
        const { draft, setDraft, editing } = table.options.meta;
        return isEditing(row.original, editing)
          ? <Input className="table-edit-field mx-auto w-32 text-center" type="date" value={draft.date || ""} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} />
          : <TableDateCell date={getValue()} createdAt={row.original.createdAt} />;
      },
      meta: { label: "Date", headClassName: "w-36 text-center", cellClassName: "w-36 text-center" }
    },
    {
      accessorKey: "buyerName",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Buyer" className={centeredHeader} />,
      cell: ({ row, getValue, table }) => {
        const { draft, setDraft, editing } = table.options.meta;
        return isEditing(row.original, editing)
          ? <Input className="table-edit-field mx-auto w-40 text-center" value={draft.buyerName || ""} onChange={(event) => setDraft((current) => ({ ...current, buyerName: event.target.value }))} />
          : getValue();
      },
      meta: { label: "Buyer", headClassName: centeredCell, cellClassName: centeredCell }
    },
    {
      accessorKey: "serviceType",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Service" className={centeredHeader} />,
      cell: ({ row, getValue, table }) => {
        const { draft, setDraft, editing, services } = table.options.meta;
        return isEditing(row.original, editing) ? (
          <NativeSelect className="table-edit-field mx-auto w-40 text-center" value={draft.serviceType || ""} onChange={(event) => setDraft((current) => ({ ...current, serviceType: event.target.value }))}>
            {withCurrent(services.map((service) => service.type), row.original.serviceType).map((value) => <option key={value} value={value}>{value}</option>)}
          </NativeSelect>
        ) : getValue();
      },
      meta: { label: "Service", headClassName: centeredCell, cellClassName: centeredCell }
    },
    {
      accessorKey: "quantity",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Qty" className={centeredHeader} />,
      cell: ({ row, getValue, table }) => {
        const { draft, setDraft, editing } = table.options.meta;
        return isEditing(row.original, editing)
          ? <Input className="table-edit-field mx-auto w-24 text-center font-mono tabular-nums" type="number" min="0" step="0.1" value={draft.quantity ?? 1} onChange={(event) => setDraft((current) => ({ ...current, quantity: event.target.value }))} />
          : <span className="font-mono tabular-nums">{getValue()}</span>;
      },
      meta: { label: "Quantity", headClassName: "w-24 text-center", cellClassName: numericCell }
    },
    {
      accessorKey: "rateAtRecord",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Saved rate" className={centeredHeader} />,
      cell: ({ row, getValue, table }) => {
        const { draft, setDraft, editing } = table.options.meta;
        return isEditing(row.original, editing)
          ? <Input className="table-edit-field mx-auto w-28 text-center font-mono tabular-nums" type="number" min="0" step="0.01" value={draft.rateAtRecord ?? 0} onChange={(event) => setDraft((current) => ({ ...current, rateAtRecord: event.target.value }))} />
          : <span className="font-mono tabular-nums">{money(getValue())}</span>;
      },
      sortingFn: "basic",
      meta: { label: "Saved rate", headClassName: "w-32 text-center", cellClassName: numericCell }
    },
    {
      accessorKey: "armorType",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Armor stack" className={centeredHeader} />,
      cell: ({ row, getValue, table }) => {
        const { draft, setDraft, editing, armorTypes } = table.options.meta;
        return isEditing(row.original, editing) ? (
          <NativeSelect className="table-edit-field mx-auto w-36 text-center" value={draft.armorType || ""} onChange={(event) => setDraft((current) => ({ ...current, armorType: event.target.value }))}>
            {withCurrent(armorTypes, row.original.armorType).map((value) => <option key={value} value={value}>{value}</option>)}
          </NativeSelect>
        ) : getValue();
      },
      meta: { label: "Armor stack", headClassName: centeredCell, cellClassName: centeredCell }
    },
    {
      accessorKey: "correct",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Verified" className={centeredHeader} />,
      cell: ({ row, table }) => {
        const { permissions, onPatchRecord } = table.options.meta;
        return (
          <div className="flex min-h-11 items-center justify-center">
            <Checkbox
              className="size-6 rounded-md border-2 border-muted-foreground/50 bg-muted/40 transition-colors hover:border-primary hover:bg-primary/10 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
              checked={Boolean(row.original.correct)}
              disabled={!permissions.canEditSupplierStatus}
              onCheckedChange={(checked) => onPatchRecord(row.original.id, { correct: Boolean(checked) })}
              aria-label={`Mark ${row.original.buyerName || row.original.serviceType} verified`}
            />
          </div>
        );
      },
      sortingFn: "basic",
      meta: { label: "Verified", headClassName: "w-28 text-center", cellClassName: "w-28 text-center" }
    },
    {
      accessorKey: "totalCost",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" className={centeredHeader} />,
      cell: ({ getValue }) => <strong className="font-mono tabular-nums">{money(getValue())}</strong>,
      sortingFn: "basic",
      meta: { label: "Amount", headClassName: "w-36 text-center", cellClassName: numericCell }
    },
    {
      accessorKey: "note",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Note" className={centeredHeader} />,
      cell: ({ row, getValue, table }) => {
        const { draft, setDraft, editing } = table.options.meta;
        return isEditing(row.original, editing)
          ? <Input className="table-edit-field mx-auto w-48 text-center" value={draft.note || ""} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} />
          : <span className="mx-auto block max-w-60 truncate text-center" title={getValue() || ""}>{getValue() || "—"}</span>;
      },
      meta: { label: "Note", headClassName: centeredCell, cellClassName: centeredCell }
    },
    {
      id: "actions",
      header: "Manage",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row, table }) => {
        const { draft, editing, permissions, onPatchRecord, onSetEditing, onDeleteRecord } = table.options.meta;
        return isEditing(row.original, editing) ? (
          <div className="flex justify-center gap-2">
            <Button size="sm" onClick={() => onPatchRecord(row.original.id, draft)}>Save</Button>
            <Button variant="outline" size="sm" onClick={() => onSetEditing(null)}>Cancel</Button>
          </div>
        ) : (
          <div className="flex justify-center gap-2">
            {permissions.canUseSupplier && <Button variant="outline" size="sm" onClick={() => onSetEditing({ scope: "supplier", id: row.original.id })}>Edit</Button>}
            {permissions.canDeleteSupplierRows && <Button variant="destructive" size="sm" onClick={() => onDeleteRecord(row.original)}>Delete</Button>}
          </div>
        );
      },
      meta: { headClassName: "w-40 text-center table-sticky-actions-head", cellClassName: "text-center table-sticky-actions" }
    }
  ], []);

  const table = useReactTable({
    data: records,
    columns,
    state: { sorting, pagination, columnVisibility },
    meta: {
      draft,
      setDraft,
      editing,
      services,
      armorTypes,
      permissions,
      onPatchRecord,
      onDeleteRecord,
      onSetEditing
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnVisibilityChange: setColumnVisibility,
    getRowId: (row) => String(row.id),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  });

  return (
    <DataTable
      table={table}
      emptyMessage="No sales match the current filters."
      tableClassName="min-w-[74rem]"
      getRowClassName={(row) => cn(
        !row.original.correct && "status-row-review",
        isEditing(row.original, editing) && "status-row-editing"
      )}
    />
  );
}

function isEditing(record, editing) {
  return editing?.scope === "supplier" && editing.id === record.id;
}
