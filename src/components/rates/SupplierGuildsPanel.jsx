import React from "react";
import { NamedOptionsPanel } from "./NamedOptionsPanel.jsx";

const COPY = {
  description: "Guilds available when recording supplier pre-withdrawals.",
  addLabel: "Add guild",
  saveLabel: "Save supplier guilds",
  duplicateMessage: "Duplicate guild names found",
  defaultHint: "Default selection for new withdrawals",
  setDefaultHint: "Set as default guild for new withdrawals",
  columnLabel: "Guild Name",
  emptyActive: "No active guilds. Restore an archived guild or add a new one.",
  emptyArchived: "No archived guilds.",
  keyPrefix: "guild",
  noun: "guild",
  inputLabel: "Guild name",
  unusedHint: "Not used by any withdrawals.",
  restoreHint: "Restore guild",
  archiveHint: "Archive guild",
  usedHint: (count) => `Used by ${count} historical withdrawal record${count === 1 ? "" : "s"}.`
};

export function SupplierGuildsPanel({ title = "Supplier guild names", withdrawals = [], ...props }) {
  const countUsage = (normalizedName) =>
    withdrawals.filter((w) => String(w.guild || "").trim().toLocaleLowerCase() === normalizedName).length;
  return <NamedOptionsPanel title={title} copy={COPY} countUsage={countUsage} {...props} />;
}
