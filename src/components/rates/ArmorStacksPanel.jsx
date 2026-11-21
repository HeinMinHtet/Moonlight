import React from "react";
import { NamedOptionsPanel } from "./NamedOptionsPanel.jsx";

const COPY = {
  description: "Armor stack categories available when recording supplier sales.",
  addLabel: "Add armor stack",
  saveLabel: "Save armor stacks",
  duplicateMessage: "Duplicate armor stack names found",
  defaultHint: "Default selection for new sales records",
  setDefaultHint: "Set as default selection for new sales records",
  columnLabel: "Armor Stack Name",
  emptyActive: "No active armor stacks. Restore an archived option or add a new one.",
  emptyArchived: "No archived armor stacks.",
  keyPrefix: "armor",
  noun: "armor stack",
  inputLabel: "Armor stack name",
  unusedHint: "Not used by any sales records.",
  restoreHint: "Restore armor stack",
  archiveHint: "Archive armor stack",
  usedHint: (count) => `Used by ${count} historical sales record${count === 1 ? "" : "s"}.`
};

export function ArmorStacksPanel({ title = "Armor stack options", supplierRecords = [], ...props }) {
  const countUsage = (normalizedName) =>
    supplierRecords.filter((record) => String(record.armorType || "").trim().toLocaleLowerCase() === normalizedName).length;
  return <NamedOptionsPanel title={title} copy={COPY} countUsage={countUsage} {...props} />;
}
