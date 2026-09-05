import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RaidNotesPage } from "./RaidNotesPage.jsx";

const sampleNotes = [
  {
    id: "note-1",
    title: "Heroic 8/8 10 am",
    raidDate: "2026-09-05",
    raidTime: "10:00 AM",
    color: "blue",
    pinned: true,
    archived: false,
    items: [
      { id: "item-1", text: "Veliandina-tichondrius", completed: false },
      { id: "item-2", text: "Squatchlace-Tichondrius", completed: false }
    ]
  },
  {
    id: "note-2",
    title: "Heroic 8/8 6pm",
    raidDate: "2026-09-05",
    raidTime: "6:00 PM",
    color: "default",
    pinned: false,
    archived: false,
    items: [
      { id: "item-3", text: "silverdaddy-illidan", completed: true }
    ]
  },
  {
    id: "note-3",
    title: "Past Run 8/1",
    raidDate: "2026-08-01",
    raidTime: "",
    color: "emerald",
    pinned: false,
    archived: true,
    items: [
      { id: "item-4", text: "oldbuyer-area52", completed: true }
    ]
  }
];

function renderPage(overrides = {}) {
  const props = {
    isAdmin: true,
    loading: false,
    loadError: "",
    notes: sampleNotes,
    onCreateNote: vi.fn(),
    onUpdateNote: vi.fn(),
    onDeleteNote: vi.fn(),
    ...overrides
  };

  render(<RaidNotesPage {...props} />);
  return props;
}

describe("RaidNotesPage", () => {
  it("renders access denied when non-admin accesses page", () => {
    renderPage({ isAdmin: false });
    expect(screen.getByText(/Only Discord admins can view raid notes/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Raid Sales Notes & Todo/i })).not.toBeInTheDocument();
  });

  it("renders active notes with buyer checklist items and badges", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: /Raid Sales Notes & Todo/i })).toBeInTheDocument();
    expect(screen.getByText("Heroic 8/8 10 am")).toBeInTheDocument();
    expect(screen.getByText("Veliandina-tichondrius")).toBeInTheDocument();
    expect(screen.getByText("Squatchlace-Tichondrius")).toBeInTheDocument();
    expect(screen.getByText("Heroic 8/8 6pm")).toBeInTheDocument();
    // Completed items are directly visible with strikethrough without being hidden
    expect(screen.getByText("silverdaddy-illidan")).toBeInTheDocument();
  });

  it("copies title, time, and buyers formatted to clipboard", async () => {
    const user = userEvent.setup();
    renderPage();

    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    const copyButtons = screen.getAllByRole("button", { name: /Copy list/i });
    await user.click(copyButtons[0]);

    expect(writeTextSpy).toHaveBeenCalledWith(
      "Heroic 8/8 10 am\nVeliandina-tichondrius\nSquatchlace-Tichondrius"
    );
  });

  it("toggles an active buyer item completed", async () => {
    const user = userEvent.setup();
    const { onUpdateNote } = renderPage();

    const checkboxes = screen.getAllByRole("checkbox");
    // Click on the first checkbox (Veliandina)
    await user.click(checkboxes[0]);

    expect(onUpdateNote).toHaveBeenCalledWith("note-1", {
      items: [
        { id: "item-1", text: "Veliandina-tichondrius", completed: true },
        { id: "item-2", text: "Squatchlace-Tichondrius", completed: false }
      ]
    });
  });

  it("filters notes by search query for buyer name", async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = screen.getByPlaceholderText(/Search by buyer name, realm, title/i);
    await user.type(searchInput, "silverdaddy");

    expect(screen.queryByText("Heroic 8/8 10 am")).not.toBeInTheDocument();
    expect(screen.getByText("Heroic 8/8 6pm")).toBeInTheDocument();
  });

  it("shows completed notes when switching to Completed tab", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.queryByText("Past Run 8/1")).not.toBeInTheDocument();

    const completedTab = screen.getByRole("button", { name: /^Completed/i });
    await user.click(completedTab);

    expect(screen.getByText("Past Run 8/1")).toBeInTheDocument();
    expect(screen.queryByText("Heroic 8/8 10 am")).not.toBeInTheDocument();
  });

  it("filters notes dynamically by date chip", async () => {
    const user = userEvent.setup();
    renderPage({
      notes: [
        {
          id: "n-1",
          title: "Run A",
          raidDate: "2026-09-05",
          archived: false,
          items: []
        },
        {
          id: "n-2",
          title: "Run B",
          raidDate: "2026-09-10",
          archived: false,
          items: []
        }
      ]
    });

    // Both notes initially visible
    expect(screen.getByText("Run A")).toBeInTheDocument();
    expect(screen.getByText("Run B")).toBeInTheDocument();

    // Click on the chip for 2026-09-05
    const dateChip = screen.getByTitle("Filter by 2026-09-05");
    await user.click(dateChip);

    expect(screen.getByText("Run A")).toBeInTheDocument();
    expect(screen.queryByText("Run B")).not.toBeInTheDocument();

    // Reset date filter
    const allChip = screen.getByRole("button", { name: /^All/i });
    await user.click(allChip);

    expect(screen.getByText("Run A")).toBeInTheDocument();
    expect(screen.getByText("Run B")).toBeInTheDocument();
  });

  it("creates a new note via quick create input", async () => {
    const user = userEvent.setup();
    const { onCreateNote } = renderPage();

    // Click quick-create bar to expand
    const trigger = screen.getByText(/Take a raid note/i);
    await user.click(trigger);

    // Fill title
    const titleInput = screen.getByPlaceholderText(/Raid Title/i);
    await user.type(titleInput, "Heroic 6/8 10pm +11:59pm");

    // Add a buyer
    const buyerInput = screen.getByPlaceholderText(/Type buyer .* and press Enter/i);
    await user.type(buyerInput, "saouri-illidan");
    const addBtn = screen.getByRole("button", { name: "Add" });
    await user.click(addBtn);

    expect(screen.getByText("saouri-illidan")).toBeInTheDocument();

    // Submit
    const saveBtn = screen.getByRole("button", { name: "Save Note" });
    await user.click(saveBtn);

    expect(onCreateNote).toHaveBeenCalled();
    const callArg = onCreateNote.mock.calls[0][0];
    expect(callArg.title).toBe("Heroic 6/8 10pm +11:59pm");
    expect(callArg.items).toEqual([{ text: "saouri-illidan", completed: false }]);
  });
});

