import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import { NativeSelect } from "@/components/ui/native-select.jsx";

export function DataTablePagination({ table }) {
  const totalRows = table.getFilteredRowModel().rows.length;
  if (totalRows <= 25) return null;

  return (
    <div className="data-table-pagination">
      <div className="flex items-center gap-2">
        <span className="data-table-pagination-copy">Rows per page</span>
        <NativeSelect
          className="h-8 w-20"
          value={String(table.getState().pagination.pageSize)}
          onChange={(event) => table.setPageSize(Number(event.target.value))}
          aria-label="Rows per page"
        >
          {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
        </NativeSelect>
      </div>
      <div className="flex items-center gap-2">
        <span className="data-table-pagination-copy">Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}</span>
        <Button variant="outline" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
