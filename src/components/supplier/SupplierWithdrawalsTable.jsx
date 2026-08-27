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
import { Input } from "@/components/ui/input.jsx";
import { NativeSelect } from "@/components/ui/native-select.jsx";
import { cn } from "@/lib/utils.js";
import { dateOnly, money } from "../../utils/format.js";
import { withCurrent } from "../../utils/options.js";

const centeredHeader = "mx-auto justify-center text-center";
const centeredCell = "text-center";
const numericCell = "text-center font-mono tabular-nums";
const actionCell = "text-center";

export function SupplierWithdrawalsTable({
  withdrawals = [],
  guilds = [],
  editing = null,
  onSetEditing,
  permissions = {},
  onPatchWithdrawal,
  onDeleteWithdrawal
}) {
  const [sorting, setSorting] = useState([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  const [columnVisibility, setColumnVisibility] = useState({});
  const [draft, setDraft] = useState({});
  const editingKey = editing?.scope === "supplierWithdrawal" ? String(editing.id) : "";

  useEffect(() => {
    const item = withdrawals.find((w) => String(w.id) === editingKey);
    if (!item) return;
    setDraft({
      date: item.date || "",
      charName: item.charName || "",
      guild: item.guild || "",
      amount: item.amount ?? "",
      note: item.note || ""
    });
  }, [editingKey, withdrawals]);

  const activeGuildNames = useMemo(
    () => guilds.filter((g) => g.active !== false).map((g) => g.name),
    [guilds]
  );

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
        return isEditing(row.original, editing) ? (
          <Input
            className="table-edit-field mx-auto w-32 text-center"
            type="date"
            value={draft.date || ""}
            onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
          />
        ) : (
          <span className="font-mono tabular-nums">{dateOnly(getValue())}</span>
        );
      },
      meta: { label: "Date", headClassName: "w-36 text-center", cellClassName: "w-36 text-center" }
    },
    {
      accessorKey: "charName",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Character Name" className={centeredHeader} />,
      cell: ({ row, getValue, table }) => {
        const { draft, setDraft, editing } = table.options.meta;
        return isEditing(row.original, editing) ? (
          <Input
            className="table-edit-field mx-auto w-40 text-center"
            value={draft.charName || ""}
            onChange={(event) => setDraft((current) => ({ ...current, charName: event.target.value }))}
          />
        ) : (
          <strong className="text-foreground">{getValue()}</strong>
        );
      },
      meta: { label: "Character Name", headClassName: centeredCell, cellClassName: centeredCell }
    },
    {
      accessorKey: "guild",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Guild" className={centeredHeader} />,
      cell: ({ row, getValue, table }) => {
        const { draft, setDraft, editing, activeGuildNames } = table.options.meta;
        const guildOptions = withCurrent(activeGuildNames.length ? activeGuildNames : ["Main Guild"], row.original.guild);
        return isEditing(row.original, editing) ? (
          <NativeSelect
            className="table-edit-field mx-auto w-36 text-center"
            value={draft.guild || ""}
            onChange={(event) => setDraft((current) => ({ ...current, guild: event.target.value }))}
          >
            {guildOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </NativeSelect>
        ) : (
          <Badge variant="outline" className="font-medium bg-card/60">
            {getValue()}
          </Badge>
        );
      },
      meta: { label: "Guild", headClassName: centeredCell, cellClassName: centeredCell }
    },
    {
      accessorKey: "amount",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" className={centeredHeader} />,
      cell: ({ row, getValue, table }) => {
        const { draft, setDraft, editing } = table.options.meta;
        return isEditing(row.original, editing) ? (
          <Input
            className="table-edit-field mx-auto w-28 text-center font-mono tabular-nums"
            type="number"
            min="0.01"
            step="0.01"
            value={draft.amount ?? ""}
            onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))}
          />
        ) : (
          <strong className="font-mono tabular-nums text-amber-300">
            {money(getValue())}
          </strong>
        );
      },
      sortingFn: "basic",
      meta: { label: "Amount", headClassName: "w-32 text-center", cellClassName: numericCell }
    },
    {
      accessorKey: "note",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Note" className={centeredHeader} />,
      cell: ({ row, getValue, table }) => {
        const { draft, setDraft, editing } = table.options.meta;
        return isEditing(row.original, editing) ? (
          <Input
            className="table-edit-field mx-auto w-48 text-center"
            value={draft.note || ""}
            onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
          />
        ) : (
          <span className="mx-auto block max-w-60 truncate text-center text-muted-foreground" title={getValue() || ""}>
            {getValue() || "—"}
          </span>
        );
      },
      meta: { label: "Note", headClassName: centeredCell, cellClassName: centeredCell }
    },
    {
      accessorKey: "settled",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" className={centeredHeader} />,
      cell: ({ row }) => {
        const isSettled = Boolean(row.original.settled);
        return (
          <div className="flex justify-center">
            {isSettled ? (
              <Badge variant="success" className="font-semibold" title={row.original.settledAt ? `Settled on ${dateOnly(row.original.settledAt)}` : "Settled"}>
                Settled
              </Badge>
            ) : (
              <Badge variant="warning" className="font-semibold" title="Active pre-withdrawal offset against verified unpaid sales">
                Active
              </Badge>
            )}
          </div>
        );
      },
      sortingFn: "basic",
      meta: { label: "Status", headClassName: "w-28 text-center", cellClassName: centeredCell }
    },
    {
      id: "actions",
      header: "Manage",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row, table }) => {
        const { draft, editing, permissions, onPatchWithdrawal, onSetEditing, onDeleteWithdrawal } = table.options.meta;
        const isSettled = Boolean(row.original.settled);

        return isEditing(row.original, editing) ? (
          <div className="flex justify-center gap-2">
            <Button size="sm" onClick={() => onPatchWithdrawal(row.original.id, draft)}>Save</Button>
            <Button variant="outline" size="sm" onClick={() => onSetEditing(null)}>Cancel</Button>
          </div>
        ) : (
          <div className="flex justify-center gap-2">
            {!isSettled && permissions.canUseSupplier && (
              <Button variant="outline" size="sm" onClick={() => onSetEditing({ scope: "supplierWithdrawal", id: row.original.id })}>
                Edit
              </Button>
            )}
            {permissions.canDeleteSupplierRows && (
              <Button variant="destructive" size="sm" onClick={() => onDeleteWithdrawal(row.original)}>
                Delete
              </Button>
            )}
          </div>
        );
      },
      meta: { headClassName: "w-40 text-center", cellClassName: actionCell }
    }
  ], []);

  const table = useReactTable({
    data: withdrawals,
    columns,
    state: { sorting, pagination, columnVisibility },
    meta: {
      draft,
      setDraft,
      editing,
      activeGuildNames,
      permissions,
      onPatchWithdrawal,
      onDeleteWithdrawal,
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
      emptyMessage="No pre-withdrawals recorded yet."
      tableClassName="min-w-[64rem]"
      getRowClassName={(row) => cn(
        !row.original.settled && "status-row-review",
        isEditing(row.original, editing) && "status-row-editing"
      )}
    />
  );
}

function isEditing(withdrawal, editing) {
  return editing?.scope === "supplierWithdrawal" && editing.id === withdrawal.id;
}
