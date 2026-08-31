import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BoosterVaultWithdrawDialog } from "./BoosterVaultWithdrawDialog.jsx";
import { BoosterSettleDialog } from "./BoosterSettleDialog.jsx";
import { BoosterBalanceTab } from "./BoosterBalanceTab.jsx";
import { mmk, money } from "../../utils/format.js";

describe("BoosterVault - UI Tests", () => {
  it("renders BoosterVaultWithdrawDialog and handles full and partial withdrawal submissions", async () => {
    const user = userEvent.setup();
    const mockWithdraw = vi.fn().mockResolvedValue({});
    const mockClose = vi.fn();

    const booster = {
      boosterName: "Viper",
      discordId: "d-viper",
      storedCash: 90000
    };

    const { rerender } = render(
      <BoosterVaultWithdrawDialog
        isOpen={true}
        booster={booster}
        onWithdraw={mockWithdraw}
        onClose={mockClose}
      />
    );

    expect(screen.getByRole("heading", { name: "Release Stored Cash" })).toBeInTheDocument();
    expect(screen.getByText("Available in Vault")).toBeInTheDocument();
    expect(screen.getAllByText(mmk(90000)).length).toBeGreaterThan(0);

    // Test Max / Full Amount button
    const maxBtn = screen.getByRole("button", { name: "Max / Full Amount" });
    await user.click(maxBtn);

    const amountInput = screen.getByPlaceholderText("e.g. 50000");
    expect(amountInput).toHaveValue(90000);

    // Enter partial amount: 50,000 MMK
    fireEvent.change(amountInput, { target: { value: "50000" } });
    expect(amountInput).toHaveValue(50000);

    const noteInput = screen.getByPlaceholderText(/Sent via KPay to 09xxxxxxxxx/i);
    fireEvent.change(noteInput, { target: { value: "Transfer via KBZPay to 09123456789" } });

    const confirmBtn = screen.getByRole("button", { name: /Confirm Cashout/i });
    await user.click(confirmBtn);

    expect(mockWithdraw).toHaveBeenCalledWith(
      expect.objectContaining({
        boosterName: "Viper",
        discordId: "d-viper",
        amount: 50000,
        paymentMethod: "KBZPay",
        note: "Transfer via KBZPay to 09123456789"
      })
    );
    expect(mockClose).toHaveBeenCalled();
  });

  it("BoosterSettleDialog allows setting exchange rate and clicking 'Hold in Vault'", async () => {
    const user = userEvent.setup();
    const mockConfirm = vi.fn();
    const mockClose = vi.fn();

    const booster = {
      boosterName: "Viper",
      discordId: "d-viper",
      currentBalance: 500,
      storedCash: 20000
    };
    const records = [
      { id: "r1", boosterName: "Viper", discordId: "d-viper", totalBalance: 500, paid: false }
    ];

    render(
      <BoosterSettleDialog
        isOpen={true}
        booster={booster}
        records={records}
        adjustments={[]}
        defaultRate={180}
        onConfirm={mockConfirm}
        onClose={mockClose}
      />
    );

    expect(screen.getByRole("heading", { name: "Settle Booster Payout" })).toBeInTheDocument();
    expect(screen.getByText("Exchange Rate (MMK / Gold)")).toBeInTheDocument();
    // 500 gold * 180 rate = 90,000 MMK
    expect(screen.getByText(mmk(90000))).toBeInTheDocument();
    expect(screen.getByText(mmk(20000))).toBeInTheDocument(); // existing vault balance

    // Change rate to 200 => 500 * 200 = 100,000 MMK
    const rateInput = screen.getByPlaceholderText("180");
    fireEvent.change(rateInput, { target: { value: "200" } });
    expect(screen.getByText(mmk(100000))).toBeInTheDocument();

    const holdBtn = screen.getByRole("button", { name: new RegExp(`Hold in Vault \\(${mmk(100000)}\\)`, "i") });
    await user.click(holdBtn);

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        boosterName: "Viper",
        discordId: "d-viper",
        rate: 200,
        action: "hold_cash"
      })
    );
  });

  it("BoosterBalanceTab renders Stored Cash (MMK) column and Release MMK button when vault balance > 0", async () => {
    const user = userEvent.setup();
    const records = [
      { id: "r1", boosterName: "Viper", discordId: "d-viper", totalBalance: 500, paid: true }
    ];
    const vaultTransactions = [
      { id: "tx1", boosterName: "Viper", discordId: "d-viper", type: "deposit", amount: 90000, rate: 180, goldAmount: 500, date: "2026-08-31" }
    ];

    render(
      <BoosterBalanceTab
        records={records}
        adjustments={[]}
        vaultTransactions={vaultTransactions}
        isAdmin={true}
        permissions={{ canMarkBoosterPaid: true }}
        onSettleBooster={vi.fn()}
        onWithdrawVaultCash={vi.fn()}
      />
    );

    expect(screen.getByText("Stored Cash (MMK)")).toBeInTheDocument();
    expect(screen.getByText("Vault Active")).toBeInTheDocument();
    expect(screen.getAllByText(mmk(90000)).length).toBeGreaterThan(0);

    // Release MMK button exists
    const releaseBtn = screen.getByRole("button", { name: /Release MMK/i });
    expect(releaseBtn).toBeInTheDocument();

    // Stored Cash Vault (MMK) Ledger table exists
    expect(screen.getByRole("heading", { name: "Stored Cash Vault (MMK) Ledger" })).toBeInTheDocument();
    expect(screen.getByText("+ Vault Deposit")).toBeInTheDocument();
    expect(screen.getByText("+90,000 MMK")).toBeInTheDocument();
  });
});
