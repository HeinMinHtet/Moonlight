export function validateArmorRows(rows) {
  const names = rows.map((row) => String(row.name || "").trim()).filter(Boolean);
  if (names.length !== rows.length) throw new Error("Every armor stack option needs a name.");
  const normalizedNames = names.map((name) => name.toLocaleLowerCase());
  if (new Set(normalizedNames).size !== normalizedNames.length) throw new Error("Duplicate armor stack names are not allowed.");
}

export function validateGuildRows(rows) {
  const names = rows.map((row) => String(row.name || "").trim()).filter(Boolean);
  if (names.length !== rows.length) throw new Error("Every guild needs a name.");
  const normalizedNames = names.map((name) => name.toLocaleLowerCase());
  if (new Set(normalizedNames).size !== normalizedNames.length) throw new Error("Duplicate guild names are not allowed.");
}

export function validateRateRows(rows, key, label) {
  const names = rows.map((row) => String(row[key] || "").trim()).filter(Boolean);
  if (names.length !== rows.length) throw new Error(`Every ${label} rate needs a name.`);
  const normalizedNames = names.map((name) => name.toLocaleLowerCase());
  if (new Set(normalizedNames).size !== normalizedNames.length) throw new Error(`Duplicate ${label} names are not allowed.`);
}

export function useRateActions({
  request,
  runAction,
  setData,
  showToast,
  askConfirm,
  permissions,
  supplierServices,
  boosterPrices,
  supplierGuilds,
  armorTypes,
  supplierRecords,
  supplierHistory,
  boosterRecords,
  supplierWithdrawals
}) {
  const saveSupplierPrices = (event) => runAction(async () => {
    event.preventDefault();
    validateRateRows(supplierServices, "type", "service");
    const payload = await request("/api/prices/supplier", {
      method: "PUT",
      body: JSON.stringify({ rows: supplierServices })
    });
    setData((current) => ({
      ...current,
      supplierServices: payload.supplierServices || [],
      supplierSummary: payload.summary || []
    }));
    showToast("Supplier rates saved.");
  });

  const saveBoosterPrices = (event) => runAction(async () => {
    event.preventDefault();
    validateRateRows(boosterPrices, "level", "key level");
    const payload = await request("/api/prices/booster", {
      method: "PUT",
      body: JSON.stringify({ rows: boosterPrices })
    });
    setData((current) => ({
      ...current,
      boosterPrices: payload.boosterPrices || []
    }));
    showToast("Booster rates saved.");
  });

  const saveSupplierGuilds = (event) => runAction(async () => {
    event.preventDefault();
    validateGuildRows(supplierGuilds);
    const payload = await request("/api/prices/supplier-guilds", {
      method: "PUT",
      body: JSON.stringify({ rows: supplierGuilds })
    });
    setData((current) => ({
      ...current,
      supplierGuilds: payload.supplierGuilds || []
    }));
    showToast("Supplier guilds saved.");
  });

  const saveArmorTypes = (event) => runAction(async () => {
    event.preventDefault();
    validateArmorRows(armorTypes);
    const payload = await request("/api/prices/armor-types", {
      method: "PUT",
      body: JSON.stringify({ rows: armorTypes })
    });
    setData((current) => ({
      ...current,
      armorTypes: payload.armorTypes || []
    }));
    showToast("Armor stack options saved.");
  });

  const updatePriceRow = (collection, index, patch) => {
    setData((current) => ({
      ...current,
      [collection]: current[collection].map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    }));
  };

  const togglePriceRowStatus = (collection, index) => runAction(async () => {
    const currentRows = collection === "supplierServices" ? supplierServices : boosterPrices;
    const row = currentRows[index];
    if (!row) return;
    const itemKey = collection === "supplierServices" ? "type" : "level";
    const historyRecords = collection === "supplierServices"
      ? [...supplierRecords, ...supplierHistory]
      : boosterRecords;
    const historyKey = collection === "supplierServices" ? "serviceType" : "level";
    const historyCount = historyRecords.filter((record) => record[historyKey] === row[itemKey]).length;
    const archiving = row.active !== false;
    if (archiving && historyCount > 0) {
      const confirmed = await askConfirm({
        title: `Archive ${row[itemKey]}?`,
        body: `${historyCount} historical record${historyCount === 1 ? " uses" : "s use"} this rate. Archiving hides it from new records but keeps every saved historical rate unchanged.`,
        confirmLabel: "Archive rate"
      });
      if (!confirmed) return;
    }
    setData((current) => ({
      ...current,
      [collection]: current[collection].map((item, rowIndex) => (
        rowIndex === index ? { ...item, active: !archiving } : item
      ))
    }));
    showToast(archiving ? "Rate marked for archive. Save changes to apply." : "Rate restored. Save changes to apply.");
  });

  const deletePriceRow = (collection, index) => {
    const currentRows = collection === "supplierServices" ? supplierServices : boosterPrices;
    const row = currentRows[index];
    if (!row) return;
    setData((current) => ({
      ...current,
      [collection]: current[collection].filter((_, rowIndex) => rowIndex !== index)
    }));
    showToast("Rate row removed. Save changes to apply.");
  };

  const setDefaultPriceRow = (collection, index) => {
    setData((current) => {
      const currentRows = current[collection] || [];
      const targetRow = currentRows[index];
      if (!targetRow) return current;
      const willBeDefault = !targetRow.isDefault;
      return {
        ...current,
        [collection]: currentRows.map((row, rowIndex) => ({
          ...row,
          isDefault: rowIndex === index ? willBeDefault : false
        }))
      };
    });
  };

  const addPriceRow = (collection, key) => {
    if (!permissions.canEditPrices) return showToast("Discord admin role is required to edit rates.");
    setData((current) => ({ ...current, [collection]: [...current[collection], { [key]: "", price: 0, active: true }] }));
  };

  const addGuildRow = () => {
    if (!permissions.canEditPrices) return showToast("Discord admin role is required to edit guilds.");
    setData((current) => ({
      ...current,
      supplierGuilds: [...(current.supplierGuilds || []), { name: "", active: true, isDefault: false }]
    }));
  };

  const updateGuildRow = (index, patch) => {
    setData((current) => ({
      ...current,
      supplierGuilds: (current.supplierGuilds || []).map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    }));
  };

  const toggleGuildRowStatus = (index) => runAction(async () => {
    const row = (supplierGuilds || [])[index];
    if (!row) return;
    const historyCount = (supplierWithdrawals || []).filter((w) => w.guild === row.name).length;
    const archiving = row.active !== false;
    if (archiving && historyCount > 0) {
      const confirmed = await askConfirm({
        title: `Archive ${row.name}?`,
        body: `${historyCount} withdrawal record${historyCount === 1 ? " uses" : "s use"} this guild. Archiving hides it from new withdrawals but keeps existing withdrawals unchanged.`,
        confirmLabel: "Archive guild"
      });
      if (!confirmed) return;
    }
    setData((current) => ({
      ...current,
      supplierGuilds: current.supplierGuilds.map((item, rowIndex) => (
        rowIndex === index ? { ...item, active: !archiving } : item
      ))
    }));
    showToast(archiving ? "Guild marked for archive. Save changes to apply." : "Guild restored. Save changes to apply.");
  });

  const deleteGuildRow = (index) => {
    setData((current) => ({
      ...current,
      supplierGuilds: (current.supplierGuilds || []).filter((_, rowIndex) => rowIndex !== index)
    }));
    showToast("Guild removed. Save changes to apply.");
  };

  const setDefaultGuildRow = (index) => {
    setData((current) => {
      const currentRows = current.supplierGuilds || [];
      const targetRow = currentRows[index];
      if (!targetRow) return current;
      const willBeDefault = !targetRow.isDefault;
      return {
        ...current,
        supplierGuilds: currentRows.map((row, rowIndex) => ({
          ...row,
          isDefault: rowIndex === index ? willBeDefault : false
        }))
      };
    });
  };

  const addArmorRow = () => {
    if (!permissions.canEditPrices) return showToast("Discord admin role is required to edit armor stack options.");
    setData((current) => ({
      ...current,
      armorTypes: [...(current.armorTypes || []), { name: "", active: true, isDefault: false }]
    }));
  };

  const updateArmorRow = (index, patch) => {
    setData((current) => ({
      ...current,
      armorTypes: (current.armorTypes || []).map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    }));
  };

  const toggleArmorRowStatus = (index) => runAction(async () => {
    const row = (armorTypes || [])[index];
    if (!row) return;
    const historyRecords = [...supplierRecords, ...supplierHistory];
    const historyCount = historyRecords.filter((r) => r.armorType === row.name).length;
    const archiving = row.active !== false;
    if (archiving && historyCount > 0) {
      const confirmed = await askConfirm({
        title: `Archive ${row.name}?`,
        body: `${historyCount} sales record${historyCount === 1 ? " uses" : "s use"} this armor stack. Archiving hides it from new sales records but keeps existing records unchanged.`,
        confirmLabel: "Archive armor stack"
      });
      if (!confirmed) return;
    }
    setData((current) => ({
      ...current,
      armorTypes: current.armorTypes.map((item, rowIndex) => (
        rowIndex === index ? { ...item, active: !archiving } : item
      ))
    }));
    showToast(archiving ? "Armor stack marked for archive. Save changes to apply." : "Armor stack restored. Save changes to apply.");
  });

  const deleteArmorRow = (index) => {
    setData((current) => ({
      ...current,
      armorTypes: (current.armorTypes || []).filter((_, rowIndex) => rowIndex !== index)
    }));
    showToast("Armor stack removed. Save changes to apply.");
  };

  const setDefaultArmorRow = (index) => {
    setData((current) => {
      const currentRows = current.armorTypes || [];
      const targetRow = currentRows[index];
      if (!targetRow) return current;
      const willBeDefault = !targetRow.isDefault;
      return {
        ...current,
        armorTypes: currentRows.map((row, rowIndex) => ({
          ...row,
          isDefault: rowIndex === index ? willBeDefault : false
        }))
      };
    });
  };

  return {
    saveSupplierPrices,
    saveBoosterPrices,
    saveSupplierGuilds,
    saveArmorTypes,
    updatePriceRow,
    togglePriceRowStatus,
    deletePriceRow,
    setDefaultPriceRow,
    addPriceRow,
    addGuildRow,
    updateGuildRow,
    toggleGuildRowStatus,
    deleteGuildRow,
    setDefaultGuildRow,
    addArmorRow,
    updateArmorRow,
    toggleArmorRowStatus,
    deleteArmorRow,
    setDefaultArmorRow
  };
}
