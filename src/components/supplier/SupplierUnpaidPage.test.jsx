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
  note: ""
};

const reviewRecord = {
  ...verifiedRecord,
  id: "review-row",
  buyerName: "Reviewbuyer",
  correct: false,
  totalCost: 200
};

function renderPage(overrides = {}) {
  const props = {
    isAdmin: true,
    loading: false,
    loadError: "",
    records: [verifiedRecord, reviewRecord],
    services: [{ type: "Mythic+", price: 100, active: true }],
    armorTypes: ["Cloth"],
    paidHistory: [],
    permissions: {
      canUseSupplier: true,
      canMarkSupplierPaid: true,
      canEditSupplierStatus: true,
      canDeleteSupplierRows: true
    },
    editing: null,
    formKey: 0,
    onSubmitRecord: vi.fn((event) => event.preventDefault()),
    onPatchRecord: vi.fn(),
    onDeleteRecord: vi.fn(),
    onSetEditing: vi.fn(),
    onExport: vi.fn(),
    onMarkPaid: vi.fn(),
    ...overrides
  };

  render(<SupplierUnpaidPage {...props} />);
  return props;
}

describe("SupplierUnpaidPage", () => {
  it("places the batch actions in the summary and removes the page header and filters", () => {
    renderPage();

    const summaryPanel = screen.getByRole("heading", { name: "Verified unpaid total" }).closest("aside");
    const recordsWorkspace = screen.getByRole("region", { name: "Supplier records workspace" });

    expect(screen.queryByRole("heading", { name: "Unpaid sales records" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Supplier record filters")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
    expect(summaryPanel?.nextElementSibling).toBe(recordsWorkspace);
    expect(within(summaryPanel).getByRole("button", { name: "Export batch PNG" })).toBeInTheDocument();
    expect(within(summaryPanel).getByRole("button", { name: "Mark batch paid" })).toBeInTheDocument();
    expect(within(summaryPanel).getByText("2 unpaid")).toBeInTheDocument();
    expect(within(recordsWorkspace).getByRole("button", { name: "Record sale" })).toBeInTheDocument();
    expect(within(recordsWorkspace).getByRole("columnheader", { name: "Buyer" })).toBeInTheDocument();
  });

  it("keeps the summary visible while the grouped records workspace is loading", () => {
    renderPage({ loading: true });

    const recordsWorkspace = screen.getByRole("region", { name: "Supplier records workspace" });

    expect(screen.getByRole("heading", { name: "Verified unpaid total" })).toBeInTheDocument();
    expect(within(recordsWorkspace).getByLabelText("Loading unpaid sales records")).toBeInTheDocument();
    expect(within(recordsWorkspace).queryByRole("button", { name: "Record sale" })).not.toBeInTheDocument();
  });

  it("exports all verified unpaid rows without a separate batch checkbox", async () => {
    const user = userEvent.setup();
    const { onExport } = renderPage();

    expect(screen.queryByRole("checkbox", { name: /include .* in payout batch/i })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Mark Verifiedbuyer verified" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Export batch PNG" }));

    expect(onExport).toHaveBeenCalledOnce();
    expect(onExport.mock.calls[0][0]).toEqual([verifiedRecord]);
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
});
