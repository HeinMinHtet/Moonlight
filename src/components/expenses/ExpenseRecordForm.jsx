import React, { useState } from "react";
import { today } from "../../utils/format.js";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { NativeSelect } from "@/components/ui/native-select.jsx";

const EXPENSE_CATEGORIES = [
  "Raid payment",
  "M+ outsource payment",
  "Other"
];

export function ExpenseRecordForm({ disabled, onSubmit }) {
  const [draft, setDraft] = useState(() => ({
    date: today(),
    category: "Raid payment",
    title: "",
    amount: "",
    recipient: "",
    note: ""
  }));

  const update = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }));

  const handleKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  };

  return (
    <form className="expense-entry-grid" onSubmit={onSubmit} onKeyDown={handleKeyDown}>
      <Label>Date <Input name="date" type="date" value={draft.date} onChange={update("date")} disabled={disabled} /></Label>
      <Label>
        Category
        <NativeSelect name="category" value={draft.category} onChange={update("category")} disabled={disabled}>
          {EXPENSE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </NativeSelect>
      </Label>
      <Label>Description <Input name="title" placeholder="e.g. Heroic Raid Team 1" value={draft.title} onChange={update("title")} disabled={disabled} /></Label>
      <Label>Amount <Input name="amount" type="number" min="0.01" step="0.01" placeholder="Gold amount" value={draft.amount} onChange={update("amount")} disabled={disabled} /></Label>
      <Label>Recipient <Input name="recipient" placeholder="Character or team lead" value={draft.recipient} onChange={update("recipient")} disabled={disabled} /></Label>
      <Label>Note <Input name="note" placeholder="Optional note" value={draft.note} onChange={update("note")} disabled={disabled} /></Label>
      <Button className="record-action" type="submit" disabled={disabled}>Record expense</Button>
    </form>
  );
}
