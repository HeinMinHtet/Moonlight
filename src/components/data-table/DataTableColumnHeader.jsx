import React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import { cn } from "@/lib/utils.js";

export function DataTableColumnHeader({ column, title, className }) {
  if (!column.getCanSort()) return <span className={className}>{title}</span>;
  const direction = column.getIsSorted();
  const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ChevronsUpDown;
  const directionText = direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "not sorted";

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("data-table-header-button", className)}
      onClick={column.getToggleSortingHandler()}
      aria-label={`Sort ${title}; currently ${directionText}`}
    >
      {title}
      <Icon className="size-3.5" aria-hidden="true" />
    </Button>
  );
}
