import test from "node:test";
import assert from "node:assert/strict";
import { buildSupplierReportSvg, supplierReportFilename } from "../src/utils/exportSupplierReport.js";

const mockSales = [
  {
    id: "s1",
    date: "2026-08-20",
    buyerName: "AlphaBuyer",
    serviceType: "Mythic+",
    quantity: 2,
    rateAtRecord: 100,
    armorType: "Cloth",
    correct: true,
    totalCost: 200,
    note: "VIP run"
  },
  {
    id: "s2",
    date: "2026-08-21",
    buyerName: "BetaBuyer",
    serviceType: "Raid",
    quantity: 1,
    rateAtRecord: 300,
    armorType: "Plate",
    correct: true,
    totalCost: 300,
    note: ""
  }
];

const mockSummary = [
  { type: "Mythic+", totalQty: 2, price: 100, totalCost: 200 },
  { type: "Raid", totalQty: 1, price: 300, totalCost: 300 }
];

test("buildSupplierReportSvg includes pre-withdraw table and final price breakdown when prewithdrawals exist", () => {
  const mockWithdrawals = [
    {
      id: "w1",
      date: "2026-08-19",
      charName: "BankerOne",
      guild: "Main Guild",
      amount: 100,
      note: "Gold advance for pots"
    },
    {
      id: "w2",
      date: "2026-08-20",
      charName: "BankerTwo",
      guild: "Alt Guild",
      amount: 50,
      note: "Repair gold"
    }
  ];

  const result = buildSupplierReportSvg(mockSales, mockSummary, 500, {
    withdrawals: mockWithdrawals
  });

  assert.equal(result.hasWithdrawals, true);
  assert.equal(result.prewithdrawTotal, 150);
  assert.equal(result.finalPrice, 350); // 500 - 150 = 350

  // SVG structure assertions
  assert.ok(result.svg.includes("Pre-withdraw Balance / Advances"), "Should include Pre-withdraw section header");
  assert.ok(result.svg.includes("BankerOne"), "Should include withdrawal charName");
  assert.ok(result.svg.includes("Main Guild"), "Should include withdrawal guild");
  assert.ok(result.svg.includes("BankerTwo"), "Should include second withdrawal");
  assert.ok(result.svg.includes("Gold advance for pots"), "Should include withdrawal note");

  // Summary Card assertions
  assert.ok(result.svg.includes("SALES TOTAL"), "Should include SALES TOTAL label");
  assert.ok(result.svg.includes("500"), "Should include grand total");
  assert.ok(result.svg.includes("PRE-WITHDRAW DEDUCTED"), "Should include PRE-WITHDRAW DEDUCTED label");
  assert.ok(result.svg.includes("-150"), "Should include pre-withdraw deducted amount");
  assert.ok(result.svg.includes("FINAL PRICE"), "Should include FINAL PRICE label");
  assert.ok(result.svg.includes("350"), "Should include final price amount");
});

test("buildSupplierReportSvg omits pre-withdraw table when withdrawals balance is 0 or empty", () => {
  // Case A: empty withdrawals array
  const resultEmpty = buildSupplierReportSvg(mockSales, mockSummary, 500, {
    withdrawals: []
  });

  assert.equal(resultEmpty.hasWithdrawals, false);
  assert.equal(resultEmpty.prewithdrawTotal, 0);
  assert.equal(resultEmpty.finalPrice, 500);
  assert.ok(!resultEmpty.svg.includes("Pre-withdraw Balance / Advances"), "Should NOT include Pre-withdraw table when empty");
  assert.ok(resultEmpty.svg.includes("FINAL PRICE"), "Should include FINAL PRICE label");
  assert.ok(resultEmpty.svg.includes("500"), "Should include final price equal to grandTotal");

  // Case B: withdrawals with 0 amount
  const resultZero = buildSupplierReportSvg(mockSales, mockSummary, 500, {
    withdrawals: [{ charName: "ZeroGuy", amount: 0 }]
  });

  assert.equal(resultZero.hasWithdrawals, false);
  assert.equal(resultZero.prewithdrawTotal, 0);
  assert.equal(resultZero.finalPrice, 500);
  assert.ok(!resultZero.svg.includes("Pre-withdraw Balance / Advances"), "Should NOT include Pre-withdraw table when balance is 0");
});

test("buildSupplierReportSvg handles deficit when prewithdrawals exceed sales total", () => {
  const largeWithdrawals = [
    {
      id: "w3",
      date: "2026-08-19",
      charName: "BigBorrower",
      guild: "Main Guild",
      amount: 800,
      note: "Huge loan"
    }
  ];

  const result = buildSupplierReportSvg(mockSales, mockSummary, 500, {
    withdrawals: largeWithdrawals
  });

  assert.equal(result.hasWithdrawals, true);
  assert.equal(result.prewithdrawTotal, 800);
  assert.equal(result.finalPrice, -300); // 500 - 800 = -300
  assert.ok(result.svg.includes("BigBorrower"));
  assert.ok(result.svg.includes("-300"));
});

test("buildSupplierReportSvg throws if no verified records exist", () => {
  assert.throws(() => {
    buildSupplierReportSvg([{ correct: false }], mockSummary, 0);
  }, /No verified sales are available to export/);
});
