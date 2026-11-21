import React from "react";
import { NamedOptionsPanel } from "./NamedOptionsPanel.jsx";

const COPY = {
  description: "Purchase types available when adding buyers.",
  addLabel: "Add type",
  saveLabel: "Save purchase types",
  duplicateMessage: "Duplicate types found",
  defaultHint: "Default selection for new buyers",
  setDefaultHint: "Set as default type",
  columnLabel: "Purchase Type",
  emptyActive: "No active types. Restore an archived type or add a new one.",
  emptyArchived: "No archived types.",
  keyPrefix: "type",
  noun: "type",
  inputLabel: "Type name",
  unusedHint: "Not used by any buyers.",
  restoreHint: "Restore type",
  archiveHint: "Archive type",
  usedHint: (count) => `Used by ${count} raid note${count === 1 ? "" : "s"}.`
};

export function BuyerPurchaseTypesPanel({ title = "Buyer purchase types", notes = [], ...props }) {
  const countUsage = (normalizedName) =>
    notes.filter((n) => (n.items || []).some((item) => String(item.purchaseType || "").trim().toLocaleLowerCase() === normalizedName)).length;
  return <NamedOptionsPanel title={title} copy={COPY} countUsage={countUsage} {...props} />;
}
