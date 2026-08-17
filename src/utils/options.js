export function withCurrent(values, selected) {
  const list = values.map((value) => String(value ?? "")).filter(Boolean);
  const selectedValue = String(selected ?? "");
  if (selectedValue && !list.includes(selectedValue)) list.push(selectedValue);
  return list;
}

export function withoutKey(object, key) {
  const clone = { ...object };
  delete clone[key];
  return clone;
}
