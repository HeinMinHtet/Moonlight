import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RaidSchedulePage } from "./RaidSchedulePage.jsx";

const todayStr = new Date().toISOString().slice(0, 10);

const sampleSchedules = [
  {
    id: "sched-1",
    date: todayStr,
    timeEst: "20:00",
    raid: "Venomous Abyss",
    difficulty: "Heroic",
    loot: "Unsaved",
    maxBuyers: 6,
    buyers: ["BuyerOne-Illidan", "BuyerTwo-Area52"],
    lead: "Hein / Team Alpha",
    note: "Bring mail armor stack",
    isFull: false
  },
  {
    id: "sched-2",
    date: todayStr,
    timeEst: "22:30",
    raid: "Tidebound Grotto",
    difficulty: "Mythic",
    loot: "Saved",
    maxBuyers: 2,
    buyers: ["MythicBuyer-Illidan", "MythicBuyer-Area52"],
    lead: "Mythic Core",
    note: "",
    isFull: true
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
  it("renders page header, lockout week navigator, day strip, and Midnight S2 raids", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: /Daily Raid Schedule/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy raid schedule/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Schedule Run/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Raid week days/i })).toBeInTheDocument();

    // Default raids in select should be Venomous Abyss and Tidebound Grotto
    const raidSelect = screen.getByLabelText(/^Raid$/i);
    expect(screen.getByRole("option", { name: "Venomous Abyss" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Tidebound Grotto" })).toBeInTheDocument();
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
        raid: "Venomous Abyss",
        maxBuyers: 8,
        difficulty: "Heroic",
        loot: "Unsaved",
        isFull: false
      })
    );
  });

  it("filters raids by difficulty and search term", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole("cell", { name: "Venomous Abyss" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Tidebound Grotto" })).toBeInTheDocument();

    // Filter by Mythic
    const difficultySelect = screen.getByDisplayValue("All Difficulties");
    await user.selectOptions(difficultySelect, "Mythic");

    expect(screen.queryByRole("cell", { name: "Venomous Abyss" })).not.toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Tidebound Grotto" })).toBeInTheDocument();

    // Reset difficulty, search by text
    await user.selectOptions(difficultySelect, "All");
    const searchInput = screen.getByPlaceholderText(/Search raid, time, leader, buyer/i);
    await user.type(searchInput, "Venomous");

    expect(screen.getByRole("cell", { name: "Venomous Abyss" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "Tidebound Grotto" })).not.toBeInTheDocument();
  });

  it("renders 8/8 capacity display and opens manage buyers modal", async () => {
    const user = userEvent.setup();
    const onAddBuyer = vi.fn();
    renderPage({ onAddBuyer });

    // Sched-1 has 2/6, Sched-2 has 2/2 (FULL)
    expect(screen.getByText("2 / 6")).toBeInTheDocument();
    expect(screen.getByText("4 open")).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();

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

  it("toggles raid full checkbox via onPatchSchedule", async () => {
    const user = userEvent.setup();
    const onPatchSchedule = vi.fn();
    renderPage({ onPatchSchedule });

    const fullCheckbox = screen.getByLabelText("Toggle full status for Heroic Venomous Abyss");
    expect(fullCheckbox).not.toBeChecked();

    await user.click(fullCheckbox);
    expect(onPatchSchedule).toHaveBeenCalledWith("sched-1", { isFull: true });
  });

  it("opens edit modal and updates raid run details via onPatchSchedule", async () => {
    const user = userEvent.setup();
    const onPatchSchedule = vi.fn();
    renderPage({ onPatchSchedule });

    const editBtns = screen.getAllByRole("button", { name: /Edit run/i });
    await user.click(editBtns[0]);

    expect(screen.getByRole("heading", { name: /Edit Raid Schedule/i })).toBeInTheDocument();

    const leadInput = screen.getByLabelText(/Lead \/ Team/i);
    await user.clear(leadInput);
    await user.type(leadInput, "Hein Leader Updated");

    const saveBtn = screen.getByRole("button", { name: /Save Changes/i });
    await user.click(saveBtn);

    expect(onPatchSchedule).toHaveBeenCalledWith("sched-1", expect.objectContaining({
      lead: "Hein Leader Updated",
      raid: "Venomous Abyss"
    }));
  });

  it("copies selected date schedule formatted for WeChat and without Moonlight", async () => {
    const user = userEvent.setup();
    renderPage();

    // Mock clipboard
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true
    });

    const copyBtn = screen.getByRole("button", { name: /Copy raid schedule/i });
    await user.click(copyBtn);

    expect(writeText).toHaveBeenCalledTimes(1);
    const copiedText = writeText.mock.calls[0][0];

    // Must NOT contain Moonlight
    expect(copiedText).not.toMatch(/Moonlight/i);
    // Must contain selected date schedule items
    expect(copiedText).toContain("Venomous Abyss");
    expect(copiedText).toContain("Tidebound Grotto");
    expect(copiedText).toContain("团本安排 Raid Schedule");
  });

  it("shows empty state when no runs match filter", () => {
    renderPage({ schedules: [] });
    expect(screen.getByText(/No raid runs scheduled/i)).toBeInTheDocument();
  });
});
