import React from "react";
import { TableCell, TableRow } from "@/components/ui/table.jsx";

export function EmptyState({ colSpan, children }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="h-28 whitespace-normal p-0">
        <div className="data-table-empty-message" role="status">
          {children}
        </div>
      </TableCell>
    </TableRow>
  );
}
