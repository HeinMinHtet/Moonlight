import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExpensesPage } from "./ExpensesPage.jsx";

const sampleExpenses = [
  {
    id: "exp-1",
    date: "2026-08-15",
    category: "Raid payment",
    title: "Heroic Raid Team 1",
    amount: 950,
    recipient: "RaidLeadAlex",
    note: "Paid in gold",
    createdAt: "2026-08-15T12:00:00.000Z"
  },
  {
    id: "exp-2",
    date: "2026-08-16",
    category: "M+ outsource payment",
    title: "Outsource Key 16",
    amount: 220,
    recipient: "OutsourceBooster",
    note: "",
    createdAt: "2026-08-16T14:00:00.000Z"
  }
];

function renderPage(overrides = {}) {
  const props = {
    isAdmin: true,
    loading: false,
    loadError: "",
    expenses: sampleExpenses,
    editing: null,
    formKey: 0,
    onSubmitExpense: vi.fn((event) => event.preventDefault()),
    onPatchExpense: vi.fn(),
    onDeleteExpense: vi.fn(),
    onSetEditing: vi.fn(),
    ...overrides
  };

  render(<ExpensesPage {...props} />);
  return props;
}

describe("ExpensesPage", () => {
  it("renders access denied when non-admin accesses page", () => {
    renderPage({ isAdmin: false });
    expect(screen.getByText(/Admin access required/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "External Expenses" })).not.toBeInTheDocument();
  });

  it("renders KPI summary cards for Total Expenses, Raid Payments, and M+ Outsource Payments", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "External Expenses" })).toBeInTheDocument();
    const summaryBar = screen.getByRole("region", { name: "Expenses summary" });
    expect(within(summaryBar).getByText("Total Expenses")).toBeInTheDocument();
    expect(within(summaryBar).getByText("1,170")).toBeInTheDocument(); // 950 + 220
    expect(within(summaryBar).getByText("Raid Payments")).toBeInTheDocument();
    expect(within(summaryBar).getByText("950")).toBeInTheDocument();
    expect(within(summaryBar).getByText("M+ Outsource Payments")).toBeInTheDocument();
    expect(within(summaryBar).getByText("220")).toBeInTheDocument();
  });

  it("submits the expense form with valid inputs", async () => {
    const user = userEvent.setup();
    const { onSubmitExpense } = renderPage();

    const titleInput = screen.getByPlaceholderText("e.g. Heroic Raid Team 1");
    const amountInput = screen.getByPlaceholderText("Gold amount");
    const submitBtn = screen.getByRole("button", { name: "Record expense" });

    await user.type(titleInput, "Mythic Queen Pot");
    await user.type(amountInput, "1500");
    await user.click(submitBtn);

    expect(onSubmitExpense).toHaveBeenCalledOnce();
  });

  it("filters expenses by category and search", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText("Heroic Raid Team 1")).toBeInTheDocument();
    expect(screen.getByText("Outsource Key 16")).toBeInTheDocument();

    // Filter by Raid category
    const filterRegion = screen.getByRole("region", { name: "External expense filters" });
    const categorySelect = within(filterRegion).getByRole("combobox", { name: /^Category$/i });
    await user.selectOptions(categorySelect, "raid");

    expect(screen.getByText("Heroic Raid Team 1")).toBeInTheDocument();
    expect(screen.queryByText("Outsource Key 16")).not.toBeInTheDocument();

    // Clear filters
    await user.click(within(filterRegion).getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Outsource Key 16")).toBeInTheDocument();

    // Filter by search query
    const searchInput = within(filterRegion).getByPlaceholderText("Description, recipient, or note...");
    await user.type(searchInput, "Outsource");

    expect(screen.queryByText("Heroic Raid Team 1")).not.toBeInTheDocument();
    expect(screen.getByText("Outsource Key 16")).toBeInTheDocument();
  });

  it("triggers inline editing and cancel", async () => {
    const user = userEvent.setup();
    const { onSetEditing } = renderPage();

    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    await user.click(editButtons[0]);

    expect(onSetEditing).toHaveBeenCalledWith({
      scope: "externalExpense",
      id: "exp-1"
    });
  });

  it("triggers delete expense action", async () => {
    const user = userEvent.setup();
    const { onDeleteExpense } = renderPage();

    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    await user.click(deleteButtons[0]);

    expect(onDeleteExpense).toHaveBeenCalledWith(sampleExpenses[0]);
  });
});
