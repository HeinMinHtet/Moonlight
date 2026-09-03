import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppTabs } from "./AppTabs.jsx";

describe("AppTabs", () => {
  it("keeps admin-only finance views out of the booster navigation", () => {
    render(<AppTabs activeTab="booster" isAdmin={false} onChange={() => {}} />);

    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(screen.getByRole("tab", { name: "Booster payouts" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: "Profit report" })).not.toBeInTheDocument();
  });

  it("exposes all admin views and reports navigation changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AppTabs activeTab="supplier" isAdmin onChange={onChange} />);

    expect(screen.getAllByRole("tab")).toHaveLength(7);
    expect(screen.getByRole("tab", { name: "Expenses" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Price calculator" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Paid history" }));
    expect(onChange).toHaveBeenCalledWith("supplierHistory");
  });

  it("uses a wrapping navigation grid instead of a viewport-wide strip", () => {
    render(<AppTabs activeTab="supplier" isAdmin onChange={() => {}} />);

    const tabList = screen.getByRole("tablist", { name: "Workspace views" });
    expect(tabList).toHaveClass("ledger-navigation-list");
    expect(tabList).not.toHaveClass("min-w-max", "overflow-x-auto");
    for (const tab of screen.getAllByRole("tab")) expect(tab).toHaveClass("ledger-navigation-item");
  });
});
