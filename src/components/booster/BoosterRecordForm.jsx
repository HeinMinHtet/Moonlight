import React, { useState } from "react";
import { today } from "../../utils/format.js";
import { withCurrent } from "../../utils/options.js";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { NativeSelect } from "@/components/ui/native-select.jsx";

export function BoosterRecordForm({ disabled, prices, isAdmin, boosterOptions = [], onSubmit }) {
  const defaultLevel = prices.find((p) => p.isDefault && p.active !== false)?.level || prices.find((p) => p.active !== false)?.level || prices[0]?.level || "";
  const [draft, setDraft] = useState(() => ({
    date: today(),
    boosterName: "",
    level: defaultLevel,
    quantity: "1",
    note: ""
  }));
  const levelOptions = withCurrent(prices.map((price) => price.level), draft.level);
  const update = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }));

  const handleKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  };

  return (
    <form className={`entry-grid ${isAdmin ? "admin-booster-entry" : "booster-entry"}`} onSubmit={onSubmit} onKeyDown={handleKeyDown}>
      {isAdmin && (
        <Label>
          Date
          <Input
            name="date"
            type="date"
            value={draft.date}
            onChange={update("date")}
            disabled={disabled}
          />
        </Label>
      )}
      {isAdmin && (
        <Label>
          Booster
          <Input
            name="boosterName"
            list="booster-datalist-options"
            placeholder="Booster name"
            value={draft.boosterName}
            onChange={update("boosterName")}
            disabled={disabled}
            autoComplete="off"
          />
          <datalist id="booster-datalist-options">
            {boosterOptions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </Label>
      )}
      <Label>Mythic+ key <NativeSelect name="level" value={draft.level} onChange={update("level")} disabled={disabled}>{levelOptions.map((level) => <option key={level} value={level}>{level}</option>)}</NativeSelect></Label>
      <Label>Runs completed <Input name="quantity" type="number" min="1" step="1" value={draft.quantity} onChange={update("quantity")} disabled={disabled} /></Label>
      <Label>Note <Input name="note" placeholder="Optional run note" value={draft.note} onChange={update("note")} disabled={disabled} /></Label>
      <Button className="record-action" type="submit" disabled={disabled}>Record run</Button>
    </form>
  );
}

