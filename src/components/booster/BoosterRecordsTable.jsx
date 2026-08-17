import React, { useEffect, useMemo, useState } from "react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable.jsx";
import { DataTableColumnHeader } from "@/components/data-table/DataTableColumnHeader.jsx";
import { syncRowSelection } from "@/components/data-table/selection.js";
import { Badge } from "@/components/ui/badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Checkbox } from "@/components/ui/checkbox.jsx";
import { Input } from "@/components/ui/input.jsx";
import { NativeSelect } from "@/components/ui/native-select.jsx";
import { cn } from "@/lib/utils.js";
import { dateOnly, money } from "../../utils/format.js";
import { withCurrent, withoutKey } from "../../utils/options.js";

export function BoosterRecordsTable({
  records,
  prices,
  user,
  isAdmin,
  permissions,
  editing,
  selectedIds,
  emptyMessage,
  onSetEditing,
  onPatchRecord,
  onDeleteRecord,
  onToggleRow
}) {
  const [sorting, setSorting] = useState([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  const [columnVisibility, setColumnVisibility] = useState({});
  const [draft, setDraft] = useState({});
  const editingKey = editing?.scope === "booster" ? String(editing.id) : "";

  useEffect(() => {
    const record = records.find((item) => String(item.id) === editingKey);
    if (!record) return;
    setDraft({
      createdAt: String(record.createdAt || "").slice(0, 10),
      level: record.level || "",
      quantity: record.quantity ?? 1,
      rateAtRecord: record.rateAtRecord ?? 0,
      note: record.note || ""
    });
  }, [editingKey]);

  const rowSelection = useMemo(
    () => Object.fromEntries([...selectedIds].map((id) => [String(id), true])),
    [selectedIds]
  );

  const columns = useMemo(() => [
    ...(isAdmin ? [{
      id: "select",
      enableSorting: false,
      enableHiding: false,
      meta: { headClassName: "w-16 text-center", cellClassName: "w-16 text-center" },
      header: ({ table }) => <BoosterPageSelection table={table} />,
      cell: ({ row }) => row.getCanSelect() ? (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))}
          aria-label={`Select payout for ${row.original.boosterName}`}
        />
      ) : <span className="text-muted-foreground">—</span>
    }] : []),
    {
      accessorKey: "createdAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      cell: ({ row, getValue }) => isEditing(row.original, editing)
        ? <Input className="table-edit-field w-32" type="date" value={draft.createdAt || ""} onChange={(event) => setDraft((current) => ({ ...current, createdAt: event.target.value }))} />
        : dateOnly(getValue()),
      meta: { label: "Date" }
    },
    ...(isAdmin ? [{
      accessorKey: "boosterName",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Booster" />,
      meta: { label: "Booster" }
    }] : []),
    {
      accessorKey: "level",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Key level" />,
      cell: ({ row, getValue }) => isEditing(row.original, editing) ? (
        <NativeSelect className="table-edit-field w-32" value={draft.level || ""} onChange={(event) => setDraft((current) => ({ ...current, level: event.target.value }))}>
          {withCurrent(prices.map((price) => price.level), row.original.level).map((value) => <option key={value} value={value}>{value}</option>)}
        </NativeSelect>
      ) : getValue(),
      meta: { label: "Key level" }
    },
    {
      accessorKey: "quantity",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Runs" />,
      cell: ({ row, getValue }) => isEditing(row.original, editing)
        ? <Input className="table-edit-field w-24" type="number" min="1" step="1" value={draft.quantity ?? 1} onChange={(event) => setDraft((current) => ({ ...current, quantity: event.target.value }))} />
        : getValue(),
      sortingFn: "basic",
      meta: { label: "Runs" }
    },
    {
      accessorKey: "rateAtRecord",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Saved rate" />,
      cell: ({ row, getValue }) => isEditing(row.original, editing) && isAdmin
        ? <Input className="table-edit-field w-28" type="number" min="0" step="0.01" value={draft.rateAtRecord ?? 0} onChange={(event) => setDraft((current) => ({ ...current, rateAtRecord: event.target.value }))} />
        : money(getValue()),
      sortingFn: "basic",
      meta: { label: "Saved rate" }
    },
    {
      accessorKey: "totalBalance",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Payout" />,
      cell: ({ getValue }) => <strong>{money(getValue())}</strong>,
      sortingFn: "basic",
      meta: { label: "Payout" }
    },
    {
      id: "status",
      accessorFn: (record) => record.paid ? "paid" : needsReview(record) ? "review" : "open",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => <PaymentBadge record={row.original} />,
      meta: { label: "Status" }
    },
    {
      accessorKey: "paidAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Paid date" />,
      cell: ({ getValue }) => getValue() ? dateOnly(getValue()) : "—",
      meta: { label: "Paid date" }
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
      cell: ({ row }) => {
        const canManageOwnOpenRow = permissions.canDeleteBoosterRows && (isAdmin || (!row.original.paid && row.original.discordId === user?.discordId));
        if (isEditing(row.original, editing)) {
          return (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => onPatchRecord(row.original.id, isAdmin ? draft : withoutKey(draft, "rateAtRecord"))}>Save changes</Button>
              <Button variant="outline" size="sm" onClick={() => onSetEditing(null)}>Cancel</Button>
            </div>
          );
        }
        return (
          <div className="flex gap-2">
            {canManageOwnOpenRow && <Button variant="outline" size="sm" onClick={() => onSetEditing({ scope: "booster", id: row.original.id })}>Edit</Button>}
            {canManageOwnOpenRow && <Button variant="destructive" size="sm" onClick={() => onDeleteRecord(row.original)}>Delete</Button>}
          </div>
        );
      }
    }
  ], [draft, editing, isAdmin, onDeleteRecord, onPatchRecord, onSetEditing, permissions, prices, user]);

  const table = useReactTable({
    data: records,
    columns,
    state: { sorting, pagination, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: (updater) => {
      const next = typeof updater === "function" ? updater(rowSelection) : updater;
      syncRowSelection(records, selectedIds, next, onToggleRow);
    },
    getRowId: (row) => String(row.id),
    enableRowSelection: (row) => Boolean(isAdmin && !row.original.paid),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  });

  return (
    <DataTable
      table={table}
      selectedCount={selectedIds.size}
      emptyMessage={permissions.canUseBooster ? emptyMessage : "Sign in with Discord to view payout records."}
      tableClassName={isAdmin ? "min-w-[70rem]" : "min-w-[58rem]"}
      getRowClassName={(row) => cn(
        row.original.paid ? "status-row-paid" : needsReview(row.original) && "status-row-review",
        row.getIsSelected() && "status-row-selected",
        isEditing(row.original, editing) && "status-row-editing"
      )}
    />
  );
}

function BoosterPageSelection({ table }) {
  const rows = table.getRowModel().rows.filter((row) => row.getCanSelect());
  const allSelected = rows.length > 0 && rows.every((row) => row.getIsSelected());
  const someSelected = rows.some((row) => row.getIsSelected());
  return (
    <Checkbox
      checked={allSelected ? true : someSelected ? "indeterminate" : false}
      disabled={!rows.length}
      onCheckedChange={(checked) => rows.forEach((row) => row.toggleSelected(Boolean(checked)))}
      aria-label="Select open booster payouts on this page"
    />
  );
}

function PaymentBadge({ record }) {
  if (record.paid) return <Badge variant="success">Paid</Badge>;
  if (needsReview(record)) return <Badge variant="warning">Review</Badge>;
  return <Badge variant="info">Open</Badge>;
}

function needsReview(record) {
  return !String(record.note || "").trim() || Number(record.totalBalance || 0) <= 0 || Number(record.quantity || 0) > 20;
}

function isEditing(record, editing) {
  return editing?.scope === "booster" && editing.id === record.id;
}
