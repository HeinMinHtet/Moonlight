import React from "react";
import { NamedOptionsPanel } from "./NamedOptionsPanel.jsx";

const COPY = {
  description: "Titles available when creating raid notes.",
  addLabel: "Add title",
  saveLabel: "Save raid note titles",
  duplicateMessage: "Duplicate titles found",
  defaultHint: "Default selection for new notes",
  setDefaultHint: "Set as default title",
  columnLabel: "Title Name",
  emptyActive: "No active titles. Restore an archived title or add a new one.",
  emptyArchived: "No archived titles.",
  keyPrefix: "title",
  noun: "title",
  inputLabel: "Title name",
  unusedHint: "Not used by any notes.",
  restoreHint: "Restore title",
  archiveHint: "Archive title",
  usedHint: (count) => `Used by ${count} raid note${count === 1 ? "" : "s"}.`
};

export function RaidNoteTitlesPanel({ title = "Raid note titles", notes = [], ...props }) {
  const countUsage = (normalizedName) =>
    notes.filter((n) => String(n.title || "").trim().toLocaleLowerCase() === normalizedName).length;
  return <NamedOptionsPanel title={title} copy={COPY} countUsage={countUsage} {...props} />;
}
