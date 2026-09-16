// lib/scheduleImageScanner.js
// OCR and structured schedule extraction using Google Gemini Vision API

const WEEKDAY_OFFSETS = {
  tue: 0,
  tues: 0,
  tuesday: 0,
  wed: 1,
  weds: 1,
  wednesday: 1,
  thu: 2,
  thur: 2,
  thurs: 2,
  thursday: 2,
  fri: 3,
  friday: 3,
  sat: 4,
  saturday: 4,
  sun: 5,
  sunday: 5,
  mon: 6,
  monday: 6
};

const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
]);

/**
 * Normalizes input image to base64 data string and mimeType.
 * Handles Data URLs (e.g. data:image/png;base64,...) and raw base64.
 */
export function normalizeImageData(imageData, defaultMimeType = "image/jpeg") {
  if (!imageData || typeof imageData !== "string") {
    throw Object.assign(new Error("No image data provided for scanning."), { statusCode: 400 });
  }

  const trimmed = imageData.trim();
  let mimeType = defaultMimeType || "image/jpeg";
  let base64Data = "";

  if (trimmed.startsWith("data:")) {
    const dataUrlMatch = trimmed.match(/^data:([^;]+);base64,(.*)$/s);
    if (!dataUrlMatch) {
      throw Object.assign(new Error("Invalid data URL format for image."), { statusCode: 400 });
    }
    mimeType = dataUrlMatch[1].trim() || defaultMimeType;
    base64Data = dataUrlMatch[2].replace(/\s+/g, "");
  } else {
    base64Data = trimmed.replace(/\s+/g, "");
  }

  if (!base64Data) {
    throw Object.assign(new Error("Invalid or empty base64 image data."), { statusCode: 400 });
  }

  const normalizedMime = mimeType.toLowerCase();
  if (!ALLOWED_IMAGE_MIMES.has(normalizedMime)) {
    throw Object.assign(
      new Error(`Unsupported image type "${mimeType}". Supported formats: PNG, JPEG, WEBP.`),
      { statusCode: 400 }
    );
  }

  return {
    base64Data,
    mimeType: normalizedMime
  };
}

/**
 * Calculates a YYYY-MM-DD date offset from a Tuesday anchor date.
 */
function addDaysToDateStr(anchorDateStr, daysToAdd) {
  const [y, m, d] = anchorDateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Resolves day names (e.g. "Tuesday", "Wed") or relative dates to YYYY-MM-DD
 * anchored to the weekly lockout Tuesday anchor date.
 */
export function resolveDate(rawDateOrDay, weekAnchorDate) {
  const anchor = weekAnchorDate && /^\d{4}-\d{2}-\d{2}$/.test(weekAnchorDate)
    ? weekAnchorDate
    : new Date().toISOString().slice(0, 10);

  if (!rawDateOrDay || typeof rawDateOrDay !== "string") {
    return anchor;
  }

  const trimmed = rawDateOrDay.trim();

  // If already standard ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Check weekday name match (e.g. "Tuesday", "Wed", "Fri")
  const lower = trimmed.toLowerCase().replace(/[^a-z]/g, "");
  if (lower in WEEKDAY_OFFSETS) {
    const offset = WEEKDAY_OFFSETS[lower];
    return addDaysToDateStr(anchor, offset);
  }

  // Check MM/DD or M/D format (e.g. "9/8" or "09/08")
  const monthDayMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (monthDayMatch) {
    const anchorYear = anchor.slice(0, 4);
    const m = String(monthDayMatch[1]).padStart(2, "0");
    const d = String(monthDayMatch[2]).padStart(2, "0");
    return `${anchorYear}-${m}-${d}`;
  }

  // Fallback to week anchor date
  return anchor;
}

/**
 * Normalizes time strings into standard 24-hour HH:MM format (EST).
 * Examples: "8:00 PM" -> "20:00", "8pm" -> "20:00", "9:30 AM" -> "09:30", "20:00" -> "20:00"
 */
export function normalizeTimeEst(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return "20:00";
  const raw = timeStr.trim().toUpperCase();

  // Match e.g. "8:00 PM", "8:30PM", "8 PM", "8PM", "08:00"
  const match12 = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const minute = match12[2] ? match12[2] : "00";
    const period = match12[3].toUpperCase();

    if (period === "PM" && hour < 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;

    return `${String(hour).padStart(2, "0")}:${minute}`;
  }

  // Match 24-hour format "20:00" or "08:30"
  const match24 = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (match24) {
    const hour = String(parseInt(match24[1], 10)).padStart(2, "0");
    return `${hour}:${match24[2]}`;
  }

  // Just hour number (e.g. "20")
  const matchSingleHour = raw.match(/^([01]?\d|2[0-3])$/);
  if (matchSingleHour) {
    return `${String(parseInt(matchSingleHour[1], 10)).padStart(2, "0")}:00`;
  }

  return raw;
}

/**
 * Normalizes and sanitizes a single run object extracted from the image.
 */
export function sanitizeScannedRun(run, weekAnchorDate) {
  if (!run || typeof run !== "object") {
    run = {};
  }

  // Date
  const date = resolveDate(run.date || run.day || "", weekAnchorDate);

  // Time
  const timeEst = normalizeTimeEst(run.timeEst || run.time || "");

  // Raid name
  const rawRaid = String(run.raid || run.instance || run.name || "").trim();
  let raid = "Venomous Abyss";
  if (/tidebound/i.test(rawRaid) || /grotto/i.test(rawRaid)) {
    raid = "Tidebound Grotto";
  } else if (/venom/i.test(rawRaid) || /abyss/i.test(rawRaid)) {
    raid = "Venomous Abyss";
  } else if (rawRaid) {
    raid = rawRaid;
  }

  // Difficulty
  const rawDiff = String(run.difficulty || "").trim().toLowerCase();
  let difficulty = "Heroic";
  if (rawDiff.includes("mythic") || rawDiff.startsWith("m")) {
    difficulty = "Mythic";
  } else if (rawDiff.includes("normal") || rawDiff.startsWith("n")) {
    difficulty = "Normal";
  } else if (rawDiff.includes("heroic") || rawDiff.startsWith("h")) {
    difficulty = "Heroic";
  }

  // Loot: Unsaved (Fresh) vs Saved
  const rawLoot = String(run.loot || "").trim().toLowerCase();
  let loot = "Unsaved";
  if (rawLoot.includes("unsave") || rawLoot.includes("fresh")) {
    loot = "Unsaved";
  } else if (rawLoot.includes("save")) {
    loot = "Saved";
  }

  // Max buyers
  const parsedMax = parseInt(run.maxBuyers ?? run.buyersCap ?? run.cap, 10);
  const maxBuyers = !Number.isNaN(parsedMax) && parsedMax >= 1 && parsedMax <= 30
    ? parsedMax
    : 6;

  // Lead
  const lead = String(run.lead || run.leader || "").trim();

  // Note
  const note = String(run.note || run.notes || run.remarks || "").trim();

  return {
    date,
    timeEst,
    raid,
    difficulty,
    loot,
    maxBuyers,
    lead,
    note
  };
}

/**
 * Builds the AI prompt with structured JSON formatting instructions and week reset anchoring.
 */
export function buildScannerPrompt(weekAnchorDate) {
  const anchor = weekAnchorDate && /^\d{4}-\d{2}-\d{2}$/.test(weekAnchorDate)
    ? weekAnchorDate
    : new Date().toISOString().slice(0, 10);

  return `You are an expert OCR and schedule extraction assistant for World of Warcraft raid sales rosters.
Extract all scheduled raid runs from the provided schedule image.

CONTEXT & CALENDAR ANCHOR:
- The World of Warcraft lockout week begins on Tuesday: ${anchor}.
- Days of the week in this lockout run Tuesday through Monday:
  - Tuesday = ${addDaysToDateStr(anchor, 0)}
  - Wednesday = ${addDaysToDateStr(anchor, 1)}
  - Thursday = ${addDaysToDateStr(anchor, 2)}
  - Friday = ${addDaysToDateStr(anchor, 3)}
  - Saturday = ${addDaysToDateStr(anchor, 4)}
  - Sunday = ${addDaysToDateStr(anchor, 5)}
  - Monday = ${addDaysToDateStr(anchor, 6)}
- If the image lists days of the week (e.g., "Tuesday", "Wed", "Friday"), convert them to their exact YYYY-MM-DD date using the above calendar.
- If the image contains explicit calendar dates (e.g. "9/8" or "09/08"), format them as YYYY-MM-DD.

TARGET JSON OUTPUT:
Return ONLY a valid JSON array of run objects (or a JSON object with a "runs" array). Do NOT include explanations, markdown commentary, or introductory text.

Each run object MUST have these properties:
- "date": string in "YYYY-MM-DD" format.
- "timeEst": string representing the raid time in 24-hour Eastern Standard Time (EST) format "HH:MM" (e.g., "20:00" for 8:00 PM EST, "14:30" for 2:30 PM EST).
- "raid": string name of the raid instance (e.g., "Venomous Abyss", "Tidebound Grotto").
- "difficulty": string, must be one of: "Heroic", "Normal", "Mythic" (default "Heroic").
- "loot": string, must be "Unsaved" (fresh lockout) or "Saved" (team locked).
- "maxBuyers": integer number of buyer spots (default 6, clamped between 1 and 30).
- "lead": string, raid leader or team name if specified, otherwise empty string "".
- "note": string, any specific notes (e.g., "Armor stack Plate", "Full clear", etc.), otherwise empty string "".

Example Output:
[
  {
    "date": "${anchor}",
    "timeEst": "20:00",
    "raid": "Venomous Abyss",
    "difficulty": "Heroic",
    "loot": "Unsaved",
    "maxBuyers": 6,
    "lead": "RaidLeader",
    "note": "Cloth armor stack"
  }
]`;
}

/**
 * Strips codeblock markdown delimiters and parses JSON.
 */
export function parseGeminiResponse(rawText) {
  if (!rawText || typeof rawText !== "string") {
    throw Object.assign(new Error("Empty response from Gemini Vision API."), { statusCode: 422 });
  }

  // Strip ```json ... ``` or ``` ... ```
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
    cleaned = cleaned.replace(/\s*```$/i, "");
    cleaned = cleaned.trim();
  }

  // Find the first '[' or '{' and the last ']' or '}'
  const startIdx = cleaned.search(/[[{]/);
  if (startIdx === -1) {
    throw Object.assign(new Error("Could not find valid JSON in Gemini response."), { statusCode: 422 });
  }

  const endChar = cleaned[startIdx] === "[" ? "]" : "}";
  const endIdx = cleaned.lastIndexOf(endChar);
  if (endIdx === -1 || endIdx < startIdx) {
    throw Object.assign(new Error("Could not find matching closing bracket in Gemini response."), { statusCode: 422 });
  }

  const jsonSubstring = cleaned.slice(startIdx, endIdx + 1);

  let parsed;
  try {
    parsed = JSON.parse(jsonSubstring);
  } catch (err) {
    throw Object.assign(new Error(`Failed to parse schedule JSON from image: ${err.message}`), { statusCode: 422 });
  }

  let runsArray = [];
  if (Array.isArray(parsed)) {
    runsArray = parsed;
  } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.runs)) {
    runsArray = parsed.runs;
  } else if (parsed && typeof parsed === "object") {
    // Look for any array property
    const candidate = Object.values(parsed).find((val) => Array.isArray(val));
    if (candidate) runsArray = candidate;
    else throw Object.assign(new Error("No runs list found in Gemini response."), { statusCode: 422 });
  }

  return runsArray;
}

/**
 * Calls Google Gemini Vision API to extract raid schedule runs from an image.
 */
export async function extractScheduleFromImage({ image, mimeType = "image/jpeg", weekAnchorDate }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw Object.assign(
      new Error("Gemini API key is not configured. Please set GEMINI_API_KEY in the server environment (.env)."),
      { statusCode: 503 }
    );
  }

  const candidateModels = [
    process.env.GEMINI_MODEL,
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-2.5-flash"
  ].filter(Boolean);
  const modelsToTry = Array.from(new Set(candidateModels));

  const { base64Data, mimeType: normalizedMime } = normalizeImageData(image, mimeType);
  const promptText = buildScannerPrompt(weekAnchorDate);

  const requestBody = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inline_data: {
              mime_type: normalizedMime,
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: "application/json"
    }
  };

  let lastError = null;
  let response = null;

  for (const model of modelsToTry) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify(requestBody)
      });
    } catch (netErr) {
      throw Object.assign(new Error(`Network error connecting to Gemini API: ${netErr.message}`), { statusCode: 502 });
    }

    if (response.ok) {
      lastError = null;
      break;
    }

    let errorDetails = "";
    try {
      const errJson = await response.json();
      errorDetails = errJson.error?.message || "";
    } catch {
      // Ignore JSON parse error on error response
    }

    if (response.status === 429) {
      throw Object.assign(new Error("Gemini API rate limit exceeded. Please try again in a few moments."), { statusCode: 429 });
    }

    let safeMessage = errorDetails
      ? `Gemini API error (${response.status}): ${errorDetails}`
      : `Gemini API request failed with status ${response.status}.`;

    if (apiKey && safeMessage.includes(apiKey)) {
      safeMessage = safeMessage.replaceAll(apiKey, "[REDACTED]");
    }

    lastError = Object.assign(new Error(safeMessage), { statusCode: response.status >= 500 ? 502 : response.status });

    // If 404 (model not found/deprecated), try next model in the fallback list
    if (response.status === 404) {
      continue;
    }

    // For other errors (e.g. 400 bad image, 401 unauthorized, 429), don't loop
    throw lastError;
  }

  if (!response || !response.ok) {
    throw lastError || Object.assign(new Error("Failed to scan image with available Gemini models."), { statusCode: 502 });
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const rawRuns = parseGeminiResponse(rawText);

  // Sanitize each extracted run and resolve dates with weekAnchorDate
  const runs = rawRuns.map((r) => sanitizeScannedRun(r, weekAnchorDate));

  return {
    runs,
    count: runs.length
  };
}
