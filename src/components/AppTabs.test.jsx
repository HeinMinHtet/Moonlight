import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppTabs, canOpenTab, hashForTab, tabFromHash } from "./AppTabs.jsx";

describe("AppTabs", () => {
  it("keeps admin-only finance views out of the booster navigation", () => {
    render(<AppTabs activeTab="booster" isAdmin={false} onChange={() => {}} />);

    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(screen.getByRole("tab", { name: "Booster payouts" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: /Income & Expense/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist", { name: /views$/ })).toBeInTheDocument();
  });

  it("shows the five groups in order with Raid notes last and no Raid schedule", () => {
    render(<AppTabs activeTab="booster" isAdmin onChange={() => {}} />);

    const groups = screen.getByRole("tablist", { name: "Workspace views" });
    const labels = Array.from(groups.querySelectorAll("[role=tab]")).map((tab) => tab.textContent);
    expect(labels).toEqual(["Sales", "Booster payouts", "Income & Expense", "Default rates", "Raid notes"]);
    expect(screen.queryByRole("tab", { name: /Raid schedule/ })).not.toBeInTheDocument();
  });

  it("shows sub-views for the active group and reports navigation changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AppTabs activeTab="profit" isAdmin onChange={onChange} />);

    expect(screen.getByRole("tab", { name: "Income & Expense" })).toHaveAttribute("aria-selected", "true");
    const subnav = screen.getByRole("tablist", { name: "Income & Expense views" });
    expect(subnav).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Profit report" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Expenses" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Price calculator" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Price calculator" }));
    expect(onChange).toHaveBeenCalledWith("calculator");

    await user.click(screen.getByRole("tab", { name: "Sales" }));
    expect(onChange).toHaveBeenCalledWith("supplier");
  });

  it("sums sub-view badges onto the group tab", () => {
    render(<AppTabs activeTab="booster" isAdmin onChange={() => {}} badges={{ supplier: 3, booster: 2 }} />);
    expect(screen.getByRole("tab", { name: /Sales/ })).toHaveTextContent("3");
    expect(screen.getByRole("tab", { name: /Booster payouts/ })).toHaveTextContent("2");
  });

  it("uses a wrapping navigation grid instead of a viewport-wide strip", () => {
    render(<AppTabs activeTab="supplier" isAdmin onChange={() => {}} />);

    const tabList = screen.getByRole("tablist", { name: "Workspace views" });
    expect(tabList).toHaveClass("ledger-navigation-list");
    expect(tabList).not.toHaveClass("min-w-max", "overflow-x-auto");
  });
});

describe("tab routes", () => {
  it("round-trips every tab through the URL hash", () => {
    for (const tab of ["supplier", "supplierHistory", "booster", "expenses", "profit", "calculator", "prices", "notes"]) {
      expect(tabFromHash(hashForTab(tab))).toBe(tab);
    }
    expect(hashForTab("supplierHistory")).toBe("#/sales/paid");
  });

  it("ignores unknown or removed routes", () => {
    expect(tabFromHash("#/schedule")).toBeNull();
    expect(tabFromHash("")).toBeNull();
  });

  it("only lets boosters open the booster view", () => {
    expect(canOpenTab("booster", false)).toBe(true);
    expect(canOpenTab("profit", false)).toBe(false);
    expect(canOpenTab("profit", true)).toBe(true);
    expect(canOpenTab("schedule", true)).toBe(false);
  });
});
