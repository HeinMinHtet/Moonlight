import { dateOnly, money, today } from "./format.js";

function escapeSvg(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function svgText(value, x, y, options = {}) {
  const size = options.size || 18;
  const weight = options.weight || 400;
  const color = options.color || "#18223b";
  const anchor = options.anchor ? ` text-anchor="${options.anchor}"` : "";
  return `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}" font-family="Arial, Helvetica, sans-serif"${anchor}>${escapeSvg(value)}</text>`;
}

function truncateText(value, maxLength) {
  const text = String(value ?? "");
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function normalizedSaleDate(value) {
  const candidate = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : "";
}

export function supplierReportFilename(records) {
  const dates = records
    .filter((record) => record.correct)
    .map((record) => normalizedSaleDate(record.date))
    .filter(Boolean)
    .sort();
  const startDate = dates[0] || today();
  const lastDate = dates.at(-1) || startDate;
  return `Sale-${startDate}-${lastDate}.png`;
}

export async function exportSupplierReport(records, summary, grandTotal, options = {}) {
  const verifiedRecords = records.filter((record) => record.correct);
  if (!verifiedRecords.length) throw new Error("No verified sales are available to export.");

  const width = 1600;
  const rowHeight = 38;
  const tableTop = 238;
  const recordRowsTop = tableTop + 38;
  const summaryStart = recordRowsTop + verifiedRecords.length * rowHeight + 66;
  const summaryRowsTop = summaryStart + 74;
  const height = summaryRowsTop + Math.max(summary.length, 1) * rowHeight + 72;
  const recordColumns = [48, 118, 270, 490, 690, 780, 930, 1080, 1230];
  const summaryColumns = [48, 420, 620, 820];
  const dates = verifiedRecords.map((record) => normalizedSaleDate(record.date)).filter(Boolean).sort();
  const startDate = dates[0] || today();
  const lastDate = dates.at(-1) || startDate;
  const dateRange = startDate === lastDate ? startDate : `${startDate} to ${lastDate}`;
  const title = options.title || "Verified Supplier Sales";
  const totalLabel = options.totalLabel || "Verified unpaid total";
  const batchLabel = options.batchLabel || "";

  const recordRows = verifiedRecords.map((record, index) => {
    const y = recordRowsTop + index * rowHeight;
    const fill = index % 2 ? "#eaf0fa" : "#f8faff";
    return `
      <rect x="32" y="${y}" width="1536" height="${rowHeight}" fill="${fill}" />
      ${svgText(index + 1, recordColumns[0], y + 25, { size: 15, weight: 700 })}
      ${svgText(dateOnly(record.date), recordColumns[1], y + 25, { size: 15 })}
      ${svgText(truncateText(record.buyerName, 22), recordColumns[2], y + 25, { size: 15, weight: 700 })}
      ${svgText(truncateText(record.serviceType, 22), recordColumns[3], y + 25, { size: 15 })}
      ${svgText(money(record.quantity), recordColumns[4], y + 25, { size: 15 })}
      ${svgText(money(record.rateAtRecord), recordColumns[5], y + 25, { size: 15 })}
      ${svgText(truncateText(record.armorType, 16), recordColumns[6], y + 25, { size: 15 })}
      ${svgText(money(record.totalCost), recordColumns[7], y + 25, { size: 15, weight: 800, color: "#2b4c84" })}
      ${svgText(truncateText(record.note || "-", 38), recordColumns[8], y + 25, { size: 14, color: "#61708d" })}
    `;
  }).join("");

  const summaryRows = summary.map((row, index) => {
    const y = summaryRowsTop + index * rowHeight;
    const fill = index % 2 ? "#eaf0fa" : "#f8faff";
    return `
      <rect x="32" y="${y}" width="900" height="${rowHeight}" fill="${fill}" />
      ${svgText(truncateText(row.type, 34), summaryColumns[0], y + 25, { size: 15, weight: 700 })}
      ${svgText(money(row.totalQty), summaryColumns[1], y + 25, { size: 15 })}
      ${svgText(money(row.price), summaryColumns[2], y + 25, { size: 15 })}
      ${svgText(money(row.totalCost), summaryColumns[3], y + 25, { size: 15, weight: 800, color: "#2b4c84" })}
    `;
  }).join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="#080d20" />
      <rect x="20" y="20" width="1560" height="${height - 40}" rx="8" fill="#f4f7fc" stroke="#8fb9ff" stroke-width="2" />
      <rect x="20" y="20" width="1560" height="104" rx="8" fill="#111937" />
      ${svgText("MOONLIGHT WOW OPERATIONS", 48, 52, { size: 13, weight: 800, color: "#8fb9ff" })}
      ${svgText(title, 48, 92, { size: 32, weight: 800, color: "#edf4ff" })}
      ${batchLabel ? svgText(truncateText(batchLabel, 48), 1552, 86, { size: 15, weight: 700, color: "#bdcbe1", anchor: "end" }) : ""}

      <rect x="32" y="140" width="430" height="72" rx="6" fill="#ffffff" stroke="#c9d4e7" />
      ${svgText("SALE DATE RANGE", 52, 166, { size: 12, weight: 800, color: "#61708d" })}
      ${svgText(dateRange, 52, 196, { size: 21, weight: 800, color: "#2b4c84" })}
      <rect x="478" y="140" width="250" height="72" rx="6" fill="#ffffff" stroke="#c9d4e7" />
      ${svgText("VERIFIED ROWS", 498, 166, { size: 12, weight: 800, color: "#61708d" })}
      ${svgText(verifiedRecords.length, 498, 196, { size: 21, weight: 800, color: "#2b4c84" })}
      <rect x="744" y="140" width="808" height="72" rx="6" fill="#ffffff" stroke="#c9d4e7" />
      ${svgText(totalLabel.toLocaleUpperCase(), 764, 166, { size: 12, weight: 800, color: "#61708d" })}
      ${svgText(money(grandTotal), 1532, 197, { size: 27, weight: 800, color: "#285e54", anchor: "end" })}

      <rect x="32" y="${tableTop}" width="1536" height="38" fill="#111937" />
      ${svgText("#", recordColumns[0], tableTop + 25, { size: 13, weight: 800, color: "#edf4ff" })}
      ${svgText("Date", recordColumns[1], tableTop + 25, { size: 13, weight: 800, color: "#edf4ff" })}
      ${svgText("Buyer", recordColumns[2], tableTop + 25, { size: 13, weight: 800, color: "#edf4ff" })}
      ${svgText("Service", recordColumns[3], tableTop + 25, { size: 13, weight: 800, color: "#edf4ff" })}
      ${svgText("Qty", recordColumns[4], tableTop + 25, { size: 13, weight: 800, color: "#edf4ff" })}
      ${svgText("Saved rate", recordColumns[5], tableTop + 25, { size: 13, weight: 800, color: "#edf4ff" })}
      ${svgText("Armor", recordColumns[6], tableTop + 25, { size: 13, weight: 800, color: "#edf4ff" })}
      ${svgText("Amount", recordColumns[7], tableTop + 25, { size: 13, weight: 800, color: "#edf4ff" })}
      ${svgText("Note", recordColumns[8], tableTop + 25, { size: 13, weight: 800, color: "#edf4ff" })}
      ${recordRows}

      ${svgText("Verified sales summary", 48, summaryStart + 30, { size: 23, weight: 800 })}
      <rect x="32" y="${summaryStart + 40}" width="900" height="34" fill="#192447" />
      ${svgText("Service", summaryColumns[0], summaryStart + 63, { size: 13, weight: 800, color: "#edf4ff" })}
      ${svgText("Total qty", summaryColumns[1], summaryStart + 63, { size: 13, weight: 800, color: "#edf4ff" })}
      ${svgText("Rate", summaryColumns[2], summaryStart + 63, { size: 13, weight: 800, color: "#edf4ff" })}
      ${svgText("Amount", summaryColumns[3], summaryStart + 63, { size: 13, weight: 800, color: "#edf4ff" })}
      ${summaryRows}

      <rect x="980" y="${summaryStart + 40}" width="572" height="${Math.max(112, summary.length * rowHeight + 34)}" rx="6" fill="#111937" />
      ${svgText("NET SUPPLIER TOTAL", 1012, summaryStart + 78, { size: 13, weight: 800, color: "#8fb9ff" })}
      ${svgText(money(grandTotal), 1520, summaryStart + 126, { size: 32, weight: 800, color: "#edf4ff", anchor: "end" })}
    </svg>
  `;

  const image = new Image();
  image.decoding = "async";
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not create the sales report image.");
  context.drawImage(image, 0, 0);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Your browser could not save the sales report image.");
  const imageUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = supplierReportFilename(verifiedRecords);
  link.href = imageUrl;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
}
