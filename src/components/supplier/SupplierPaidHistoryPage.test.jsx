import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SupplierPaidHistoryPage } from "./SupplierPaidHistoryPage.jsx";
import { money } from "../../utils/format.js";

const samplePaidRecords = [
  {
    id: "rec-1",
    paymentBatchId: "batch-1",
    paidAt: "2026-08-20T10:00:00Z",
    paidByName: "AdminAlpha",
    paidByDiscordId: "admin-1",
    date: "2026-08-19",
    buyerName: "BuyerOne",
    serviceType: "Mythic+",
    quantity: 1,
    rateAtRecord: 100,
    totalCost: 100,
    armorType: "Cloth",
    note: "Clean run",
    paid: true,
    correct: true
  },
  {
    id: "rec-2",
    paymentBatchId: "batch-1",
    paidAt: "2026-08-20T10:00:00Z",
    paidByName: "AdminAlpha",
    paidByDiscordId: "admin-1",
    date: "2026-08-19",
    buyerName: "BuyerTwo",
    serviceType: "Raid",
    quantity: 2,
    rateAtRecord: 100,
    totalCost: 200,
    armorType: "Plate",
    note: "Full clear",
    paid: true,
    correct: true
  },
  {
    id: "rec-3",
    paymentBatchId: "batch-2",
    paidAt: "2026-08-22T14:00:00Z",
    paidByName: "AdminBeta",
    paidByDiscordId: "admin-2",
    date: "2026-08-21",
    buyerName: "BuyerThree",
    serviceType: "Mythic+",
    quantity: 0.5,
    rateAtRecord: 100,
    totalCost: 50,
    armorType: "Leather",
    note: "Partial",
    paid: true,
    correct: true
  }
];

function renderPage(overrides = {}) {
  const props = {
    isAdmin: true,
    loading: false,
    loadError: "",
    records: samplePaidRecords,
    armorTypes: ["Cloth", "Leather", "Mail", "Plate", "No stack"],
    canReopen: true,
    onExportBatch: vi.fn(),
    onReopenBatch: vi.fn(),
    ...overrides
  };
  const result = render(<SupplierPaidHistoryPage {...props} />);
  return { ...result, props };
}

describe("SupplierPaidHistoryPage", () => {
  it("renders paid supplier history with stat cards, armor options, and all records", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Paid supplier history" })).toBeInTheDocument();
    expect(screen.getByText("3 paid records")).toBeInTheDocument();

    // Check stat cards in the batch bar
    const statsBar = screen.getByLabelText("Filtered paid supplier totals");
    expect(within(statsBar).getByText("Total sales")).toBeInTheDocument();
    expect(within(statsBar).getByText(money(350))).toBeInTheDocument();
    expect(within(statsBar).getByText("3.5 items sold")).toBeInTheDocument();
    expect(within(statsBar).getByText("Items sold")).toBeInTheDocument();
    expect(within(statsBar).getByText("Payment batches")).toBeInTheDocument();
    expect(within(statsBar).getByText("Sales records")).toBeInTheDocument();
    expect(within(statsBar).getByText("Paid by")).toBeInTheDocument();

    // Check armor stack filter options
    const armorSelect = screen.getByRole("combobox", { name: /armor stack/i });
    expect(armorSelect).toBeInTheDocument();
    expect(armorSelect).toHaveValue("all");
    expect(screen.getByRole("option", { name: "All armor stacks" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Cloth" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Plate" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Leather" })).toBeInTheDocument();
  });

  it("filters records by armor stack and recalculates total sales and items sold", async () => {
    const user = userEvent.setup();
    renderPage();

    const armorSelect = screen.getByRole("combobox", { name: /armor stack/i });
    await user.selectOptions(armorSelect, "Plate");

    // Total sales should now only be for the Plate record (200)
    const statsBar = screen.getByLabelText("Filtered paid supplier totals");
    expect(within(statsBar).getByText(money(200))).toBeInTheDocument();
    expect(within(statsBar).getByText("2 items sold")).toBeInTheDocument();

    // Batch and records
    expect(screen.getByText("BuyerTwo")).toBeInTheDocument();
    expect(screen.queryByText("BuyerOne")).not.toBeInTheDocument();
    expect(screen.queryByText("BuyerThree")).not.toBeInTheDocument();
  });

  it("displays the filtered items sales lookup breakdown table", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText(/filtered items sales lookup/i)).toBeInTheDocument();

    // Filter by Mythic+ to check multi-record aggregation
    const serviceSelect = screen.getByRole("combobox", { name: /service/i });
    await user.selectOptions(serviceSelect, "Mythic+");

    const statsBar = screen.getByLabelText("Filtered paid supplier totals");
    expect(within(statsBar).getByText(money(150))).toBeInTheDocument();
    expect(within(statsBar).getByText("1.5 items sold")).toBeInTheDocument();

    const summarySection = screen.getByText(/filtered items sales lookup/i).closest("details");
    expect(within(summarySection).getByText("Cloth")).toBeInTheDocument();
    expect(within(summarySection).getByText("Leather")).toBeInTheDocument();
  });

  it("clears filters when the Clear filters button is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    const armorSelect = screen.getByRole("combobox", { name: /armor stack/i });
    await user.selectOptions(armorSelect, "Cloth");

    const statsBar = screen.getByLabelText("Filtered paid supplier totals");
    expect(within(statsBar).getByText(money(100))).toBeInTheDocument();
    expect(within(statsBar).getByText("1 item sold")).toBeInTheDocument();

    const clearButton = screen.getByRole("button", { name: /clear filters/i });
    expect(clearButton).toBeEnabled();
    await user.click(clearButton);

    expect(within(statsBar).getByText(money(350))).toBeInTheDocument();
    expect(within(statsBar).getByText("3.5 items sold")).toBeInTheDocument();
    expect(armorSelect).toHaveValue("all");
  });

  it("shows empty state when no records match filter", async () => {
    const user = userEvent.setup();
    renderPage();

    const buyerInput = screen.getByPlaceholderText("Search buyer...");
    await user.type(buyerInput, "NonExistentBuyer");

    expect(screen.getByText("No matching paid records")).toBeInTheDocument();
  });
});
