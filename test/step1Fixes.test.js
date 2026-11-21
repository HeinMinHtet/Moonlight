import test from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHmac, randomBytes } from "node:crypto";
import { addDaysIso, bangkokIsoDate, bangkokToday, monthStartIso } from "../lib/bangkokDate.js";

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "test-secret-step1";

test("bangkokToday uses the Bangkok calendar, not UTC", () => {
  // 2026-11-21 18:30 UTC is already 01:30 on 2026-11-22 in Bangkok.
  assert.equal(bangkokToday(new Date("2026-11-21T18:30:00Z")), "2026-11-22");
  // 16:59 UTC is still 23:59 the same day in Bangkok.
  assert.equal(bangkokToday(new Date("2026-11-21T16:59:00Z")), "2026-11-21");
  // Exactly the rollover instant.
  assert.equal(bangkokIsoDate(new Date("2026-11-21T17:00:00Z")), "2026-11-22");
});

test("addDaysIso and monthStartIso do pure calendar math", () => {
  assert.equal(addDaysIso("2026-03-01", -1), "2026-02-28");
  assert.equal(addDaysIso("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysIso("2026-11-22", -6), "2026-11-16");
  assert.equal(monthStartIso("2026-11-22"), "2026-11-01");
  assert.equal(addDaysIso("bad", 1), "");
  assert.equal(monthStartIso(""), "");
});

test("a corrupt JSON ledger file is never silently replaced with an empty ledger", { skip: Boolean(process.env.DATABASE_URL) && "JSON storage only" }, async () => {
  const dbPath = join(tmpdir(), `corrupt-ledger-${Date.now()}-${randomBytes(3).toString("hex")}.json`);
  const corrupt = '{"supplierRecords": [{"id": "real-row"'; // truncated mid-write
  writeFileSync(dbPath, corrupt);
  const previous = process.env.TEST_DB_PATH;
  process.env.TEST_DB_PATH = dbPath;
  try {
    const { getSupplierRecordsPayload, insertSupplierRecord } = await import("../lib/db.js");
    await assert.rejects(() => getSupplierRecordsPayload(), (error) => error.code === "LEDGER_FILE_CORRUPT");
    await assert.rejects(
      () => insertSupplierRecord({ id: "x", date: "2026-11-21", buyerName: "b", serviceType: "m6", quantity: 1 }),
      (error) => error.code === "LEDGER_FILE_CORRUPT"
    );
    assert.equal(readFileSync(dbPath, "utf8"), corrupt, "the damaged file must be left untouched");
  } finally {
    process.env.TEST_DB_PATH = previous;
    rmSync(dbPath, { force: true });
  }
});

test("writeFileAtomic replaces the file and leaves no temp files behind", async () => {
  const { writeFileAtomic } = await import("../lib/db.js");
  const dir = join(tmpdir(), `atomic-${Date.now()}-${randomBytes(3).toString("hex")}`);
  const target = join(dir, "ledger.json");
  writeFileAtomic(target, '{"a":1}');
  writeFileAtomic(target, '{"a":2}');
  assert.equal(readFileSync(target, "utf8"), '{"a":2}');
  assert.deepEqual(readdirSync(dir), ["ledger.json"]);
  rmSync(dir, { recursive: true, force: true });
});

test("request bodies keep multi-byte characters that are split across chunks", async (t) => {
  const { server } = await import("../server.js");
  const { saveSessionToDb } = await import("../lib/db.js");
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const { port } = server.address();

  const id = randomBytes(24).toString("base64url");
  const encoded = Buffer.from(JSON.stringify({ id })).toString("base64url");
  const signature = createHmac("sha256", process.env.SESSION_SECRET).update(encoded).digest("base64url");
  const csrfToken = "csrf-step1-token";
  await saveSessionToDb(id, {
    role: "admin",
    discordId: "admin-step1",
    username: "Admin",
    csrfToken,
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000
  });

  const buyerName = "မောင်မောင် สมชาย 🐉";
  const body = Buffer.from(JSON.stringify({ buyerName, serviceType: "m6", quantity: 1, date: "2026-11-21" }), "utf8");
  // Split inside the first Myanmar character (3 bytes in UTF-8).
  const splitAt = body.indexOf(Buffer.from("မ", "utf8")) + 1;

  const response = await new Promise((resolve, reject) => {
    const req = request(
      {
        port,
        method: "POST",
        path: "/api/supplier-records",
        headers: {
          Cookie: `wow_ledger_session=${encoded}.${signature}`,
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
          "Content-Length": body.length
        }
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve({ status: res.statusCode, json: JSON.parse(Buffer.concat(chunks).toString("utf8")) }));
      }
    );
    req.on("error", reject);
    req.write(body.subarray(0, splitAt));
    setTimeout(() => req.end(body.subarray(splitAt)), 20);
  });

  assert.equal(response.status, 201);
  assert.equal(response.json.record.buyerName, buyerName);
});

test("test setup isolates tests from real data", () => {
  assert.ok(process.env.TEST_DB_PATH, "TEST_DB_PATH must always be set by test/setup.js");
  assert.ok(!process.env.TEST_DB_PATH.endsWith(join("data", "database.json")));
  if (!process.env.TEST_DATABASE_URL) assert.equal(process.env.DATABASE_URL, undefined);
  else assert.equal(process.env.DATABASE_URL, process.env.TEST_DATABASE_URL);
  assert.ok(existsSync(tmpdir()));
});
