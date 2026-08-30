import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SupplierWithdrawalsTable } from "./SupplierWithdrawalsTable.jsx";

const mockWithdrawals = [
  {
    id: "w-1",
    date: "2026-08-26",
    charName: "BankerOne",
    guild: "Main Guild",
    amount: 1500,
    note: "Gold for repair bot",
    settled: false
  },
  {
    id: "w-2",
    date: "2026-08-25",
    charName: "BankerTwo",
    guild: "Alt Guild",
    amount: 2500,
    note: "Settled withdrawal",
    settled: true,
    settledAt: "2026-08-25T12:00:00.000Z"
  }
];

const mockGuilds = [
  { name: "Main Guild", active: true, isDefault: true },
  { name: "Alt Guild", active: true, isDefault: false }
];

function renderTable(overrides = {}) {
  const props = {
    withdrawals: mockWithdrawals,
    guilds: mockGuilds,
    editing: null,
    onSetEditing: vi.fn(),
    permissions: {
      canUseSupplier: true,
      canDeleteSupplierRows: true
    },
    onPatchWithdrawal: vi.fn(),
    onDeleteWithdrawal: vi.fn(),
    ...overrides
  };

  render(<SupplierWithdrawalsTable {...props} />);
  return props;
}

describe("SupplierWithdrawalsTable", () => {
  it("renders withdrawal rows with dates, character names, amounts, and statuses", () => {
    renderTable();

    expect(screen.getByText("BankerOne")).toBeInTheDocument();
    expect(screen.getByText("Main Guild")).toBeInTheDocument();
    expect(screen.getByText("1,500")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();

    expect(screen.getByText("BankerTwo")).toBeInTheDocument();
    expect(screen.getByText("Alt Guild")).toBeInTheDocument();
    expect(screen.getByText("2,500")).toBeInTheDocument();
    expect(screen.getByText("Settled")).toBeInTheDocument();
  });

  it("calls onSetEditing when clicking Edit on an active withdrawal", async () => {
    const user = userEvent.setup();
    const { onSetEditing } = renderTable();

    const editBtn = screen.getByRole("button", { name: "Edit" });
    await user.click(editBtn);

    expect(onSetEditing).toHaveBeenCalledWith({
      scope: "supplierWithdrawal",
      id: "w-1"
    });
  });

  it("calls onPatchWithdrawal with edited draft values", async () => {
    const user = userEvent.setup();
    const handlePatch = vi.fn();
    renderTable({
      editing: { scope: "supplierWithdrawal", id: "w-1" },
      onPatchWithdrawal: handlePatch
    });

    const charInput = screen.getByDisplayValue("BankerOne");
    await user.clear(charInput);
    await user.type(charInput, "BankerPrime");

    const saveBtn = screen.getByRole("button", { name: "Save" });
    await user.click(saveBtn);

    expect(handlePatch).toHaveBeenCalledWith(
      "w-1",
      expect.objectContaining({
        charName: "BankerPrime"
      })
    );
  });

  it("calls onDeleteWithdrawal when delete button is clicked", async () => {
    const user = userEvent.setup();
    const { onDeleteWithdrawal } = renderTable();

    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    await user.click(deleteButtons[0]);

    expect(onDeleteWithdrawal).toHaveBeenCalledWith(mockWithdrawals[0]);
  });

  it("renders custom emptyMessage when withdrawals is empty", () => {
    renderTable({
      withdrawals: [],
      emptyMessage: "No active pre-withdrawals recorded yet."
    });

    expect(screen.getByText("No active pre-withdrawals recorded yet.")).toBeInTheDocument();
  });
});
