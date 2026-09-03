import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { PriceCalculatorPage } from "./PriceCalculatorPage.jsx";

describe("PriceCalculatorPage", () => {
  let writeTextSpy;

  beforeEach(() => {
    writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextSpy
      },
      writable: true,
      configurable: true
    });
  });

  it("blocks non-admin users with AccessDenied", () => {
    render(<PriceCalculatorPage isAdmin={false} />);
    expect(screen.getByText(/admin access required/i)).toBeInTheDocument();
    expect(screen.queryByText("Price Calculator")).not.toBeInTheDocument();
  });

  it("renders page header, tiered calculation example (100 -> 90 -> 81), and copyable box", () => {
    render(<PriceCalculatorPage isAdmin />);

    expect(screen.getByRole("heading", { name: "Price Calculator" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("100")).toBeInTheDocument();
    expect(screen.getByText("90")).toBeInTheDocument();
    expect(screen.getByText("81")).toBeInTheDocument();

    const textarea = screen.getByRole("textbox", { name: "Copyable price calculation results" });
    expect(textarea).toBeInTheDocument();
    expect(textarea.value).toContain("Mythic+ 10: 81");
    expect(textarea.value).not.toContain("%");
  });

  it("allows adding a new service row and calculating live results", async () => {
    const user = userEvent.setup();
    render(<PriceCalculatorPage isAdmin />);

    await user.click(screen.getByRole("button", { name: /add service/i }));

    const serviceInputs = screen.getAllByRole("textbox", { name: "Service name" });
    const newServiceInput = serviceInputs[serviceInputs.length - 1];
    await user.type(newServiceInput, "New Boost Service");

    const priceInputs = screen.getAllByRole("spinbutton", { name: "Original price" });
    const newPriceInput = priceInputs[priceInputs.length - 1];
    await user.type(newPriceInput, "500");

    // 500 -> 450 (-10%) -> 405 (-10% extra)
    expect(screen.getByText("450")).toBeInTheDocument();
    expect(screen.getByText("405")).toBeInTheDocument();

    const textarea = screen.getByRole("textbox", { name: "Copyable price calculation results" });
    expect(textarea.value).toContain("New Boost Service: 405");
  });

  it("allows deleting a service row", async () => {
    const user = userEvent.setup();
    render(<PriceCalculatorPage isAdmin />);

    const deleteButtons = screen.getAllByRole("button", { name: "Delete service row" });
    const initialCount = deleteButtons.length;
    await user.click(deleteButtons[0]);

    expect(screen.getAllByRole("button", { name: "Delete service row" })).toHaveLength(initialCount - 1);
  });

  it("copies formatted text to clipboard when clicking Copy all results", async () => {
    render(<PriceCalculatorPage isAdmin />);

    const copyBtn = screen.getByRole("button", { name: /copy all results/i });
    fireEvent.click(copyBtn);

    expect(writeTextSpy).toHaveBeenCalledWith(expect.stringContaining("Mythic+ 10: 81"));
    expect(await screen.findByRole("button", { name: /copied!/i })).toBeInTheDocument();
  });

  it("imports active default rates when clicking Import Default Rates", async () => {
    const user = userEvent.setup();
    const defaultServices = [
      { type: "M+ 15 Timed", price: 600, active: true },
      { type: "Mythic Raid Wing", price: 1200, active: true },
      { type: "Archived Service", price: 400, active: false }
    ];

    render(<PriceCalculatorPage isAdmin supplierServices={defaultServices} />);

    await user.click(screen.getByRole("button", { name: /import default rates/i }));

    expect(screen.getByDisplayValue("M+ 15 Timed")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Mythic Raid Wing")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Archived Service")).not.toBeInTheDocument();

    // 600 -> 540 -> 486
    expect(screen.getByText("540")).toBeInTheDocument();
    expect(screen.getByText("486")).toBeInTheDocument();
  });
});
