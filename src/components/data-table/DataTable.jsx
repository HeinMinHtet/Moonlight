import React from "react";
import { flexRender } from "@tanstack/react-table";
import { EmptyState } from "@/components/EmptyState.jsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table.jsx";
import { cn } from "@/lib/utils.js";
import { DataTablePagination } from "./DataTablePagination.jsx";
import { DataTableToolbar } from "./DataTableToolbar.jsx";

export function DataTable({
  table,
  emptyMessage,
  selectedCount = 0,
  toolbar,
  className,
  tableClassName,
  getRowClassName
}) {
  const rows = table.getRowModel().rows;

  return (
    <div className={cn("data-table-shell", className)}>
      <DataTableToolbar table={table} selectedCount={selectedCount}>{toolbar}</DataTableToolbar>
      <div className="data-table-scroll">
        <Table className={cn("min-w-[64rem]", tableClassName)}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan} className={header.column.columnDef.meta?.headClassName}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {!rows.length && <EmptyState colSpan={table.getVisibleLeafColumns().length}>{emptyMessage}</EmptyState>}
            {rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className={getRowClassName?.(row)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className={cell.column.columnDef.meta?.cellClassName}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
