import React, { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BoosterRecordsTable } from "./BoosterRecordsTable.jsx";

const mockPrices = [
  { level: "+10", price: 100, active: true },
  { level: "+11", price: 150, active: true }
];

const mockRecords = [
  {
    id: 1,
    createdAt: "2026-08-20T12:00:00Z",
    boosterName: "Alice",
    discordId: "d1",
    level: "+10",
    quantity: 2,
    rateAtRecord: 100,
    totalBalance: 200,
    paid: false,
    paidAt: null,
    note: "Initial run"
  }
];

function TestHarness({ initialEditing = null, onPatchRecord = vi.fn() }) {
  const [editing, setEditing] = useState(initialEditing);
  return (
    <BoosterRecordsTable
      records={mockRecords}
      prices={mockPrices}
      user={{ id: "d1", username: "Alice" }}
      isAdmin={true}
      permissions={{ canUseBooster: true, canDeleteBoosterRows: true }}
      editing={editing}
      selectedIds={new Set()}
      emptyMessage="No records"
      onSetEditing={setEditing}
      onPatchRecord={onPatchRecord}
      onDeleteRecord={vi.fn()}
      onToggleRow={vi.fn()}
    />
  );
}

describe("BoosterRecordsTable inline edit", () => {
  it("keeps focus on the input while continuously typing into inline edit fields", async () => {
    const user = userEvent.setup();
    const handlePatch = vi.fn();
    render(<TestHarness initialEditing={{ scope: "booster", id: 1 }} onPatchRecord={handlePatch} />);

    const noteInput = screen.getByDisplayValue("Initial run");
    expect(noteInput).toBeInTheDocument();

    await user.clear(noteInput);
    await user.type(noteInput, "Updated Note Continuous");

    // Verify input retains focus after continuous typing
    expect(document.activeElement).toBe(noteInput);
    expect(noteInput).toHaveValue("Updated Note Continuous");

    const saveBtn = screen.getByRole("button", { name: "Save changes" });
    await user.click(saveBtn);

    expect(handlePatch).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        note: "Updated Note Continuous"
      })
    );
  });
});
