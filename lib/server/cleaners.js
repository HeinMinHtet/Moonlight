

// The four "named option" lists (armor stacks, guilds, raid note titles, purchase types)
// share one cleaner; only the error wording differs.
export function cleanNamedOptionRows(rows, messages) {
  if (!Array.isArray(rows) || !rows.length) {
    throw Object.assign(new Error(messages.empty), { statusCode: 400 });
  }
  const cleaned = rows.map((row) => ({
    name: String(row.name || "").trim(),
    active: row.active !== false,
    isDefault: Boolean(row.isDefault)
  }));
  if (cleaned.some((row) => !row.name)) {
    throw Object.assign(new Error(messages.missingName), { statusCode: 400 });
  }
  const seen = new Set();
  for (const row of cleaned) {
    const normalizedName = row.name.toLocaleLowerCase();
    if (seen.has(normalizedName)) {
      throw Object.assign(new Error(messages.duplicate), { statusCode: 400 });
    }
    seen.add(normalizedName);
  }
  return cleaned;
}

export function cleanArmorRows(rows) {
  return cleanNamedOptionRows(rows, {
    empty: "Keep at least one armor stack option. Archive options that should no longer be used.",
    missingName: "Every armor stack option needs a name.",
    duplicate: "Duplicate armor stack option names are not allowed."
  });
}

export function cleanGuildRows(rows) {
  return cleanNamedOptionRows(rows, {
    empty: "Keep at least one guild. Archive guilds that should no longer be used.",
    missingName: "Every guild needs a name.",
    duplicate: "Duplicate guild names are not allowed."
  });
}

export function cleanRaidTitleRows(rows) {
  return cleanNamedOptionRows(rows, {
    empty: "Keep at least one raid note title. Archive titles that should no longer be used.",
    missingName: "Every raid note title needs a name.",
    duplicate: "Duplicate raid note titles are not allowed."
  });
}

export function cleanPurchaseTypeRows(rows) {
  return cleanNamedOptionRows(rows, {
    empty: "Keep at least one purchase type. Archive types that should no longer be used.",
    missingName: "Every purchase type needs a name.",
    duplicate: "Duplicate purchase types are not allowed."
  });
}

export function cleanPriceRows(rows, key) {
  if (!Array.isArray(rows) || !rows.length) {
    throw Object.assign(new Error("Keep at least one rate row. Archive rates that should no longer be used."), { statusCode: 400 });
  }
  const cleaned = rows
    .map((row) => ({
      [key]: String(row[key] || "").trim(),
      price: Number(row.price),
      active: row.active !== false,
      isDefault: Boolean(row.isDefault)
    }));
  if (cleaned.some((row) => !row[key] || !Number.isFinite(row.price) || row.price < 0)) {
    throw Object.assign(new Error("Every rate needs a name and a value of 0 or greater."), { statusCode: 400 });
  }
  const seen = new Set();
  for (const row of cleaned) {
    const normalizedName = row[key].toLocaleLowerCase();
    if (seen.has(normalizedName)) {
      throw Object.assign(new Error(`Duplicate ${key === "type" ? "service" : "key level"} names are not allowed.`), { statusCode: 400 });
    }
    seen.add(normalizedName);
  }
  return cleaned;
}
