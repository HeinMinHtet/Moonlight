import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BoosterBalanceTab } from "./BoosterBalanceTab.jsx";
import { money } from "../../utils/format.js";

const mockRecords = [
  { id: "r1", discordId: "d1", boosterName: "Alice", totalBalance: 100, paid: false },
  { id: "r2", discordId: "d1", boosterName: "Alice", totalBalance: 150, paid: false },
  { id: "r3", discordId: "d1", boosterName: "Alice", totalBalance: 200, paid: true },
  { id: "r4", discordId: "d2", boosterName: "Bob", totalBalance: 80, paid: false }
];

const mockAdjustments = [
  {
    id: "a1",
    discordId: "d1",
    boosterName: "Alice",
    type: "add",
    amount: 50,
    note: "Weekly Bonus",
    date: "2026-08-18",
    createdByName: "AdminUser"
  },
  {
    id: "a2",
    discordId: "d1",
    boosterName: "Alice",
    type: "deduct",
    amount: 20,
    note: "Key penalty",
    date: "2026-08-18",
    createdByName: "AdminUser"
  }
];

function renderTab(overrides = {}) {
  const props = {
    records: mockRecords,
    adjustments: mockAdjustments,
    isAdmin: true,
    permissions: { canMarkBoosterPaid: true },
    onAddAdjustment: vi.fn(),
    onUpdateAdjustment: vi.fn(),
    onDeleteAdjustment: vi.fn(),
    onAskConfirm: vi.fn(() => Promise.resolve(true)),
    ...overrides
  };

  render(<BoosterBalanceTab {...props} />);
  return props;
}

describe("BoosterBalanceTab", () => {
  it("renders balances table and audit log with computed balances", () => {
    renderTab();

    expect(screen.getByRole("heading", { name: "Booster Current Balances" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Balance Adjustment Audit Log" })).toBeInTheDocument();

    // Alice: Open runs = 250, Net adjustments = +30, Current balance = 280
    expect(screen.getAllByText("Alice").length).toBeGreaterThan(0);
    expect(screen.getByText(money(280))).toBeInTheDocument();

    // Bob: Open runs = 80, Net adjustments = 0, Current balance = 80
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getAllByText(money(80)).length).toBeGreaterThan(0);

    // Audit log should display adjustments
    expect(screen.getByText("Weekly Bonus")).toBeInTheDocument();
    expect(screen.getByText("Key penalty")).toBeInTheDocument();
  });

  it("opens create adjustment dialog and submits new adjustment", async () => {
    const user = userEvent.setup();
    const props = renderTab();

    const addBtn = screen.getByRole("button", { name: /Add \/ Deduct Balance/i });
    await user.click(addBtn);

    expect(screen.getByRole("heading", { name: "Add / Deduct Booster Balance" })).toBeInTheDocument();

    const amountInput = screen.getByPlaceholderText("0.00");
    fireEvent.change(amountInput, { target: { value: "75" } });

    const noteInput = screen.getByPlaceholderText(/e\.g\. Weekly performance bonus/i);
    fireEvent.change(noteInput, { target: { value: "Carry bonus" } });

    const submitBtn = screen.getByRole("button", { name: "Add Balance" });
    await user.click(submitBtn);

    expect(props.onAddAdjustment).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "add",
        amount: 75,
        note: "Carry bonus"
      })
    );
  });

  it("supports 1-click 'Deduct Full Balance' shortcut button in dialog", async () => {
    const user = userEvent.setup();
    renderTab();

    const adjustButtons = screen.getAllByRole("button", { name: /\+ \/ - Adjust/i });
    await user.click(adjustButtons[0]); // Alice (balance 280)

    // Switch to Deduct type
    const deductTab = screen.getByRole("button", { name: /- Deduct Balance \(Debit\)/i });
    await user.click(deductTab);

    // Look for shortcut button: "Deduct Full Balance (280)"
    const shortcutBtn = screen.getByRole("button", { name: new RegExp(`Deduct Full Balance \\(${money(280)}\\)`, "i") });
    expect(shortcutBtn).toBeInTheDocument();

    await user.click(shortcutBtn);

    const amountInput = screen.getByPlaceholderText("0.00");
    expect(amountInput).toHaveValue(280);
  });

  it("opens edit adjustment dialog and submits updated note/amount", async () => {
    const user = userEvent.setup();
    const props = renderTab();

    const editBtn = screen.getAllByRole("button", { name: "Edit adjustment for Alice" })[0];
    await user.click(editBtn);

    expect(screen.getByRole("heading", { name: "Edit Balance Adjustment" })).toBeInTheDocument();

    const noteInput = screen.getByDisplayValue("Weekly Bonus");
    fireEvent.change(noteInput, { target: { value: "Weekly Super Bonus" } });

    const saveBtn = screen.getByRole("button", { name: "Save Changes" });
    await user.click(saveBtn);

    expect(props.onUpdateAdjustment).toHaveBeenCalledWith(
      "a1",
      expect.objectContaining({
        note: "Weekly Super Bonus"
      })
    );
  });

  it("confirms and deletes an adjustment", async () => {
    const user = userEvent.setup();
    const props = renderTab();

    const deleteBtn = screen.getAllByRole("button", { name: "Delete adjustment for Alice" })[0];
    await user.click(deleteBtn);

    expect(props.onAskConfirm).toHaveBeenCalled();
    expect(props.onDeleteAdjustment).toHaveBeenCalledWith("a1");
  });

  it("opens settle dialog on 'Pay Balance' click and confirms payout", async () => {
    const user = userEvent.setup();
    const props = renderTab({ onSettleBooster: vi.fn() });

    // Alice has balance 280 (positive) => has Pay Balance button
    const payBtn = screen.getAllByRole("button", { name: "Pay Balance" })[0];
    await user.click(payBtn);

    expect(screen.getByRole("heading", { name: "Settle Booster Payout" })).toBeInTheDocument();
    expect(screen.getByText("Ready to Pay")).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: new RegExp(`Confirm Payout \\(${money(280)}\\)`, "i") });
    expect(confirmBtn).toBeInTheDocument();

    await user.click(confirmBtn);
    expect(props.onSettleBooster).toHaveBeenCalledWith(
      expect.objectContaining({
        boosterName: "Alice"
      })
    );
  });

  it("opens settle dialog on 'Offset Runs' click for deficit booster", async () => {
    const user = userEvent.setup();
    const deficitRecords = [
      { id: "r10", discordId: "d3", boosterName: "Charlie", totalBalance: 40, paid: false }
    ];
    const deficitAdjustments = [
      { id: "a10", discordId: "d3", boosterName: "Charlie", type: "deduct", amount: 100, note: "Loan" }
    ];
    const props = renderTab({
      records: deficitRecords,
      adjustments: deficitAdjustments,
      onSettleBooster: vi.fn()
    });

    // Charlie has 40 open runs, -100 adjustment => balance -60 => has Offset Runs button
    const offsetBtn = screen.getByRole("button", { name: "Offset Runs" });
    await user.click(offsetBtn);

    expect(screen.getByRole("heading", { name: "Settle Booster Payout" })).toBeInTheDocument();
    expect(screen.getByText("Booster is in Deficit")).toBeInTheDocument();
    expect(screen.getByText(/No gold will be traded in-game/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: new RegExp(`Offset Runs to Debt \\(${money(40)}\\)`, "i") });
    await user.click(confirmBtn);

    expect(props.onSettleBooster).toHaveBeenCalledWith(
      expect.objectContaining({
        boosterName: "Charlie"
      })
    );
  });

  it("preserves user form input in Add / Deduct dialog when background data refreshes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <BoosterBalanceTab
        records={mockRecords}
        adjustments={mockAdjustments}
        isAdmin={true}
        permissions={{ canMarkBoosterPaid: true }}
        onAddAdjustment={vi.fn()}
      />
    );

    const addBtn = screen.getByRole("button", { name: /Add \/ Deduct Balance/i });
    await user.click(addBtn);

    expect(screen.getByRole("heading", { name: "Add / Deduct Booster Balance" })).toBeInTheDocument();

    const amountInput = screen.getByPlaceholderText("0.00");
    await user.type(amountInput, "123.45");

    const noteInput = screen.getByPlaceholderText(/e\.g\. Weekly performance bonus/i);
    await user.type(noteInput, "Work in progress bonus note");

    expect(amountInput).toHaveValue(123.45);
    expect(noteInput).toHaveValue("Work in progress bonus note");

    // Simulate background polling update (new records/adjustments array references with new data)
    rerender(
      <BoosterBalanceTab
        records={[...mockRecords, { id: "r99", discordId: "d1", boosterName: "Alice", totalBalance: 500, paid: false }]}
        adjustments={[...mockAdjustments]}
        isAdmin={true}
        permissions={{ canMarkBoosterPaid: true }}
        onAddAdjustment={vi.fn()}
      />
    );

    // Form inputs must remain preserved and NOT reset by polling
    expect(screen.getByRole("heading", { name: "Add / Deduct Booster Balance" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("0.00")).toHaveValue(123.45);
    expect(screen.getByPlaceholderText(/e\.g\. Weekly performance bonus/i)).toHaveValue("Work in progress bonus note");
  });
});

