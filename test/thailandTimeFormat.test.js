import test from "node:test";
import assert from "node:assert/strict";
import {
  THAILAND_TIMEZONE,
  dateOnly,
  formatThailandTime,
  formatThailandDate,
  formatThailandDateTime
} from "../src/utils/format.js";

test("THAILAND_TIMEZONE is Asia/Bangkok", () => {
  assert.equal(THAILAND_TIMEZONE, "Asia/Bangkok");
});

test("formatThailandTime converts UTC timestamp to Thailand time (UTC+7)", () => {
  // 02:15 UTC -> 09:15 ICT
  const utcIso = "2026-08-29T02:15:30.000Z";
  assert.equal(formatThailandTime(utcIso), "09:15");
  assert.equal(formatThailandTime(utcIso, { includeSeconds: true }), "09:15:30");

  // 17:45 UTC -> 00:45 next day ICT
  const lateUtc = "2026-08-28T17:45:00.000Z";
  assert.equal(formatThailandTime(lateUtc), "00:45");
  assert.equal(formatThailandTime(lateUtc, { includeSeconds: true }), "00:45:00");
});

test("formatThailandDate converts UTC timestamp to Thailand date", () => {
  // 18:00 UTC on Aug 28 -> 01:00 on Aug 29 in Thailand
  const rollUtc = "2026-08-28T18:00:00.000Z";
  assert.equal(formatThailandDate(rollUtc), "2026-08-29");
});

test("formatThailandDateTime formats combined date and time in Thailand timezone", () => {
  const utcIso = "2026-08-29T02:15:30.000Z";
  assert.equal(formatThailandDateTime(utcIso), "2026-08-29 09:15");
  assert.equal(formatThailandDateTime(utcIso, { includeSeconds: true }), "2026-08-29 09:15:30");
});

test("formatThailandTime and formatThailandDateTime handle invalid and empty inputs gracefully", () => {
  assert.equal(formatThailandTime(null), "");
  assert.equal(formatThailandTime(undefined), "");
  assert.equal(formatThailandTime("invalid-date"), "");
  assert.equal(formatThailandDate(null), "");
  assert.equal(formatThailandDateTime(null), "");
});

test("dateOnly returns strictly date without any time representation", () => {
  const d1 = dateOnly("2026-08-20");
  assert.ok(d1.length > 0);
  assert.ok(!d1.includes(":"), "dateOnly should not contain time colon");

  const d2 = dateOnly("2026-08-20T14:30:00.000Z");
  assert.ok(d2.length > 0);
  assert.ok(!d2.includes(":"), "dateOnly should not contain time colon");
});
