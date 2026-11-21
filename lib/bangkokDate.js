// Calendar-date helpers for the business timezone (Asia/Bangkok, UTC+7).
// Ledger dates are plain "YYYY-MM-DD" strings. `new Date().toISOString().slice(0, 10)`
// gives the UTC date, which is "yesterday" in Bangkok between 00:00 and 06:59.
// Use these helpers whenever a default "today" date is needed, on the server or in the UI.

export const BUSINESS_TIMEZONE = "Asia/Bangkok";

const isoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

/** "YYYY-MM-DD" for the given instant as seen on a Bangkok calendar. */
export function bangkokIsoDate(instant = new Date()) {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return "";
  return isoDateFormatter.format(date);
}

/** Today's date on a Bangkok calendar, as "YYYY-MM-DD". */
export function bangkokToday(now = new Date()) {
  return bangkokIsoDate(now);
}

/** Add (or subtract) whole days to a "YYYY-MM-DD" string without timezone drift. */
export function addDaysIso(isoDate, days) {
  const [year, month, day] = String(isoDate || "").slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

/** First day of the month of a "YYYY-MM-DD" string. */
export function monthStartIso(isoDate) {
  const value = String(isoDate || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value.slice(0, 8)}01` : "";
}
