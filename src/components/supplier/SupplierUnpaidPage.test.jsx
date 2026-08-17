import React from "react";
import { render, screen } from "@testing-library/react";
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
  it("exports only filtered verified unpaid rows without a separate batch checkbox", async () => {
    const user = userEvent.setup();
    const { onExport } = renderPage();

    expect(screen.queryByRole("checkbox", { name: /include .* in payout batch/i })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Mark Verifiedbuyer verified" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Export batch PNG" }));

    expect(onExport).toHaveBeenCalledOnce();
    expect(onExport.mock.calls[0][0]).toEqual([verifiedRecord]);
  });
});
