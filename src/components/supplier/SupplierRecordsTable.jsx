import React, { useEffect, useMemo, useState } from "react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable.jsx";
import { DataTableColumnHeader } from "@/components/data-table/DataTableColumnHeader.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Checkbox } from "@/components/ui/checkbox.jsx";
import { Input } from "@/components/ui/input.jsx";
import { NativeSelect } from "@/components/ui/native-select.jsx";
import { cn } from "@/lib/utils.js";
import { dateOnly, money } from "../../utils/format.js";
import { withCurrent } from "../../utils/options.js";

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
      armorType: record.armorType || "",
      note: record.note || ""
    });
  }, [editingKey]);

  const columns = useMemo(() => [
    {
      id: "rowNumber",
      header: "#",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => row.index + 1,
      meta: { headClassName: "w-12", cellClassName: "w-12 text-muted-foreground" }
    },
    {
      accessorKey: "date",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      cell: ({ row, getValue }) => isEditing(row.original, editing)
        ? <Input className="table-edit-field w-32" type="date" value={draft.date || ""} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} />
        : dateOnly(getValue()),
      meta: { label: "Date" }
    },
    {
      accessorKey: "buyerName",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Buyer" />,
      cell: ({ row, getValue }) => isEditing(row.original, editing)
        ? <Input className="table-edit-field w-40" value={draft.buyerName || ""} onChange={(event) => setDraft((current) => ({ ...current, buyerName: event.target.value }))} />
        : getValue(),
      meta: { label: "Buyer" }
    },
    {
      accessorKey: "serviceType",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Service" />,
      cell: ({ row, getValue }) => isEditing(row.original, editing) ? (
        <NativeSelect className="table-edit-field w-40" value={draft.serviceType || ""} onChange={(event) => setDraft((current) => ({ ...current, serviceType: event.target.value }))}>
          {withCurrent(services.map((service) => service.type), row.original.serviceType).map((value) => <option key={value} value={value}>{value}</option>)}
        </NativeSelect>
      ) : getValue(),
      meta: { label: "Service" }
    },
    {
      accessorKey: "quantity",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Qty" />,
      cell: ({ row, getValue }) => isEditing(row.original, editing)
        ? <Input className="table-edit-field w-24" type="number" min="0" step="0.1" value={draft.quantity ?? 1} onChange={(event) => setDraft((current) => ({ ...current, quantity: event.target.value }))} />
        : getValue(),
      meta: { label: "Quantity" }
    },
    {
      accessorKey: "rateAtRecord",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Saved rate" />,
      cell: ({ row, getValue }) => isEditing(row.original, editing)
        ? <Input className="table-edit-field w-28" type="number" min="0" step="0.01" value={draft.rateAtRecord ?? 0} onChange={(event) => setDraft((current) => ({ ...current, rateAtRecord: event.target.value }))} />
        : money(getValue()),
      sortingFn: "basic",
      meta: { label: "Saved rate" }
    },
    {
      accessorKey: "armorType",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Armor stack" />,
      cell: ({ row, getValue }) => isEditing(row.original, editing) ? (
        <NativeSelect className="table-edit-field w-36" value={draft.armorType || ""} onChange={(event) => setDraft((current) => ({ ...current, armorType: event.target.value }))}>
          {withCurrent(armorTypes, row.original.armorType).map((value) => <option key={value} value={value}>{value}</option>)}
        </NativeSelect>
      ) : getValue(),
      meta: { label: "Armor stack" }
    },
    {
      accessorKey: "correct",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Verified" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {permissions.canEditSupplierStatus && (
            <Checkbox
              checked={Boolean(row.original.correct)}
              onCheckedChange={(checked) => onPatchRecord(row.original.id, { correct: Boolean(checked) })}
              aria-label={`Mark ${row.original.buyerName || row.original.serviceType} verified`}
            />
          )}
          <Badge variant={row.original.correct ? "success" : "warning"}>{row.original.correct ? "Verified" : "Review"}</Badge>
        </div>
      ),
      sortingFn: "basic",
      meta: { label: "Verified" }
    },
    {
      accessorKey: "totalCost",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
      cell: ({ getValue }) => <strong>{money(getValue())}</strong>,
      sortingFn: "basic",
      meta: { label: "Amount" }
    },
    {
      accessorKey: "note",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Note" />,
      cell: ({ row, getValue }) => isEditing(row.original, editing)
        ? <Input className="table-edit-field w-48" value={draft.note || ""} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} />
        : <span className="block max-w-60 truncate" title={getValue() || ""}>{getValue() || "—"}</span>,
      meta: { label: "Note" }
    },
    {
      id: "actions",
      header: "Manage",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => isEditing(row.original, editing) ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onPatchRecord(row.original.id, draft)}>Save</Button>
          <Button variant="outline" size="sm" onClick={() => onSetEditing(null)}>Cancel</Button>
        </div>
      ) : (
        <div className="flex gap-2">
          {permissions.canUseSupplier && <Button variant="outline" size="sm" onClick={() => onSetEditing({ scope: "supplier", id: row.original.id })}>Edit</Button>}
          {permissions.canDeleteSupplierRows && <Button variant="destructive" size="sm" onClick={() => onDeleteRecord(row.original)}>Delete</Button>}
        </div>
      )
    }
  ], [armorTypes, draft, editing, onDeleteRecord, onPatchRecord, onSetEditing, permissions, services]);

  const table = useReactTable({
    data: records,
    columns,
    state: { sorting, pagination, columnVisibility },
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
