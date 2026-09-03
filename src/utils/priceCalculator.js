import { money } from "./format.js";

/**
 * Calculates two-tier sequential discounts on a price.
 * For example, an original price of 100 with 10% and 10% discounts:
 * Tier 1: 100 - 10% = 90
 * Tier 2: 90 - 10% = 81
 *
 * @param {number|string} originalPrice - The starting price
 * @param {number|string} [discount1Pct=10] - First discount percentage (default: 10)
 * @param {number|string} [discount2Pct=10] - Second discount percentage applied to discounted price (default: 10)
 * @returns {object} Calculated prices and discount amounts
 */
export function calculateTieredDiscounts(originalPrice, discount1Pct = 10, discount2Pct = 10) {
  const price = Math.max(0, Number(originalPrice) || 0);
  const d1Pct = Math.max(0, Number(discount1Pct) || 0);
  const d2Pct = Math.max(0, Number(discount2Pct) || 0);

  const discountedPrice1 = Math.round(price * (1 - d1Pct / 100) * 100) / 100;
  const discountedPrice2 = Math.round(discountedPrice1 * (1 - d2Pct / 100) * 100) / 100;

  const discount1Amount = Math.round((price - discountedPrice1) * 100) / 100;
  const discount2Amount = Math.round((discountedPrice1 - discountedPrice2) * 100) / 100;
  const totalDiscountAmount = Math.round((price - discountedPrice2) * 100) / 100;

  return {
    originalPrice: price,
    discount1Pct: d1Pct,
    discountedPrice1,
    discount1Amount,
    discount2Pct: d2Pct,
    discountedPrice2,
    discount2Amount,
    totalDiscountAmount
  };
}

/**
 * Formats a list of calculated price rows into a clean, copyable text string containing only service name and final result.
 *
 * @param {Array<{serviceName: string, originalPrice: number}>} items - List of items to format
 * @param {object} [options]
 * @param {number} [options.discount1Pct=10] - First discount %
 * @param {number} [options.discount2Pct=10] - Second discount %
 * @param {'list'|'bullet'|'table'|'dash'} [options.format='list'] - Output format style
 * @returns {string} Formatted text ready for copying to clipboard
 */
export function formatCalculationOutput(items = [], options = {}) {
  const { discount1Pct = 10, discount2Pct = 10, format = "list" } = options;
  const validItems = items.filter((item) => String(item.serviceName || "").trim() || Number(item.originalPrice) > 0);

  if (validItems.length === 0) {
    return "";
  }

  const calculatedRows = validItems.map((item) => {
    const name = String(item.serviceName || "Unnamed service").trim();
    const calculations = calculateTieredDiscounts(item.originalPrice, discount1Pct, discount2Pct);
    return { name, ...calculations };
  });

  if (format === "bullet") {
    return calculatedRows
      .map((row) => `• ${row.name}: ${money(row.discountedPrice2)}`)
      .join("\n");
  }

  if (format === "dash") {
    return calculatedRows
      .map((row) => `${row.name} - ${money(row.discountedPrice2)}`)
      .join("\n");
  }

  if (format === "table") {
    const maxNameLen = Math.max(12, ...calculatedRows.map((r) => r.name.length));
    const headerName = "Service".padEnd(maxNameLen);
    const headerFinal = "Final Price".padStart(12);

    const header = `${headerName} | ${headerFinal}`;
    const divider = "-".repeat(header.length);

    const rows = calculatedRows.map((r) => {
      const colName = r.name.padEnd(maxNameLen);
      const colFinal = money(r.discountedPrice2).padStart(12);
      return `${colName} | ${colFinal}`;
    });

    return [header, divider, ...rows].join("\n");
  }

  // Default 'list' format: "ServiceName: FinalPrice"
  return calculatedRows
    .map((row) => `${row.name}: ${money(row.discountedPrice2)}`)
    .join("\n");
}
