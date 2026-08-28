import React, { useMemo, useState } from "react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable.jsx";
import { DataTableColumnHeader } from "@/components/data-table/DataTableColumnHeader.jsx";
import { TableDateCell } from "../TableDateCell.jsx";
import { dateOnly, money } from "../../utils/format.js";

export function SupplierHistoryRecordsTable({ records }) {
  const [sorting, setSorting] = useState([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  const [columnVisibility, setColumnVisibility] = useState({});
  const columns = useMemo(() => [
    {
      accessorKey: "date",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Sale date" />,
      cell: ({ row, getValue }) => <TableDateCell date={getValue()} createdAt={row.original.createdAt} />,
      meta: { label: "Sale date" }
    },
    {
      accessorKey: "buyerName",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Buyer" />,
      meta: { label: "Buyer" }
    },
    {
      accessorKey: "serviceType",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Service" />,
      meta: { label: "Service" }
    },
    {
      accessorKey: "quantity",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Qty" />,
      sortingFn: "basic",
      meta: { label: "Quantity" }
    },
    {
      accessorKey: "rateAtRecord",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Saved rate" />,
      cell: ({ getValue }) => money(getValue()),
      sortingFn: "basic",
      meta: { label: "Saved rate" }
    },
    {
      accessorKey: "totalCost",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
      cell: ({ getValue }) => <strong className="font-mono tabular-nums">{money(getValue())}</strong>,
      sortingFn: "basic",
      meta: { label: "Amount" }
    },
    {
      accessorKey: "armorType",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Armor stack" />,
      meta: { label: "Armor stack" }
    },
    {
      accessorKey: "note",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Note" />,
      cell: ({ getValue }) => <span className="block max-w-72 truncate" title={getValue() || ""}>{getValue() || "—"}</span>,
      meta: { label: "Note" }
    }
  ], []);

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
      emptyMessage="This payment batch has no records."
      tableClassName="min-w-[56rem]"
      className="border-x-0 border-b-0"
    />
  );
}
