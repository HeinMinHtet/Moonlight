import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TableDateCell } from "./TableDateCell.jsx";

describe("TableDateCell", () => {
  it("renders only date when createdAt is not provided", () => {
    render(<TableDateCell date="2026-08-20" />);
    expect(screen.getByText(/2026|8\/20\/2026/)).toBeInTheDocument();
  });

  it("renders date and inserted time in Thailand time (ICT, UTC+7) when createdAt is provided", () => {
    // 02:15 UTC -> 09:15 ICT
    render(<TableDateCell date="2026-08-20" createdAt="2026-08-20T02:15:00.000Z" />);
    expect(screen.getByText(/2026|8\/20\/2026/)).toBeInTheDocument();
    expect(screen.getByText("09:15")).toBeInTheDocument();
  });

  it("renders tooltip with full Thailand datetime", () => {
    const { container } = render(<TableDateCell date="2026-08-20" createdAt="2026-08-20T02:15:30.000Z" />);
    const cellWrapper = container.firstChild;
    expect(cellWrapper).toHaveAttribute("title", expect.stringContaining("09:15:30"));
    expect(cellWrapper).toHaveAttribute("title", expect.stringContaining("Thailand Time"));
  });
});
