import React from "react";
import { DataTableViewOptions } from "./DataTableViewOptions.jsx";

export function DataTableToolbar({ table, selectedCount = 0, children }) {
  return (
    <div className="data-table-toolbar">
      <p className="data-table-toolbar-copy" aria-live="polite">
        {selectedCount > 0 ? `${selectedCount} payout row${selectedCount === 1 ? "" : "s"} selected` : `${table.getFilteredRowModel().rows.length} record${table.getFilteredRowModel().rows.length === 1 ? "" : "s"}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
