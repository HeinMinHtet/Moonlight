import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeImageData,
  resolveDate,
  normalizeTimeEst,
  sanitizeScannedRun,
  buildScannerPrompt,
  parseGeminiResponse,
  extractScheduleFromImage
} from "../lib/scheduleImageScanner.js";

test("normalizeImageData handles Data URLs, raw base64, and whitespace", () => {
  // Data URL with png
  const pngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const normalizedPng = normalizeImageData(pngDataUrl);
  assert.equal(normalizedPng.mimeType, "image/png");
  assert.equal(normalizedPng.base64Data, "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");

  // Data URL with jpeg and whitespace
  const jpegDataUrl = "  data:image/jpeg;base64,  /9j/4AAQSkZJRgABAQEASABIAAD/   ";
  const normalizedJpeg = normalizeImageData(jpegDataUrl);
  assert.equal(normalizedJpeg.mimeType, "image/jpeg");
  assert.equal(normalizedJpeg.base64Data, "/9j/4AAQSkZJRgABAQEASABIAAD/");

  // Raw base64 with custom mime type
  const rawBase64 = "aGVsbG8gd29ybGQ=";
  const normalizedRaw = normalizeImageData(rawBase64, "image/webp");
  assert.equal(normalizedRaw.mimeType, "image/webp");
  assert.equal(normalizedRaw.base64Data, "aGVsbG8gd29ybGQ=");

  // Empty or invalid throws 400 error
  assert.throws(() => normalizeImageData(""), (err) => err.statusCode === 400);
  assert.throws(() => normalizeImageData("data:image/png;base64, "), (err) => err.statusCode === 400);
});

test("resolveDate anchors weekday names and relative days to weekly reset Tuesday", () => {
  const weekAnchor = "2026-09-08"; // Tuesday

  // Explicit ISO date preserved
  assert.equal(resolveDate("2026-09-10", weekAnchor), "2026-09-10");

  // Tuesday -> +0 days
  assert.equal(resolveDate("Tuesday", weekAnchor), "2026-09-08");
  assert.equal(resolveDate("tue", weekAnchor), "2026-09-08");

  // Wednesday -> +1 day
  assert.equal(resolveDate("Wednesday", weekAnchor), "2026-09-09");
  assert.equal(resolveDate("Wed", weekAnchor), "2026-09-09");

  // Thursday -> +2 days
  assert.equal(resolveDate("Thursday", weekAnchor), "2026-09-10");
  assert.equal(resolveDate("Thu", weekAnchor), "2026-09-10");

  // Friday -> +3 days
  assert.equal(resolveDate("Friday", weekAnchor), "2026-09-11");
  assert.equal(resolveDate("Fri", weekAnchor), "2026-09-11");

  // Saturday -> +4 days
  assert.equal(resolveDate("Saturday", weekAnchor), "2026-09-12");
  assert.equal(resolveDate("Sat", weekAnchor), "2026-09-12");

  // Sunday -> +5 days
  assert.equal(resolveDate("Sunday", weekAnchor), "2026-09-13");
  assert.equal(resolveDate("Sun", weekAnchor), "2026-09-13");

  // Monday -> +6 days
  assert.equal(resolveDate("Monday", weekAnchor), "2026-09-14");
  assert.equal(resolveDate("Mon", weekAnchor), "2026-09-14");

  // MM/DD format
  assert.equal(resolveDate("9/12", weekAnchor), "2026-09-12");
  assert.equal(resolveDate("09-15", weekAnchor), "2026-09-15");

  // Invalid/empty fallback to weekAnchor
  assert.equal(resolveDate("", weekAnchor), "2026-09-08");
});

test("normalizeTimeEst converts various time formats to 24-hour HH:MM format", () => {
  // 12-hour with PM/AM
  assert.equal(normalizeTimeEst("8:00 PM"), "20:00");
  assert.equal(normalizeTimeEst("8pm"), "20:00");
  assert.equal(normalizeTimeEst("8 PM"), "20:00");
  assert.equal(normalizeTimeEst("11:30 PM"), "23:30");
  assert.equal(normalizeTimeEst("9:15 AM"), "09:15");
  assert.equal(normalizeTimeEst("12:00 PM"), "12:00");
  assert.equal(normalizeTimeEst("12:30 AM"), "00:30");

  // 24-hour format
  assert.equal(normalizeTimeEst("20:00"), "20:00");
  assert.equal(normalizeTimeEst("09:45"), "09:45");
  assert.equal(normalizeTimeEst("9:45"), "09:45");

  // Default fallback
  assert.equal(normalizeTimeEst(""), "20:00");
  assert.equal(normalizeTimeEst(null), "20:00");
});

test("sanitizeScannedRun properly sanitizes difficulty, loot, maxBuyers, and instances", () => {
  const weekAnchor = "2026-09-08";

  const raw1 = {
    day: "Thursday",
    time: "9:00 PM",
    instance: "Tidebound Grotto Heroic",
    difficulty: "heroic",
    loot: "Unsaved fresh run",
    cap: 8,
    leader: "Khadgar",
    remarks: "Plate stack only"
  };

  const clean1 = sanitizeScannedRun(raw1, weekAnchor);
  assert.equal(clean1.date, "2026-09-10");
  assert.equal(clean1.timeEst, "21:00");
  assert.equal(clean1.raid, "Tidebound Grotto");
  assert.equal(clean1.difficulty, "Heroic");
  assert.equal(clean1.loot, "Unsaved");
  assert.equal(clean1.maxBuyers, 8);
  assert.equal(clean1.lead, "Khadgar");
  assert.equal(clean1.note, "Plate stack only");

  // Default fallbacks & clamping
  const raw2 = {
    date: "2026-09-11",
    timeEst: "19:00",
    raid: "",
    difficulty: "mythic",
    loot: "Saved team",
    maxBuyers: 99
  };

  const clean2 = sanitizeScannedRun(raw2, weekAnchor);
  assert.equal(clean2.date, "2026-09-11");
  assert.equal(clean2.timeEst, "19:00");
  assert.equal(clean2.raid, "Venomous Abyss"); // default raid
  assert.equal(clean2.difficulty, "Mythic");
  assert.equal(clean2.loot, "Saved");
  assert.equal(clean2.maxBuyers, 6); // clamped to default 6 if > 30
});

test("buildScannerPrompt includes week reset anchor calendar in instructions", () => {
  const prompt = buildScannerPrompt("2026-09-08");
  assert.ok(prompt.includes("2026-09-08"));
  assert.ok(prompt.includes("Tuesday = 2026-09-08"));
  assert.ok(prompt.includes("Wednesday = 2026-09-09"));
  assert.ok(prompt.includes("TARGET JSON OUTPUT"));
});

test("parseGeminiResponse strips markdown codeblocks and parses arrays or objects", () => {
  // Markdown json fence
  const markdownResp = "```json\n[\n  {\"date\":\"2026-09-08\",\"timeEst\":\"20:00\",\"raid\":\"Venomous Abyss\"}\n]\n```";
  const parsed1 = parseGeminiResponse(markdownResp);
  assert.equal(parsed1.length, 1);
  assert.equal(parsed1[0].raid, "Venomous Abyss");

  // Wrapped in object with { runs: [...] }
  const objResp = "{\"runs\": [{\"date\":\"2026-09-09\",\"timeEst\":\"21:00\",\"raid\":\"Tidebound Grotto\"}]}";
  const parsed2 = parseGeminiResponse(objResp);
  assert.equal(parsed2.length, 1);
  assert.equal(parsed2[0].raid, "Tidebound Grotto");

  // Invalid response throws 422
  assert.throws(() => parseGeminiResponse("No schedules found here."), (err) => err.statusCode === 422);
});

test("extractScheduleFromImage throws 503 if GEMINI_API_KEY is not set", async () => {
  const prevKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  try {
    await assert.rejects(
      async () => {
        await extractScheduleFromImage({
          image: "aGVsbG8=",
          mimeType: "image/jpeg",
          weekAnchorDate: "2026-09-08"
        });
      },
      (err) => {
        assert.equal(err.statusCode, 503);
        assert.ok(err.message.includes("GEMINI_API_KEY"));
        return true;
      }
    );
  } finally {
    if (prevKey) process.env.GEMINI_API_KEY = prevKey;
  }
});
