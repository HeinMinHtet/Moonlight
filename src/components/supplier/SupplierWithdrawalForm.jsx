import React, { useState } from "react";
import { today } from "../../utils/format.js";
import { withCurrent } from "../../utils/options.js";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { NativeSelect } from "@/components/ui/native-select.jsx";

export function SupplierWithdrawalForm({ disabled, guilds = [], onSubmit }) {
  const activeGuilds = guilds.filter((g) => g.active !== false);
  const defaultGuild = activeGuilds.find((g) => g.isDefault)?.name || activeGuilds[0]?.name || "Main Guild";

  const [draft, setDraft] = useState(() => ({
    date: today(),
    charName: "",
    guild: defaultGuild,
    amount: "",
    note: ""
  }));

  const guildNames = activeGuilds.map((g) => g.name);
  const guildOptions = withCurrent(guildNames.length ? guildNames : ["Main Guild"], draft.guild);
  const update = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }));

  const handleKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  };

  return (
    <form className="entry-grid" onSubmit={onSubmit} onKeyDown={handleKeyDown}>
      <Label>
        Date
        <Input name="date" type="date" value={draft.date} onChange={update("date")} disabled={disabled} required />
      </Label>
      <Label>
        Character name
        <Input
          name="charName"
          placeholder="Banker / character"
          value={draft.charName}
          onChange={update("charName")}
          disabled={disabled}
          required
        />
      </Label>
      <Label>
        Guild
        <NativeSelect name="guild" value={draft.guild} onChange={update("guild")} disabled={disabled} required>
          {guildOptions.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </NativeSelect>
      </Label>
      <Label>
        Amount
        <Input
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          value={draft.amount}
          onChange={update("amount")}
          disabled={disabled}
          required
        />
      </Label>
      <Label>
        Note
        <Input
          name="note"
          placeholder="Optional note / purpose"
          value={draft.note}
          onChange={update("note")}
          disabled={disabled}
        />
      </Label>
      <Button className="record-action" type="submit" disabled={disabled}>
        Record withdrawal
      </Button>
    </form>
  );
}
