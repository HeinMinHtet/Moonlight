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

const centeredHeader = "mx-auto justify-center text-center";
const centeredCell = "text-center";
const numericCell = "text-center font-mono tabular-nums";
const actionCell = "text-center";

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
        <div className="flex min-h-11 items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))}
            aria-label={`Select payout for ${row.original.boosterName}`}
          />
        </div>
      ) : <span className="text-muted-foreground">—</span>
    }] : []),
    {
      accessorKey: "createdAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" className={centeredHeader} />,
      cell: ({ row, getValue, table }) => {
        const { draft, setDraft, editing } = table.options.meta;
        return isEditing(row.original, editing)
          ? <Input className="table-edit-field mx-auto w-32 text-center" type="date" value={draft.createdAt || ""} onChange={(event) => setDraft((current) => ({ ...current, createdAt: event.target.value }))} />
          : <span className="font-mono tabular-nums">{dateOnly(getValue())}</span>;
      },
      meta: { label: "Date", headClassName: "w-36 text-center", cellClassName: "w-36 text-center" }
    },
    ...(isAdmin ? [{
      accessorKey: "boosterName",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Booster" className={centeredHeader} />,
      meta: { label: "Booster", headClassName: centeredCell, cellClassName: centeredCell }
    }] : []),
    {
      accessorKey: "level",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Key level" className={centeredHeader} />,
      cell: ({ row, getValue, table }) => {
        const { draft, setDraft, editing, prices } = table.options.meta;
        return isEditing(row.original, editing) ? (
          <NativeSelect className="table-edit-field mx-auto w-32 text-center" value={draft.level || ""} onChange={(event) => setDraft((current) => ({ ...current, level: event.target.value }))}>
            {withCurrent(prices.map((price) => price.level), row.original.level).map((value) => <option key={value} value={value}>{value}</option>)}
          </NativeSelect>
        ) : getValue();
      },
      meta: { label: "Key level", headClassName: centeredCell, cellClassName: centeredCell }
    },
    {
      accessorKey: "quantity",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Runs" className={centeredHeader} />,
      cell: ({ row, getValue, table }) => {
        const { draft, setDraft, editing } = table.options.meta;
        return isEditing(row.original, editing)
          ? <Input className="table-edit-field mx-auto w-24 text-center font-mono tabular-nums" type="number" min="1" step="1" value={draft.quantity ?? 1} onChange={(event) => setDraft((current) => ({ ...current, quantity: event.target.value }))} />
          : <span className="font-mono tabular-nums">{getValue()}</span>;
      },
      sortingFn: "basic",
      meta: { label: "Runs", headClassName: "w-24 text-center", cellClassName: numericCell }
    },
    {
      accessorKey: "rateAtRecord",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Saved rate" className={centeredHeader} />,
      cell: ({ row, getValue, table }) => {
        const { draft, setDraft, editing, isAdmin: isTableAdmin } = table.options.meta;
        return isEditing(row.original, editing) && isTableAdmin
          ? <Input className="table-edit-field mx-auto w-28 text-center font-mono tabular-nums" type="number" min="0" step="0.01" value={draft.rateAtRecord ?? 0} onChange={(event) => setDraft((current) => ({ ...current, rateAtRecord: event.target.value }))} />
          : <span className="font-mono tabular-nums">{money(getValue())}</span>;
      },
      sortingFn: "basic",
      meta: { label: "Saved rate", headClassName: "w-32 text-center", cellClassName: numericCell }
    },
    {
      accessorKey: "totalBalance",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Payout" className={centeredHeader} />,
      cell: ({ getValue }) => <strong className="font-mono tabular-nums">{money(getValue())}</strong>,
      sortingFn: "basic",
      meta: { label: "Payout", headClassName: "w-36 text-center", cellClassName: numericCell }
    },
    {
      id: "status",
      accessorFn: (record) => record.paid ? "paid" : needsReview(record) ? "review" : "open",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" className={centeredHeader} />,
      cell: ({ row }) => <PaymentBadge record={row.original} />,
      meta: { label: "Status", headClassName: "w-28 text-center", cellClassName: "w-28 text-center" }
    },
    {
      accessorKey: "paidAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Paid date" className={centeredHeader} />,
      cell: ({ getValue }) => getValue() ? <span className="font-mono tabular-nums">{dateOnly(getValue())}</span> : "—",
      meta: { label: "Paid date", headClassName: "w-36 text-center", cellClassName: "w-36 text-center" }
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
        const { draft, editing, isAdmin: isTableAdmin, permissions: tablePerms, user: tableUser, onPatchRecord: patchFn, onSetEditing: setEditFn, onDeleteRecord: deleteFn } = table.options.meta;
        const canManageOwnOpenRow = tablePerms.canDeleteBoosterRows && (isTableAdmin || (!row.original.paid && row.original.discordId === tableUser?.discordId));
        if (isEditing(row.original, editing)) {
          return (
            <div className="flex justify-center gap-2">
              <Button size="sm" onClick={() => patchFn(row.original.id, isTableAdmin ? draft : withoutKey(draft, "rateAtRecord"))}>Save changes</Button>
              <Button variant="outline" size="sm" onClick={() => setEditFn(null)}>Cancel</Button>
            </div>
          );
        }
        return (
          <div className="flex justify-center gap-2">
            {canManageOwnOpenRow && <Button variant="outline" size="sm" onClick={() => setEditFn({ scope: "booster", id: row.original.id })}>Edit</Button>}
            {canManageOwnOpenRow && <Button variant="destructive" size="sm" onClick={() => deleteFn(row.original)}>Delete</Button>}
          </div>
        );
      },
      meta: { headClassName: "w-44 text-center", cellClassName: actionCell }
    }
  ], [isAdmin]);

  const table = useReactTable({
    data: records,
    columns,
    state: { sorting, pagination, columnVisibility, rowSelection },
    meta: {
      draft,
      setDraft,
      editing,
      isAdmin,
      permissions,
      prices,
      user,
      onPatchRecord,
      onDeleteRecord,
      onSetEditing
    },
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
    <div className="flex min-h-11 items-center justify-center">
      <Checkbox
        checked={allSelected ? true : someSelected ? "indeterminate" : false}
        disabled={!rows.length}
        onCheckedChange={(checked) => rows.forEach((row) => row.toggleSelected(Boolean(checked)))}
        aria-label="Select open booster payouts on this page"
      />
    </div>
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
