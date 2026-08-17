export function selectedRecordIds(records, nextSelection) {
  const idsByString = new Map(records.map((record) => [String(record.id), record.id]));
  return new Set(
    Object.entries(nextSelection)
      .filter(([, selected]) => selected)
      .map(([id]) => idsByString.get(id) ?? id)
  );
}

export function syncRowSelection(records, currentIds, nextSelection, onToggleRow) {
  const nextIds = selectedRecordIds(records, nextSelection);
  const allIds = new Set([...currentIds, ...nextIds]);
  for (const id of allIds) {
    if (currentIds.has(id) !== nextIds.has(id)) onToggleRow(id, nextIds.has(id));
  }
}
