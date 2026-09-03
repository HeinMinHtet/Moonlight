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
import { TableDateCell } from "../TableDateCell.jsx";
import { money } from "../../utils/format.js";

const EXPENSE_CATEGORIES = [
  "Raid payment",
  "M+ outsource payment",
  "Other"
];

const centeredHeader = "mx-auto justify-center text-center";
const centeredCell = "text-center";
const numericCell = "text-center font-mono tabular-nums";
const actionCell = "text-center";

export function ExpenseRecordsTable({
  expenses = [],
  editing = null,
  onSetEditing,
  onPatchExpense,
  onDeleteExpense,
  emptyMessage = "No external expenses recorded yet."
}) {
  const [sorting, setSorting] = useState([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  const [columnVisibility, setColumnVisibility] = useState({});
  const [draft, setDraft] = useState({});
  const editingKey = editing?.scope === "externalExpense" ? String(editing.id) : "";

  useEffect(() => {
    const item = expenses.find((e) => String(e.id) === editingKey);
    if (!item) return;
    setDraft({
      date: item.date || "",
      category: item.category || "Raid payment",
      title: item.title || "",
      amount: item.amount ?? "",
      recipient: item.recipient || "",
      note: item.note || ""
    });
  }, [editingKey, expenses]);

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
          <TableDateCell date={getValue()} createdAt={row.original.createdAt} />
        );
      },
      meta: { label: "Date", headClassName: "w-36 text-center", cellClassName: "w-36 text-center" }
    },
    {
      accessorKey: "category",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Category" className={centeredHeader} />,
      cell: ({ row, getValue, table }) => {
        const { draft, setDraft, editing } = table.options.meta;
        const val = getValue();
        if (isEditing(row.original, editing)) {
          return (
            <NativeSelect
              className="table-edit-field mx-auto w-40 text-center"
              value={draft.category || "Raid payment"}
              onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
            >
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </NativeSelect>
          );
        }

        const isRaid = String(val).toLowerCase().includes("raid");
        const isOutsource = String(val).toLowerCase().includes("outsource") || String(val).toLowerCase().includes("m+");

        return (
          <div className="flex justify-center">
            <Badge
              variant="outline"
              className={cn(
                "font-semibold text-[11px] px-2 py-0.5",
                isRaid && "bg-purple-500/15 text-purple-300 border-purple-500/40",
                isOutsource && "bg-sky-500/15 text-sky-300 border-sky-500/40",
                !isRaid && !isOutsource && "bg-slate-500/15 text-slate-300 border-slate-500/40"
              )}
            >
              {val}
            </Badge>
          </div>
        );
      },
      meta: { label: "Category", headClassName: "w-44 text-center", cellClassName: centeredCell }
    },
    {
      accessorKey: "title",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Description" className={centeredHeader} />,
      cell: ({ row, getValue, table }) => {
        const { draft, setDraft, editing } = table.options.meta;
        return isEditing(row.original, editing) ? (
          <Input
            className="table-edit-field mx-auto w-48 text-center"
            value={draft.title || ""}
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          />
        ) : (
          <strong className="text-foreground">{getValue()}</strong>
        );
      },
      meta: { label: "Description", headClassName: centeredCell, cellClassName: centeredCell }
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
          <strong className="font-mono tabular-nums text-rose-300">
            {money(getValue())}
          </strong>
        );
      },
      sortingFn: "basic",
      meta: { label: "Amount", headClassName: "w-32 text-center", cellClassName: numericCell }
    },
    {
      accessorKey: "recipient",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Recipient" className={centeredHeader} />,
      cell: ({ row, getValue, table }) => {
        const { draft, setDraft, editing } = table.options.meta;
        return isEditing(row.original, editing) ? (
          <Input
            className="table-edit-field mx-auto w-36 text-center"
            value={draft.recipient || ""}
            onChange={(event) => setDraft((current) => ({ ...current, recipient: event.target.value }))}
          />
        ) : (
          <span className="text-muted-foreground">{getValue() || "—"}</span>
        );
      },
      meta: { label: "Recipient", headClassName: centeredCell, cellClassName: centeredCell }
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
      id: "actions",
      header: "Manage",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row, table }) => {
        const { draft, editing, onPatchExpense, onSetEditing, onDeleteExpense } = table.options.meta;

        return isEditing(row.original, editing) ? (
          <div className="flex justify-center gap-2">
            <Button size="sm" onClick={() => onPatchExpense(row.original.id, draft)}>Save</Button>
            <Button variant="outline" size="sm" onClick={() => onSetEditing(null)}>Cancel</Button>
          </div>
        ) : (
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onSetEditing({ scope: "externalExpense", id: row.original.id })}>
              Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={() => onDeleteExpense(row.original)}>
              Delete
            </Button>
          </div>
        );
      },
      meta: { headClassName: "w-36 text-center", cellClassName: actionCell }
    }
  ], []);

  const table = useReactTable({
    data: expenses,
    columns,
    state: { sorting, pagination, columnVisibility },
    meta: {
      draft,
      setDraft,
      editing,
      onPatchExpense,
      onDeleteExpense,
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
      emptyMessage={emptyMessage}
      tableClassName="min-w-[64rem]"
      getRowClassName={(row) => cn(
        isEditing(row.original, editing) && "status-row-editing"
      )}
    />
  );
}

function isEditing(expense, editing) {
  return editing?.scope === "externalExpense" && editing.id === expense.id;
}
