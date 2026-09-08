import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RaidSchedulePage } from "./RaidSchedulePage.jsx";

const sampleSchedules = [
  {
    id: "sched-1",
    date: new Date().toISOString().slice(0, 10),
    timeEst: "20:00",
    raid: "Liberation of Undermine",
    difficulty: "Heroic",
    loot: "Unsaved",
    maxBuyers: 6,
    buyers: ["BuyerOne-Illidan", "BuyerTwo-Area52"],
    lead: "Hein / Team Alpha",
    note: "Bring mail armor stack"
  },
  {
    id: "sched-2",
    date: new Date().toISOString().slice(0, 10),
    timeEst: "22:30",
    raid: "Nerub-ar Palace",
    difficulty: "Mythic",
    loot: "Saved",
    maxBuyers: 2,
    buyers: ["MythicBuyer-Illidan", "MythicBuyer-Area52"],
    lead: "Mythic Core",
    note: ""
  }
];

function renderPage(overrides = {}) {
  const props = {
    isAdmin: true,
    loading: false,
    loadError: "",
    schedules: sampleSchedules,
    onSubmitSchedule: vi.fn(),
    onPatchSchedule: vi.fn(),
    onDeleteSchedule: vi.fn(),
    onAddBuyer: vi.fn(),
    onRemoveBuyer: vi.fn(),
    ...overrides
  };
  return {
    ...render(<RaidSchedulePage {...props} />),
    props
  };
}

describe("RaidSchedulePage", () => {
  it("renders page header, lockout week navigator, and day strip", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: /Daily Raid Schedule/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy for Discord/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Schedule Run/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Raid week days/i })).toBeInTheDocument();
  });

  it("submits a new raid run via the quick-add form under the date filter", async () => {
    const user = userEvent.setup();
    const onSubmitSchedule = vi.fn();
    renderPage({ onSubmitSchedule });

    const timeInput = screen.getByLabelText(/Time \(EST\)/i);
    await user.clear(timeInput);
    await user.type(timeInput, "21:00");

    const maxInput = screen.getByLabelText(/Maximum 8\/8/i);
    await user.clear(maxInput);
    await user.type(maxInput, "8");

    const addBtn = screen.getByRole("button", { name: /Add Run/i });
    await user.click(addBtn);

    expect(onSubmitSchedule).toHaveBeenCalledTimes(1);
    expect(onSubmitSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        timeEst: "21:00",
        maxBuyers: 8,
        difficulty: "Heroic",
        loot: "Unsaved"
      })
    );
  });

  it("filters raids by difficulty and search term", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole("cell", { name: "Liberation of Undermine" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Nerub-ar Palace" })).toBeInTheDocument();

    // Filter by Mythic
    const difficultySelect = screen.getByDisplayValue("All Difficulties");
    await user.selectOptions(difficultySelect, "Mythic");

    expect(screen.queryByRole("cell", { name: "Liberation of Undermine" })).not.toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Nerub-ar Palace" })).toBeInTheDocument();

    // Reset difficulty, search by text
    await user.selectOptions(difficultySelect, "All");
    const searchInput = screen.getByPlaceholderText(/Search raid, time, leader, buyer/i);
    await user.type(searchInput, "Undermine");

    expect(screen.getByRole("cell", { name: "Liberation of Undermine" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "Nerub-ar Palace" })).not.toBeInTheDocument();
  });

  it("renders 8/8 capacity display and opens manage buyers modal", async () => {
    const user = userEvent.setup();
    const onAddBuyer = vi.fn();
    renderPage({ onAddBuyer });

    // Sched-1 has 2/6, Sched-2 has 2/2 (FULL)
    expect(screen.getByText("2 / 6")).toBeInTheDocument();
    expect(screen.getByText("4 open")).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(screen.getByText("FULL")).toBeInTheDocument();

    // Click Buyers (2) button
    const buyersBtn = screen.getAllByRole("button", { name: /Buyers \(2\)/i })[0];
    await user.click(buyersBtn);

    expect(screen.getByText("Manage 8/8 Buyers")).toBeInTheDocument();
    expect(screen.getByText("BuyerOne-Illidan")).toBeInTheDocument();

    // Add a new buyer
    const buyerInput = screen.getByPlaceholderText(/Character-Realm/i);
    await user.type(buyerInput, "NewBuyer-Stormrage");
    const addBuyerBtn = screen.getByRole("button", { name: /Add Buyer/i });
    await user.click(addBuyerBtn);

    expect(onAddBuyer).toHaveBeenCalledWith("sched-1", "NewBuyer-Stormrage");
  });

  it("copies schedule to clipboard when clicking Copy for Discord", async () => {
    const user = userEvent.setup();
    renderPage();

    // Mock clipboard
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true
    });

    const copyBtn = screen.getByRole("button", { name: /Copy for Discord/i });
    await user.click(copyBtn);

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("MOONLIGHT RAID SCHEDULE"));
  });

  it("shows empty state when no runs match filter", () => {
    renderPage({ schedules: [] });
    expect(screen.getByText(/No raid runs scheduled/i)).toBeInTheDocument();
  });
});
