import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BoosterPayoutPage } from "./BoosterPayoutPage.jsx";
import { money } from "../../utils/format.js";

const mockPrices = [
  { level: "+10", rate: 50, active: true },
  { level: "+11", rate: 60, active: true }
];

describe("BoosterPayoutPage - Personal Booster View", () => {
  it("computes 0 current balance and 0 net adjustments when all runs and deductions are settled", () => {
    const user = { id: "booster-123", username: "FrogH" };
    const records = [
      {
        id: "r1",
        discordId: "booster-123",
        boosterName: "FrogH",
        level: "+10",
        quantity: 1,
        totalBalance: 50,
        paid: true,
        paidAt: "2026-08-20T12:00:00.000Z"
      }
    ];
    const adjustments = [
      {
        id: "a1",
        discordId: "booster-123",
        boosterName: "FrogH",
        type: "deduct",
        amount: 50,
        note: "Advance payout offset",
        settled: true,
        settledAt: "2026-08-20T12:00:00.000Z"
      }
    ];

    render(
      <BoosterPayoutPage
        isAdmin={false}
        user={user}
        records={records}
        adjustments={adjustments}
        prices={mockPrices}
        permissions={{ canUseBooster: true }}
      />
    );

    // Current balance should be 0 (not -$50)
    const currentBalanceLabel = screen.getByText("Current balance");
    const statBarItem = currentBalanceLabel.closest("div");
    expect(statBarItem).toHaveTextContent(money(0));

    // Unpaid runs should be 0
    const unpaidRunsLabel = screen.getByText("Unpaid runs");
    expect(unpaidRunsLabel.closest("div")).toHaveTextContent(money(0));

    // Net adjustments should be 0
    const netAdjustmentsLabel = screen.getByText("Net adjustments");
    expect(netAdjustmentsLabel.closest("div")).toHaveTextContent(money(0));

    // Total earned should be 50 (from the paid run)
    const totalEarnedLabel = screen.getByText("Total earned");
    expect(totalEarnedLabel.closest("div")).toHaveTextContent(money(50));
  });

  it("accurately reflects active adjustments and ignores settled ones in current balance", () => {
    const user = { id: "booster-456", username: "Lunacore" };
    const records = [
      {
        id: "r1",
        discordId: "booster-456",
        boosterName: "Lunacore",
        level: "+10",
        quantity: 2,
        totalBalance: 100,
        paid: false
      },
      {
        id: "r2",
        discordId: "booster-456",
        boosterName: "Lunacore",
        level: "+10",
        quantity: 1,
        totalBalance: 50,
        paid: true,
        paidAt: "2026-08-19T10:00:00.000Z"
      }
    ];
    const adjustments = [
      {
        id: "a1",
        discordId: "booster-456",
        boosterName: "Lunacore",
        type: "deduct",
        amount: 50,
        note: "Settled old loan",
        settled: true,
        settledAt: "2026-08-19T10:00:00.000Z"
      },
      {
        id: "a2",
        discordId: "booster-456",
        boosterName: "Lunacore",
        type: "add",
        amount: 25,
        note: "Active tip bonus",
        settled: false
      }
    ];

    render(
      <BoosterPayoutPage
        isAdmin={false}
        user={user}
        records={records}
        adjustments={adjustments}
        prices={mockPrices}
        permissions={{ canUseBooster: true }}
      />
    );

    // Current balance = 100 (open runs) + 25 (active bonus) = 125
    const currentBalanceLabel = screen.getByText("Current balance");
    expect(currentBalanceLabel.closest("div")).toHaveTextContent(money(125));

    // Unpaid runs = 100
    const unpaidRunsLabel = screen.getByText("Unpaid runs");
    expect(unpaidRunsLabel.closest("div")).toHaveTextContent(money(100));

    // Net adjustments = +25
    const netAdjustmentsLabel = screen.getByText("Net adjustments");
    expect(netAdjustmentsLabel.closest("div")).toHaveTextContent(`+${money(25)}`);

    // Total earned = 100 (open) + 50 (paid) + 25 (bonus) = 175
    const totalEarnedLabel = screen.getByText("Total earned");
    expect(totalEarnedLabel.closest("div")).toHaveTextContent(money(175));
  });

  it("admin stat bar total current balance excludes settled adjustments", () => {
    const user = { id: "admin-1", username: "AdminUser" };
    const records = [
      {
        id: "r1",
        discordId: "booster-123",
        boosterName: "FrogH",
        level: "+10",
        quantity: 1,
        totalBalance: 50,
        paid: true,
        paidAt: "2026-08-20T12:00:00.000Z"
      }
    ];
    const adjustments = [
      {
        id: "a1",
        discordId: "booster-123",
        boosterName: "FrogH",
        type: "deduct",
        amount: 50,
        note: "Settled advance",
        settled: true
      }
    ];

    render(
      <BoosterPayoutPage
        isAdmin={true}
        user={user}
        records={records}
        adjustments={adjustments}
        prices={mockPrices}
        permissions={{ canUseBooster: true, canMarkBoosterPaid: true }}
      />
    );

    // Total current balance for admin should be 0 (open runs 0 + active adjustments 0)
    const totalCurrentBalanceLabel = screen.getByText("Total current balance");
    expect(totalCurrentBalanceLabel.closest("div")).toHaveTextContent(money(0));
  });
});
