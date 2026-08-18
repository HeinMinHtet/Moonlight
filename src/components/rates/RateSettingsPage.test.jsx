import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RateSettingsPage } from "./RateSettingsPage.jsx";

const mockSupplierServices = [
  { type: "Achievement", price: 1120, active: true, isDefault: true },
  { type: "M0 Bundle", price: 500, active: true, isDefault: false },
  { type: "Unused Service", price: 100, active: true, isDefault: false },
  { type: "Legacy Raid", price: 200, active: false, isDefault: false }
];

const mockBoosterPrices = [
  { level: "10", price: 200, active: true, isDefault: false },
  { level: "M15", price: 400, active: true, isDefault: true }
];

const mockSupplierRecords = [
  { id: "s1", serviceType: "Achievement", rateAtRecord: 1120 },
  { id: "s2", serviceType: "M0 Bundle", rateAtRecord: 500 },
  { id: "s3", serviceType: "Legacy Raid", rateAtRecord: 200 }
];

const mockBoosterRecords = [
  { id: "b1", level: "M15", payout: 400 }
];

function renderPage(overrides = {}) {
  const props = {
    isAdmin: true,
    loading: false,
    loadError: "",
    canEditPrices: true,
    supplierServices: mockSupplierServices,
    boosterPrices: mockBoosterPrices,
    supplierRecords: mockSupplierRecords,
    boosterRecords: mockBoosterRecords,
    onAddPriceRow: vi.fn(),
    onTogglePriceRow: vi.fn(),
    onDeletePriceRow: vi.fn(),
    onSetDefaultPriceRow: vi.fn(),
    onUpdatePriceRow: vi.fn(),
    onSaveSupplierPrices: vi.fn((e) => e.preventDefault()),
    onSaveBoosterPrices: vi.fn((e) => e.preventDefault()),
    ...overrides
  };

  render(<RateSettingsPage {...props} />);
  return props;
}

describe("RateSettingsPage", () => {
  it("renders compact panels for supplier and booster rates with table headers", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Default rates" })).toBeInTheDocument();
    expect(screen.getByText("Admin controls")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Supplier sale rates" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Booster payout rates" })).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Add service" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add key level" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save supplier defaults" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save booster defaults" })).toBeInTheDocument();
  });

  it("shows active rates by default and switches to archived rates on tab click", async () => {
    const user = userEvent.setup();
    renderPage();

    // Active rates for supplier should show Achievement, M0 Bundle, Unused Service
    expect(screen.getByDisplayValue("Achievement")).toBeInTheDocument();
    expect(screen.getByDisplayValue("M0 Bundle")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Unused Service")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Legacy Raid")).not.toBeInTheDocument();

    // Click Archived tab on supplier panel
    const supplierForm = screen.getByRole("heading", { name: "Supplier sale rates" }).closest("form");
    const archivedTab = within(supplierForm).getByRole("button", { name: /Archived/i });
    await user.click(archivedTab);

    // Archived view should show Legacy Raid
    expect(within(supplierForm).getByDisplayValue("Legacy Raid")).toBeInTheDocument();
    expect(within(supplierForm).getByRole("button", { name: "Restore" })).toBeInTheDocument();
  });

  it("calls onSetDefaultPriceRow when clicking the star default button", async () => {
    const user = userEvent.setup();
    const props = renderPage();

    const starButton = screen.getByRole("button", { name: "Set M0 Bundle as default" });
    await user.click(starButton);

    expect(props.onSetDefaultPriceRow).toHaveBeenCalledWith("supplierServices", 1);
  });

  it("calls onUpdatePriceRow when editing service name and rate inputs", () => {
    const props = renderPage();

    const achievementInput = screen.getByDisplayValue("Achievement");
    fireEvent.change(achievementInput, { target: { value: "Achievement Updated" } });

    expect(props.onUpdatePriceRow).toHaveBeenCalledWith(
      "supplierServices",
      0,
      { type: "Achievement Updated" }
    );

    const priceInput = screen.getByDisplayValue("1120");
    fireEvent.change(priceInput, { target: { value: "1200" } });

    expect(props.onUpdatePriceRow).toHaveBeenCalledWith(
      "supplierServices",
      0,
      { price: 1200 }
    );
  });

  it("calls onAddPriceRow when clicking Add service", async () => {
    const user = userEvent.setup();
    const props = renderPage();

    const addServiceBtn = screen.getByRole("button", { name: "Add service" });
    await user.click(addServiceBtn);

    expect(props.onAddPriceRow).toHaveBeenCalledWith("supplierServices", "type");
  });

  it("calls onTogglePriceRow when archiving an active rate", async () => {
    const user = userEvent.setup();
    const props = renderPage();

    const archiveButtons = screen.getAllByRole("button", { name: "Archive" });
    await user.click(archiveButtons[0]);

    expect(props.onTogglePriceRow).toHaveBeenCalledWith("supplierServices", 0);
  });

  it("renders delete button only for unused rates and calls onDeletePriceRow when clicked", async () => {
    const user = userEvent.setup();
    const props = renderPage();

    // Achievement and M0 Bundle have historical records, Unused Service has 0 records
    const deleteButton = screen.getByRole("button", { name: "Delete Unused Service" });
    expect(deleteButton).toBeInTheDocument();

    await user.click(deleteButton);
    expect(props.onDeletePriceRow).toHaveBeenCalledWith("supplierServices", 2);
  });

  it("disables save button and displays duplicate warning when duplicate names exist", () => {
    renderPage({
      supplierServices: [
        { type: "Achievement", price: 100, active: true },
        { type: "achievement", price: 200, active: true }
      ]
    });

    const supplierForm = screen.getByRole("heading", { name: "Supplier sale rates" }).closest("form");
    expect(within(supplierForm).getByText("Duplicate service names found")).toBeInTheDocument();
    expect(within(supplierForm).getByRole("button", { name: "Save supplier defaults" })).toBeDisabled();
  });
});
