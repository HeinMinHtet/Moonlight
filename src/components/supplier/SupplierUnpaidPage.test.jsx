import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SupplierUnpaidPage } from "./SupplierUnpaidPage.jsx";

const verifiedRecord = {
  id: "verified-row",
  date: "2026-08-18",
  buyerName: "Verifiedbuyer",
  serviceType: "Mythic+",
  quantity: 1,
  rateAtRecord: 100,
  armorType: "Cloth",
  correct: true,
  paid: false,
  totalCost: 100,
  note: "VIP Buyer"
};

const reviewRecord = {
  ...verifiedRecord,
  id: "review-row",
  date: "2026-08-25",
  buyerName: "Reviewbuyer",
  serviceType: "Raid",
  armorType: "Plate",
  correct: false,
  totalCost: 200,
  note: ""
};

function renderPage(overrides = {}) {
  const props = {
    isAdmin: true,
    loading: false,
    loadError: "",
    records: [verifiedRecord, reviewRecord],
    withdrawals: [
      {
        id: "w1",
        date: "2026-08-20",
        charName: "BankerOne",
        guild: "Main Guild",
        amount: 50,
        note: "Initial bank gold",
        settled: false
      }
    ],
    services: [
      { type: "Mythic+", price: 100, active: true },
      { type: "Raid", price: 200, active: true }
    ],
    guilds: [
      { name: "Main Guild", active: true, isDefault: true },
      { name: "Alt Guild", active: true, isDefault: false }
    ],
    armorTypes: ["Cloth", "Plate"],
    paidHistory: [],
    permissions: {
      canUseSupplier: true,
      canMarkSupplierPaid: true,
      canEditSupplierStatus: true,
      canDeleteSupplierRows: true
    },
    editing: null,
    formKey: 0,
    withdrawalFormKey: 0,
    onSubmitRecord: vi.fn((event) => event.preventDefault()),
    onPatchRecord: vi.fn(),
    onDeleteRecord: vi.fn(),
    onSubmitWithdrawal: vi.fn((event) => event.preventDefault()),
    onPatchWithdrawal: vi.fn(),
    onDeleteWithdrawal: vi.fn(),
    onSetEditing: vi.fn(),
    onExport: vi.fn(),
    onVerifyAll: vi.fn(),
    onMarkPaid: vi.fn(),
    ...overrides
  };

  render(<SupplierUnpaidPage {...props} />);
  return props;
}

describe("SupplierUnpaidPage", () => {
  it("renders summary actions including verify all, export, mark paid, and sub-tabs", () => {
    renderPage();

    const summaryPanel = screen.getByRole("heading", { name: "Verified unpaid summary" }).closest("aside");
    const recordsWorkspace = screen.getByRole("region", { name: "Supplier records workspace" });

    expect(within(summaryPanel).getByRole("button", { name: /Verify all unpaid \(1\)/i })).toBeInTheDocument();
    expect(within(summaryPanel).getByRole("button", { name: "Export batch PNG" })).toBeInTheDocument();
    expect(within(summaryPanel).getByRole("button", { name: "Mark batch paid" })).toBeInTheDocument();
    expect(within(summaryPanel).getByText("2 unpaid")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Unpaid sales (2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Withdraw Balance (1)" })).toBeInTheDocument();

    const filterBar = screen.getByRole("region", { name: "Supplier record filters" });
    expect(filterBar).toBeInTheDocument();
    expect(within(filterBar).getByPlaceholderText("Buyer, note, service...")).toBeInTheDocument();
    expect(within(filterBar).getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
    expect(within(recordsWorkspace).getByRole("button", { name: "Record sale" })).toBeInTheDocument();
    expect(within(recordsWorkspace).getByRole("columnheader", { name: "Buyer" })).toBeInTheDocument();
  });

  it("switches to Withdraw Balance sub-tab and shows withdrawal form and table", async () => {
    const user = userEvent.setup();
    renderPage();

    const withdrawTabBtn = screen.getByRole("button", { name: "Withdraw Balance (1)" });
    await user.click(withdrawTabBtn);

    const withdrawalsWorkspace = screen.getByRole("region", { name: "Supplier withdrawals workspace" });
    expect(withdrawalsWorkspace).toBeInTheDocument();
    expect(within(withdrawalsWorkspace).getByRole("button", { name: "Record withdrawal" })).toBeInTheDocument();
    expect(within(withdrawalsWorkspace).getByText("BankerOne")).toBeInTheDocument();
    expect(within(withdrawalsWorkspace).getAllByText("Main Guild").length).toBeGreaterThan(0);
  });

  it("filters sales records by search text and status", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText("Verifiedbuyer")).toBeInTheDocument();
    expect(screen.getByText("Reviewbuyer")).toBeInTheDocument();

    // Filter by search text
    const searchInput = screen.getByPlaceholderText("Buyer, note, service...");
    await user.type(searchInput, "Verified");

    expect(screen.getByText("Verifiedbuyer")).toBeInTheDocument();
    expect(screen.queryByText("Reviewbuyer")).not.toBeInTheDocument();

    // Clear search
    await user.clear(searchInput);
    expect(screen.getByText("Reviewbuyer")).toBeInTheDocument();

    // Filter by status unverified
    const statusSelect = screen.getByRole("combobox", { name: /status/i });
    await user.selectOptions(statusSelect, "unverified");

    expect(screen.queryByText("Verifiedbuyer")).not.toBeInTheDocument();
    expect(screen.getByText("Reviewbuyer")).toBeInTheDocument();
  });

  it("triggers 1-click verify all unpaid sales when clicking verify all button", async () => {
    const user = userEvent.setup();
    const { onVerifyAll } = renderPage();

    const verifyAllBtn = screen.getByRole("button", { name: /Verify all unpaid \(1\)/i });
    await user.click(verifyAllBtn);

    expect(onVerifyAll).toHaveBeenCalledOnce();
    expect(onVerifyAll.mock.calls[0][0]).toEqual([reviewRecord]);
  });

  it("opens the export dialog and performs instant export or date range export", async () => {
    const user = userEvent.setup();
    const { onExport } = renderPage();

    await user.click(screen.getByRole("button", { name: "Export batch PNG" }));

    // Export dialog should now be open
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Export Supplier Batch PNG" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Instant Export (All Verified)" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Date Range Export" })).toBeInTheDocument();
    expect(within(dialog).getByRole("switch", { name: "Include withdraw balance" })).toBeInTheDocument();

    // Instant export action with switch ON (default)
    const instantBtn = within(dialog).getByRole("button", { name: /Instant Export All \(1\)/i });
    await user.click(instantBtn);

    expect(onExport).toHaveBeenCalledOnce();
    expect(onExport.mock.calls[0][0]).toEqual([verifiedRecord]);
    expect(onExport.mock.calls[0][3]).toHaveLength(1); // active withdrawal included
  });

  it("toggles include withdraw balance off in export dialog and exports without withdrawals", async () => {
    const user = userEvent.setup();
    const { onExport } = renderPage();

    await user.click(screen.getByRole("button", { name: "Export batch PNG" }));
    const dialog = screen.getByRole("dialog");
    const switchEl = within(dialog).getByRole("switch", { name: "Include withdraw balance" });
    expect(switchEl).toHaveAttribute("aria-checked", "true");

    // Toggle switch off
    await user.click(switchEl);
    expect(switchEl).toHaveAttribute("aria-checked", "false");

    const instantBtn = within(dialog).getByRole("button", { name: /Instant Export All \(1\)/i });
    await user.click(instantBtn);

    expect(onExport).toHaveBeenCalledOnce();
    expect(onExport.mock.calls[0][3]).toEqual([]); // empty withdrawals passed
  });

  it("initializes withdrawal form amount to 1000", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Withdraw Balance (1)" }));
    const amountInput = screen.getByPlaceholderText("1000");
    expect(amountInput).toBeInTheDocument();
    expect(amountInput).toHaveValue(1000);
  });

  it("keeps the summary visible while the grouped records workspace is loading", () => {
    renderPage({ loading: true });

    const recordsWorkspace = screen.getByRole("region", { name: "Supplier records workspace" });

    expect(screen.getByRole("heading", { name: "Verified unpaid summary" })).toBeInTheDocument();
    expect(within(recordsWorkspace).getByLabelText("Loading unpaid sales records")).toBeInTheDocument();
    expect(within(recordsWorkspace).queryByRole("button", { name: "Record sale" })).not.toBeInTheDocument();
  });

  it("uses checkbox-only verification controls without status badges", async () => {
    const user = userEvent.setup();
    const { onPatchRecord } = renderPage();
    const verifiedRow = screen.getByText("Verifiedbuyer").closest("tr");
    const reviewRow = screen.getByText("Reviewbuyer").closest("tr");
    const verifiedCheckbox = within(verifiedRow).getByRole("checkbox", { name: "Mark Verifiedbuyer verified" });
    const reviewCheckbox = within(reviewRow).getByRole("checkbox", { name: "Mark Reviewbuyer verified" });

    expect(verifiedCheckbox).toBeChecked();
    expect(reviewCheckbox).not.toBeChecked();
    expect(within(verifiedRow).queryByText("Verified", { exact: true })).not.toBeInTheDocument();
    expect(within(reviewRow).queryByText("Review", { exact: true })).not.toBeInTheDocument();

    await user.click(reviewCheckbox);

    expect(onPatchRecord).toHaveBeenCalledWith("review-row", { correct: true });
  });

  it("keeps focus while typing in inline edit fields in supplier table", async () => {
    const user = userEvent.setup();
    const handlePatch = vi.fn();
    renderPage({
      editing: { scope: "supplier", id: "verified-row" },
      onPatchRecord: handlePatch
    });

    const buyerInput = screen.getByDisplayValue("Verifiedbuyer");
    expect(buyerInput).toBeInTheDocument();

    await user.clear(buyerInput);
    await user.type(buyerInput, "NewBuyerName");

    // Verify input retains focus during continuous typing
    expect(document.activeElement).toBe(buyerInput);
    expect(buyerInput).toHaveValue("NewBuyerName");

    const saveBtn = screen.getByRole("button", { name: "Save" });
    await user.click(saveBtn);

    expect(handlePatch).toHaveBeenCalledWith(
      "verified-row",
      expect.objectContaining({
        buyerName: "NewBuyerName"
      })
    );
  });
});
