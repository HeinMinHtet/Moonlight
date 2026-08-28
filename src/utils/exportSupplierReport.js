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
  const size = options.size || 15;
  const weight = options.weight || 400;
  const color = options.color || "#e2e8f0";
  const anchor = options.anchor ? ` text-anchor="${options.anchor}"` : "";
  const isMono = options.mono ? ` font-family="'Cascadia Code', 'JetBrains Mono', Consolas, 'Courier New', monospace"` : ` font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"`;
  return `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}"${isMono}${anchor}>${escapeSvg(value)}</text>`;
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

export function buildSupplierReportSvg(records, summary, grandTotal, options = {}) {
  const verifiedRecords = records.filter((record) => record.correct);
  if (!verifiedRecords.length) throw new Error("No verified sales are available to export.");

  const rawWithdrawals = Array.isArray(options.withdrawals) ? options.withdrawals : [];
  const withdrawals = rawWithdrawals.filter((w) => Number(w.amount || 0) > 0);
  const prewithdrawTotal = withdrawals.reduce((sum, w) => sum + Number(w.amount || 0), 0);
  const hasWithdrawals = withdrawals.length > 0 && prewithdrawTotal > 0;
  const finalPrice = grandTotal - prewithdrawTotal;

  const width = 1600;
  const rowHeight = 36;
  const tableTop = 100;
  const recordRowsTop = tableTop + 38;
  const recordColumns = [52, 106, 224, 450, 690, 840, 890, 1110, 1150];
  const summaryColumns = [52, 470, 670, 890];
  const withdrawalColumns = [52, 106, 260, 520, 780, 820];

  const dates = verifiedRecords.map((record) => normalizedSaleDate(record.date)).filter(Boolean).sort();
  const startDate = dates[0] || today();
  const lastDate = dates.at(-1) || startDate;
  const dateRange = startDate === lastDate ? startDate : `${startDate} to ${lastDate}`;
  const batchLabel = options.batchLabel || "";

  const recordRows = verifiedRecords.map((record, index) => {
    const y = recordRowsTop + index * rowHeight;
    const fill = index % 2 ? "#0e1726" : "#121d30";
    return `
      <rect x="32" y="${y}" width="1536" height="${rowHeight}" fill="${fill}" />
      <line x1="32" y1="${y + rowHeight}" x2="1568" y2="${y + rowHeight}" stroke="#1e2d42" stroke-width="0.75" />
      ${svgText(index + 1, recordColumns[0], y + 23, { size: 13, weight: 600, color: "#64748b" })}
      ${svgText(dateOnly(record.date), recordColumns[1], y + 23, { size: 13, color: "#94a3b8" })}
      ${svgText(truncateText(record.buyerName, 22), recordColumns[2], y + 23, { size: 14, weight: 700, color: "#f8fafc" })}
      ${svgText(truncateText(record.serviceType, 22), recordColumns[3], y + 23, { size: 14, color: "#e2e8f0" })}
      ${svgText(money(record.quantity), recordColumns[4], y + 23, { size: 14, color: "#e2e8f0", anchor: "end", mono: true })}
      ${svgText(money(record.rateAtRecord), recordColumns[5], y + 23, { size: 14, color: "#cbd5e1", anchor: "end", mono: true })}
      ${svgText(truncateText(record.armorType, 16), recordColumns[6], y + 23, { size: 13, color: "#94a3b8" })}
      ${svgText(money(record.totalCost), recordColumns[7], y + 23, { size: 14, weight: 800, color: "#38bdf8", anchor: "end", mono: true })}
      ${svgText(truncateText(record.note || "-", 38), recordColumns[8], y + 23, { size: 13, color: "#64748b" })}
    `;
  }).join("");

  let currentY = recordRowsTop + verifiedRecords.length * rowHeight;
  let withdrawalSectionHtml = "";

  if (hasWithdrawals) {
    const withdrawalStart = currentY + 36;
    const withdrawalHeaderTop = withdrawalStart + 32;
    const withdrawalRowsTop = withdrawalStart + 66;

    const wRows = withdrawals.map((w, index) => {
      const y = withdrawalRowsTop + index * rowHeight;
      const fill = index % 2 ? "#141120" : "#181426";
      return `
        <rect x="32" y="${y}" width="1536" height="${rowHeight}" fill="${fill}" />
        <line x1="32" y1="${y + rowHeight}" x2="1568" y2="${y + rowHeight}" stroke="#2a1f38" stroke-width="0.75" />
        ${svgText(index + 1, withdrawalColumns[0], y + 23, { size: 13, weight: 600, color: "#64748b" })}
        ${svgText(dateOnly(w.date), withdrawalColumns[1], y + 23, { size: 13, color: "#94a3b8" })}
        ${svgText(truncateText(w.charName, 26), withdrawalColumns[2], y + 23, { size: 14, weight: 700, color: "#f8fafc" })}
        ${svgText(truncateText(w.guild, 26), withdrawalColumns[3], y + 23, { size: 14, color: "#cbd5e1" })}
        ${svgText(`-${money(w.amount)}`, withdrawalColumns[4], y + 23, { size: 14, weight: 800, color: "#f59e0b", anchor: "end", mono: true })}
        ${svgText(truncateText(w.note || "-", 60), withdrawalColumns[5], y + 23, { size: 13, color: "#94a3b8" })}
      `;
    }).join("");

    withdrawalSectionHtml = `
      <!-- Pre-withdraw Balance Section Header -->
      ${svgText("Pre-withdraw Balance / Advances", 48, withdrawalStart + 20, { size: 16, weight: 800, color: "#f59e0b" })}
      ${svgText(`•  ${withdrawals.length} record${withdrawals.length === 1 ? "" : "s"}  •  Total Offset: -${money(prewithdrawTotal)}`, 360, withdrawalStart + 20, { size: 13, weight: 600, color: "#94a3b8" })}

      <!-- Pre-withdraw Table Header -->
      <rect x="32" y="${withdrawalHeaderTop}" width="1536" height="34" rx="6" fill="#241a30" />
      ${svgText("#", withdrawalColumns[0], withdrawalHeaderTop + 23, { size: 12, weight: 800, color: "#c084fc" })}
      ${svgText("DATE", withdrawalColumns[1], withdrawalHeaderTop + 23, { size: 12, weight: 800, color: "#c084fc" })}
      ${svgText("CHARACTER", withdrawalColumns[2], withdrawalHeaderTop + 23, { size: 12, weight: 800, color: "#c084fc" })}
      ${svgText("GUILD", withdrawalColumns[3], withdrawalHeaderTop + 23, { size: 12, weight: 800, color: "#c084fc" })}
      ${svgText("AMOUNT", withdrawalColumns[4], withdrawalHeaderTop + 23, { size: 12, weight: 800, color: "#c084fc", anchor: "end" })}
      ${svgText("NOTE", withdrawalColumns[5], withdrawalHeaderTop + 23, { size: 12, weight: 800, color: "#c084fc" })}

      <!-- Pre-withdraw Rows -->
      ${wRows}
    `;

    currentY = withdrawalRowsTop + withdrawals.length * rowHeight;
  }

  const summaryStart = currentY + 36;
  const summaryRowsTop = summaryStart + 66;
  const summaryCount = Math.max(summary.length, 1);

  const summaryRows = summary.map((row, index) => {
    const y = summaryRowsTop + index * rowHeight;
    const fill = index % 2 ? "#0e1726" : "#121d30";
    return `
      <rect x="32" y="${y}" width="910" height="${rowHeight}" fill="${fill}" />
      <line x1="32" y1="${y + rowHeight}" x2="942" y2="${y + rowHeight}" stroke="#1e2d42" stroke-width="0.75" />
      ${svgText(truncateText(row.type, 34), summaryColumns[0], y + 23, { size: 14, weight: 700, color: "#f8fafc" })}
      ${svgText(money(row.totalQty), summaryColumns[1], y + 23, { size: 14, color: "#e2e8f0", anchor: "end", mono: true })}
      ${svgText(money(row.price), summaryColumns[2], y + 23, { size: 14, color: "#cbd5e1", anchor: "end", mono: true })}
      ${svgText(money(row.totalCost), summaryColumns[3], y + 23, { size: 14, weight: 800, color: "#38bdf8", anchor: "end", mono: true })}
    `;
  }).join("");

  const totalLabel = options.totalLabel || "FINAL SETTLED AMOUNT";
  const summaryTitle = options.summaryTitle || "Sale Summary";

  let netTotalCardContent = "";
  let netTotalCardHeight = 0;

  if (hasWithdrawals) {
    netTotalCardHeight = Math.max(154, summaryCount * rowHeight + 34);
    netTotalCardContent = `
      <!-- Sales Total Line -->
      ${svgText("SALES TOTAL", 996, summaryStart + 60, { size: 12, weight: 700, color: "#94a3b8" })}
      ${svgText(money(grandTotal), 1540, summaryStart + 60, { size: 16, weight: 800, color: "#38bdf8", anchor: "end", mono: true })}

      <!-- Pre-withdraw Line -->
      ${svgText("WITHDRAW BALANCE DEDUCTED", 996, summaryStart + 86, { size: 12, weight: 700, color: "#f59e0b" })}
      ${svgText(`-${money(prewithdrawTotal)}`, 1540, summaryStart + 86, { size: 16, weight: 800, color: "#f59e0b", anchor: "end", mono: true })}

      <!-- Divider -->
      <line x1="996" y1="${summaryStart + 100}" x2="1540" y2="${summaryStart + 100}" stroke="#334155" stroke-width="1" stroke-dasharray="4" />

      <!-- Final Settled Amount Line -->
      ${svgText(totalLabel.toUpperCase(), 996, summaryStart + 126, { size: 13, weight: 800, color: "#94a3b8" })}
      ${svgText(`${dateRange}  •  ${verifiedRecords.length} records`, 996, summaryStart + 146, { size: 11, weight: 600, color: "#64748b" })}
      ${svgText(money(finalPrice), 1540, summaryStart + 140, { size: 36, weight: 900, color: finalPrice >= 0 ? "#38bdf8" : "#fb7185", anchor: "end", mono: true })}
    `;
  } else {
    netTotalCardHeight = Math.max(98, summaryCount * rowHeight + 32);
    netTotalCardContent = `
      ${svgText(totalLabel.toUpperCase(), 996, summaryStart + 66, { size: 12, weight: 800, color: "#94a3b8" })}
      ${svgText(`${dateRange}  •  ${verifiedRecords.length} records`, 996, summaryStart + 90, { size: 12, weight: 600, color: "#64748b" })}
      ${svgText(money(finalPrice), 1540, summaryStart + 86, { size: 38, weight: 800, color: "#38bdf8", anchor: "end", mono: true })}
    `;
  }

  const bottomHeight = Math.max(summaryCount * rowHeight + 66, netTotalCardHeight + 32);
  const height = summaryStart + bottomHeight + 24;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0f1e36" />
          <stop offset="100%" stop-color="#162744" />
        </linearGradient>
        <linearGradient id="totalCardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0e1f38" />
          <stop offset="100%" stop-color="#142646" />
        </linearGradient>
      </defs>

      <!-- Background Canvas -->
      <rect width="100%" height="100%" fill="#070c18" />
      <rect x="18" y="18" width="1564" height="${height - 36}" rx="12" fill="#0b1322" stroke="#1a2b42" stroke-width="1.5" />

      <!-- Top Header Bar -->
      <rect x="24" y="24" width="1552" height="60" rx="8" fill="url(#headerGrad)" stroke="#1e354e" stroke-width="1" />
      ${svgText("MOONLIGHT WOW", 48, 54, { size: 20, weight: 800, color: "#38bdf8" })}
      ${svgText(`•  ${dateRange}  •  ${verifiedRecords.length} Verified Records`, 255, 54, { size: 13, weight: 600, color: "#94a3b8" })}
      ${batchLabel ? svgText(truncateText(batchLabel, 48), 1548, 54, { size: 13, weight: 600, color: "#cbd5e1", anchor: "end" }) : ""}

      <!-- Main Records Table Header -->
      <rect x="32" y="${tableTop}" width="1536" height="38" rx="6" fill="#182744" />
      ${svgText("#", recordColumns[0], tableTop + 24, { size: 12, weight: 800, color: "#94a3b8" })}
      ${svgText("DATE", recordColumns[1], tableTop + 24, { size: 12, weight: 800, color: "#94a3b8" })}
      ${svgText("BUYER", recordColumns[2], tableTop + 24, { size: 12, weight: 800, color: "#94a3b8" })}
      ${svgText("SERVICE", recordColumns[3], tableTop + 24, { size: 12, weight: 800, color: "#94a3b8" })}
      ${svgText("QTY", recordColumns[4], tableTop + 24, { size: 12, weight: 800, color: "#94a3b8", anchor: "end" })}
      ${svgText("SAVED RATE", recordColumns[5], tableTop + 24, { size: 12, weight: 800, color: "#94a3b8", anchor: "end" })}
      ${svgText("ARMOR", recordColumns[6], tableTop + 24, { size: 12, weight: 800, color: "#94a3b8" })}
      ${svgText("AMOUNT", recordColumns[7], tableTop + 24, { size: 12, weight: 800, color: "#94a3b8", anchor: "end" })}
      ${svgText("NOTE", recordColumns[8], tableTop + 24, { size: 12, weight: 800, color: "#94a3b8" })}

      <!-- Main Records Rows -->
      ${recordRows}

      <!-- Pre-withdraw Section (if active withdrawals exist) -->
      ${withdrawalSectionHtml}

      <!-- Bottom Summary Header -->
      ${svgText(summaryTitle, 48, summaryStart + 20, { size: 16, weight: 800, color: "#f1f5f9" })}
      <rect x="32" y="${summaryStart + 32}" width="910" height="34" rx="6" fill="#182744" />
      ${svgText("SERVICE", summaryColumns[0], summaryStart + 54, { size: 12, weight: 800, color: "#94a3b8" })}
      ${svgText("TOTAL QTY", summaryColumns[1], summaryStart + 54, { size: 12, weight: 800, color: "#94a3b8", anchor: "end" })}
      ${svgText("RATE", summaryColumns[2], summaryStart + 54, { size: 12, weight: 800, color: "#94a3b8", anchor: "end" })}
      ${svgText("AMOUNT", summaryColumns[3], summaryStart + 54, { size: 12, weight: 800, color: "#94a3b8", anchor: "end" })}

      <!-- Bottom Summary Rows -->
      ${summaryRows}

      <!-- Net Total / Final Price Card -->
      <rect x="968" y="${summaryStart + 32}" width="600" height="${netTotalCardHeight}" rx="8" fill="url(#totalCardGrad)" stroke="#38bdf8" stroke-width="1.5" stroke-opacity="0.35" />
      ${netTotalCardContent}
    </svg>
  `;

  return {
    svg,
    width,
    height,
    finalPrice,
    prewithdrawTotal,
    hasWithdrawals
  };
}

export async function exportSupplierReport(records, summary, grandTotal, options = {}) {
  const verifiedRecords = records.filter((record) => record.correct);
  if (!verifiedRecords.length) throw new Error("No verified sales are available to export.");

  const { svg, width, height } = buildSupplierReportSvg(records, summary, grandTotal, options);

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
