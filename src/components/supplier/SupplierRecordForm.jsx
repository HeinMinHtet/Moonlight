import React, { useState } from "react";
import { today } from "../../utils/format.js";
import { withCurrent } from "../../utils/options.js";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { NativeSelect } from "@/components/ui/native-select.jsx";

export function SupplierRecordForm({ disabled, services, armorTypes, onSubmit }) {
  const defaultServiceType = services.find((s) => s.isDefault && s.active !== false)?.type || services.find((s) => s.active !== false)?.type || services[0]?.type || "";
  const activeArmorList = (armorTypes || [])
    .map((a) => (typeof a === "string" ? { name: a, active: true, isDefault: a === "No stack" } : a))
    .filter((a) => a.active !== false);
  const defaultArmorType = activeArmorList.find((a) => a.isDefault)?.name || activeArmorList[0]?.name || "No stack";
  const [draft, setDraft] = useState(() => ({
    date: today(),
    buyerName: "",
    serviceType: defaultServiceType,
    quantity: "1",
    armorType: defaultArmorType,
    note: ""
  }));
  const serviceOptions = withCurrent(services.map((service) => service.type), draft.serviceType);
  const armorOptions = withCurrent(activeArmorList.map((a) => a.name), draft.armorType);
  const update = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }));

  const handleKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  };

  return (
    <form className="entry-grid" onSubmit={onSubmit} onKeyDown={handleKeyDown}>
      <Label>Date <Input name="date" type="date" value={draft.date} onChange={update("date")} disabled={disabled} /></Label>
      <Label>Buyer character <Input name="buyerName" placeholder="Character name" value={draft.buyerName} onChange={update("buyerName")} disabled={disabled} /></Label>
      <Label>Service <NativeSelect name="serviceType" value={draft.serviceType} onChange={update("serviceType")} disabled={disabled}>{serviceOptions.map((type) => <option key={type} value={type}>{type}</option>)}</NativeSelect></Label>
      <Label>Qty <Input name="quantity" type="number" min="0" step="0.1" value={draft.quantity} onChange={update("quantity")} disabled={disabled} /></Label>
      <Label>Armor stack <NativeSelect name="armorType" value={draft.armorType} onChange={update("armorType")} disabled={disabled}>{armorOptions.map((type) => <option key={type} value={type}>{type}</option>)}</NativeSelect></Label>
      <Label>Note <Input name="note" placeholder="Optional note" value={draft.note} onChange={update("note")} disabled={disabled} /></Label>
      <Button className="record-action" type="submit" disabled={disabled}>Record sale</Button>
    </form>
  );
}
