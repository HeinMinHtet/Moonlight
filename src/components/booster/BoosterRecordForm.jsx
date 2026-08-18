import React, { useState } from "react";
import { withCurrent } from "../../utils/options.js";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { NativeSelect } from "@/components/ui/native-select.jsx";

export function BoosterRecordForm({ disabled, prices, onSubmit }) {
  const defaultLevel = prices.find((p) => p.isDefault && p.active !== false)?.level || prices.find((p) => p.active !== false)?.level || prices[0]?.level || "";
  const [draft, setDraft] = useState(() => ({ level: defaultLevel, quantity: "1", note: "" }));
  const levelOptions = withCurrent(prices.map((price) => price.level), draft.level);
  const update = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }));

  return (
    <form className="entry-grid booster-entry" onSubmit={onSubmit}>
      <Label>Mythic+ key <NativeSelect name="level" value={draft.level} onChange={update("level")} disabled={disabled}>{levelOptions.map((level) => <option key={level} value={level}>{level}</option>)}</NativeSelect></Label>
      <Label>Runs completed <Input name="quantity" type="number" min="1" step="1" value={draft.quantity} onChange={update("quantity")} disabled={disabled} /></Label>
      <Label>Note <Input name="note" placeholder="Optional run note" value={draft.note} onChange={update("note")} disabled={disabled} /></Label>
      <Button className="record-action" type="submit" disabled={disabled}>Record run</Button>
    </form>
  );
}
