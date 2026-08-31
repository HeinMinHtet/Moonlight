export const THAILAND_TIMEZONE = "Asia/Bangkok";

export const today = () => new Date().toISOString().slice(0, 10);

export const money = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

export const mmk = (value) => `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} MMK`;

export const dateOnly = (value) => {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const [year, month, day] = value.trim().split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toLocaleDateString(undefined, { timeZone: "UTC" });
  }
  const date = new Date(value);
  return isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
};

export function getWeekStart(isoDateString) {
  if (!isoDateString) return "";
  const [year, month, day] = String(isoDateString).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay(); // 0 is Sunday, 1 is Monday, ...
  const diff = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek; // Adjust to Monday
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

export function getWeekEnd(weekStartDateString) {
  if (!weekStartDateString) return "";
  const [year, month, day] = String(weekStartDateString).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 6);
  return date.toISOString().slice(0, 10);
}

export function formatThailandTime(value, { includeSeconds = false } = {}) {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: THAILAND_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    ...(includeSeconds ? { second: "2-digit" } : {}),
    hour12: false
  }).format(date);
}

export function formatThailandDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: THAILAND_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function formatThailandDateTime(value, { includeSeconds = false } = {}) {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return String(value);
  const time = formatThailandTime(date, { includeSeconds });
  const datePart = formatThailandDate(date);
  return time ? `${datePart} ${time}` : datePart;
}
