import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RaidScheduleScanModal } from "./RaidScheduleScanModal.jsx";

describe("RaidScheduleScanModal", () => {
  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <RaidScheduleScanModal
        isOpen={false}
        weekAnchorDate="2026-09-08"
        onClose={vi.fn()}
        onScanImage={vi.fn()}
        onBatchInsert={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders modal header, week selector, and dropzone when open", () => {
    render(
      <RaidScheduleScanModal
        isOpen={true}
        weekAnchorDate="2026-09-08"
        onClose={vi.fn()}
        onScanImage={vi.fn()}
        onBatchInsert={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog", { name: /scan raid schedule photo/i })).toBeInTheDocument();
    expect(screen.getByText(/scan raid schedule photo/i)).toBeInTheDocument();
    expect(screen.getByText(/gemini ai/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/lockout week reset date/i)).toHaveValue("2026-09-08");
    expect(screen.getByText(/click to browse, drag & drop, or paste screenshot/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("allows adding a manual run, editing fields inline, and deleting runs", async () => {
    const user = userEvent.setup();
    const handleBatchInsert = vi.fn().mockResolvedValue({ count: 1 });
    const handleClose = vi.fn();
    const handleScanImage = vi.fn().mockResolvedValue({
      runs: [
        {
          date: "2026-09-08",
          timeEst: "20:00",
          raid: "Venomous Abyss",
          difficulty: "Heroic",
          loot: "Unsaved",
          maxBuyers: 6,
          lead: "RaidLead1",
          note: "Cloth stack"
        }
      ]
    });

    render(
      <RaidScheduleScanModal
        isOpen={true}
        weekAnchorDate="2026-09-08"
        onClose={handleClose}
        onScanImage={handleScanImage}
        onBatchInsert={handleBatchInsert}
      />
    );

    // Initial state: 0 runs, import button disabled
    const importBtn = screen.getByRole("button", { name: /import all runs/i });
    expect(importBtn).toBeDisabled();

    // Mock drop or paste image file to enable scan button
    const file = new File(["dummy-content"], "schedule.png", { type: "image/png" });
    const fileInput = document.querySelector('input[type="file"]');
    await user.upload(fileInput, file);

    // Scan button appears
    const scanBtn = await screen.findByRole("button", { name: /scan schedule with ai/i });
    expect(scanBtn).toBeInTheDocument();

    await user.click(scanBtn);
    expect(handleScanImage).toHaveBeenCalledWith({
      image: expect.any(String),
      mimeType: expect.any(String),
      weekAnchorDate: "2026-09-08"
    });

    // Extracted runs table is displayed
    expect(await screen.findByText(/draft runs for review/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("RaidLead1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Cloth stack")).toBeInTheDocument();

    // Add another run manually
    const addRunBtn = screen.getByRole("button", { name: /add run/i });
    await user.click(addRunBtn);

    // Should now have 2 rows
    expect(screen.getByText(/draft runs for review \(2\)/i)).toBeInTheDocument();

    // Edit lead on first row
    const leadInputs = screen.getAllByPlaceholderText("Leader");
    await user.clear(leadInputs[0]);
    await user.type(leadInputs[0], "UpdatedLead");
    expect(leadInputs[0]).toHaveValue("UpdatedLead");

    // Delete second row
    const deleteBtns = screen.getAllByRole("button", { name: /delete run/i });
    expect(deleteBtns.length).toBe(2);
    await user.click(deleteBtns[1]);

    // Should now be back to 1 row
    expect(screen.getByText(/draft runs for review \(1\)/i)).toBeInTheDocument();

    // Submit import
    const activeImportBtn = screen.getByRole("button", { name: /import all runs \(1\)/i });
    expect(activeImportBtn).not.toBeDisabled();
    await user.click(activeImportBtn);

    expect(handleBatchInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        date: "2026-09-08",
        timeEst: "20:00",
        raid: "Venomous Abyss",
        difficulty: "Heroic",
        loot: "Unsaved",
        lead: "UpdatedLead"
      })
    ]);
    expect(handleClose).toHaveBeenCalled();
  });

  it("displays 503 error alert when GEMINI_API_KEY is not configured", async () => {
    const user = userEvent.setup();
    const handleScanImage = vi.fn().mockRejectedValue(
      new Error("Gemini API key is not configured. Please set GEMINI_API_KEY in the server environment (.env).")
    );

    render(
      <RaidScheduleScanModal
        isOpen={true}
        weekAnchorDate="2026-09-08"
        onClose={vi.fn()}
        onScanImage={handleScanImage}
        onBatchInsert={vi.fn()}
      />
    );

    const file = new File(["dummy-bytes"], "schedule.jpg", { type: "image/jpeg" });
    const fileInput = document.querySelector('input[type="file"]');
    await user.upload(fileInput, file);

    const scanBtn = await screen.findByRole("button", { name: /scan schedule with ai/i });
    await user.click(scanBtn);

    expect(await screen.findByText(/gemini api key required/i)).toBeInTheDocument();
    expect(screen.getByText(/gemini_api_key=your_key_here/i)).toBeInTheDocument();
  });
});
