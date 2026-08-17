export const today = () => new Date().toISOString().slice(0, 10);
export const money = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
export const dateOnly = (value) => (value ? new Date(value).toLocaleDateString() : "");
