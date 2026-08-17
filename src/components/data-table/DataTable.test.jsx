import React, { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { DataTable } from "./DataTable.jsx";
import { DataTableColumnHeader } from "./DataTableColumnHeader.jsx";

const records = Array.from({ length: 30 }, (_, index) => ({ id: index + 1, name: `Record ${String(index + 1).padStart(2, "0")}` }));

function ExampleTable() {
  const [sorting, setSorting] = useState([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  const table = useReactTable({
    data: records,
    columns: [{
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />
    }],
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getRowId: (row) => String(row.id),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  });
  return <DataTable table={table} emptyMessage="No records" />;
}

describe("DataTable", () => {
  it("paginates without losing stable record identity", async () => {
    const user = userEvent.setup();
    render(<ExampleTable />);
    expect(screen.getByText("Record 01")).toBeInTheDocument();
    expect(screen.queryByText("Record 26")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Record 26")).toBeInTheDocument();
  });

  it("exposes sort direction through the column header label", async () => {
    const user = userEvent.setup();
    render(<ExampleTable />);
    const sortButton = screen.getByRole("button", { name: /Sort Name; currently not sorted/i });
    await user.click(sortButton);
    expect(screen.getByRole("button", { name: /Sort Name; currently ascending/i })).toBeInTheDocument();
  });
});
