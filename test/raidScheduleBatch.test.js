import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlinkSync, existsSync } from "node:fs";
import { createHmac, randomBytes } from "node:crypto";
import {
  insertRaidSchedules,
  getRaidSchedulesPayload,
  deleteRaidSchedule,
  saveSessionToDb
} from "../lib/db.js";

test("insertRaidSchedules atomically inserts multiple schedules with validation", async () => {
  const dummySession = { discordId: "admin-999", username: "RaidLeaderX" };

  const runsToInsert = [
    {
      date: "2026-09-08",
      timeEst: "20:00",
      raid: "Venomous Abyss",
      difficulty: "Heroic",
      loot: "Unsaved",
      maxBuyers: 6,
      lead: "LeaderOne",
      note: "NoteOne"
    },
    {
      date: "2026-09-09",
      timeEst: "21:00",
      raid: "Tidebound Grotto",
      difficulty: "InvalidDifficulty", // should fallback to Heroic
      loot: "InvalidLoot", // should fallback to Unsaved
      maxBuyers: 50, // should clamp to 6
      lead: "LeaderTwo",
      note: "NoteTwo"
    },
    {
      date: "2026-09-10",
      timeEst: "22:00",
      raid: "", // should fallback to Venomous Abyss
      difficulty: "Mythic",
      loot: "Saved",
      maxBuyers: -1, // should clamp to 1
      lead: "LeaderThree",
      note: ""
    }
  ];

  const result = await insertRaidSchedules(runsToInsert, dummySession);
  assert.equal(result.count, 3);
  assert.equal(result.inserted.length, 3);

  // Check sanitization on run 0
  assert.equal(result.inserted[0].raid, "Venomous Abyss");
  assert.equal(result.inserted[0].difficulty, "Heroic");
  assert.equal(result.inserted[0].loot, "Unsaved");
  assert.equal(result.inserted[0].maxBuyers, 6);
  assert.equal(result.inserted[0].createdByName, "RaidLeaderX");

  // Check sanitization on run 1
  assert.equal(result.inserted[1].raid, "Tidebound Grotto");
  assert.equal(result.inserted[1].difficulty, "Heroic");
  assert.equal(result.inserted[1].loot, "Unsaved");
  assert.equal(result.inserted[1].maxBuyers, 30); // clamped to 30

  // Check sanitization on run 2
  assert.equal(result.inserted[2].raid, "Venomous Abyss");
  assert.equal(result.inserted[2].difficulty, "Mythic");
  assert.equal(result.inserted[2].loot, "Saved");
  assert.equal(result.inserted[2].maxBuyers, 1);

  // Verify in payload list
  const payload = await getRaidSchedulesPayload();
  for (const ins of result.inserted) {
    const found = payload.schedules.find((s) => s.id === ins.id);
    assert.ok(found, `Inserted schedule ${ins.id} should be present in payload`);
    await deleteRaidSchedule(ins.id);
  }

  // Empty array handling
  const emptyRes = await insertRaidSchedules([], dummySession);
  assert.equal(emptyRes.count, 0);
  assert.deepEqual(emptyRes.inserted, []);
});

test("Raid Schedule Batch and Scan Endpoints Integration", async (t) => {
  process.env.NODE_ENV = "test";
  const testDbPath = join(tmpdir(), `test-schedule-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  process.env.TEST_DB_PATH = testDbPath;
  process.env.SESSION_SECRET = "test-secret-schedule-batch";

  const { server } = await import("../server.js");

  function createSessionCookie(sessionObj) {
    const id = randomBytes(24).toString("base64url");
    const secret = process.env.SESSION_SECRET;
    const encoded = Buffer.from(JSON.stringify({ id })).toString("base64url");
    const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
    return {
      cookieHeader: `wow_ledger_session=${encoded}.${signature}`,
      sessionId: id,
      sessionData: {
        ...sessionObj,
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000
      }
    };
  }

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(() => {
    server.close();
    if (existsSync(testDbPath)) {
      try { unlinkSync(testDbPath); } catch {}
    }
  });

  const csrfSecret = "test-csrf-token-batch";
  const adminSession = createSessionCookie({
    role: "admin",
    discordId: "admin-batch-tester",
    username: "AdminBatch",
    csrfToken: csrfSecret
  });
  await saveSessionToDb(adminSession.sessionId, adminSession.sessionData);

  const boosterSession = createSessionCookie({
    role: "booster",
    discordId: "booster-batch-tester",
    username: "BoosterUser",
    csrfToken: csrfSecret
  });
  await saveSessionToDb(boosterSession.sessionId, boosterSession.sessionData);

  await t.test("POST /api/raid-schedules/scan-image permissions and validation", async () => {
    // 1. Unauthenticated -> 403
    const unauthRes = await fetch(`${baseUrl}/api/raid-schedules/scan-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: "aGVsbG8=" })
    });
    assert.equal(unauthRes.status, 403);

    // 2. Booster role (non-admin) -> 403
    const boosterRes = await fetch(`${baseUrl}/api/raid-schedules/scan-image`, {
      method: "POST",
      headers: {
        Cookie: boosterSession.cookieHeader,
        "X-CSRF-Token": csrfSecret,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ image: "aGVsbG8=" })
    });
    assert.equal(boosterRes.status, 403);

    // 3. Admin missing CSRF -> 403
    const missingCsrfRes = await fetch(`${baseUrl}/api/raid-schedules/scan-image`, {
      method: "POST",
      headers: {
        Cookie: adminSession.cookieHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ image: "aGVsbG8=" })
    });
    assert.equal(missingCsrfRes.status, 403);

    // 4. Admin missing image payload -> 400
    const missingImageRes = await fetch(`${baseUrl}/api/raid-schedules/scan-image`, {
      method: "POST",
      headers: {
        Cookie: adminSession.cookieHeader,
        "X-CSRF-Token": csrfSecret,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ image: "" })
    });
    assert.equal(missingImageRes.status, 400);

    // 5. Admin with missing GEMINI_API_KEY -> 503
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const noKeyRes = await fetch(`${baseUrl}/api/raid-schedules/scan-image`, {
        method: "POST",
        headers: {
          Cookie: adminSession.cookieHeader,
          "X-CSRF-Token": csrfSecret,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          weekAnchorDate: "2026-09-08"
        })
      });
      assert.equal(noKeyRes.status, 503);
      const data = await noKeyRes.json();
      assert.ok(data.error.includes("GEMINI_API_KEY"));
    } finally {
      if (prevKey) process.env.GEMINI_API_KEY = prevKey;
    }
  });

  await t.test("POST /api/raid-schedules/batch creates multiple schedules and increments version", async () => {
    // 1. Non-admin -> 403
    const nonAdminRes = await fetch(`${baseUrl}/api/raid-schedules/batch`, {
      method: "POST",
      headers: {
        Cookie: boosterSession.cookieHeader,
        "X-CSRF-Token": csrfSecret,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ runs: [{ raid: "Venomous Abyss", date: "2026-09-08" }] })
    });
    assert.equal(nonAdminRes.status, 403);

    // 2. Empty runs array -> 400
    const emptyRes = await fetch(`${baseUrl}/api/raid-schedules/batch`, {
      method: "POST",
      headers: {
        Cookie: adminSession.cookieHeader,
        "X-CSRF-Token": csrfSecret,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ runs: [] })
    });
    assert.equal(emptyRes.status, 400);

    // 3. Admin valid batch insert -> 201
    const validRes = await fetch(`${baseUrl}/api/raid-schedules/batch`, {
      method: "POST",
      headers: {
        Cookie: adminSession.cookieHeader,
        "X-CSRF-Token": csrfSecret,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        runs: [
          {
            date: "2026-09-08",
            timeEst: "19:00",
            raid: "Venomous Abyss",
            difficulty: "Heroic",
            loot: "Unsaved",
            maxBuyers: 6,
            lead: "BatchLeaderA",
            note: "First batch run"
          },
          {
            date: "2026-09-09",
            timeEst: "20:30",
            raid: "Tidebound Grotto",
            difficulty: "Normal",
            loot: "Saved",
            maxBuyers: 4,
            lead: "BatchLeaderB",
            note: "Second batch run"
          }
        ]
      })
    });

    assert.equal(validRes.status, 201);
    const payload = await validRes.json();
    assert.equal(payload.insertedCount, 2);
    assert.equal(payload.inserted.length, 2);
    assert.ok(Array.isArray(payload.schedules));

    // Schedules should contain the newly inserted runs
    const found1 = payload.schedules.find((s) => s.lead === "BatchLeaderA");
    const found2 = payload.schedules.find((s) => s.lead === "BatchLeaderB");
    assert.ok(found1);
    assert.ok(found2);
    assert.equal(found1.difficulty, "Heroic");
    assert.equal(found2.difficulty, "Normal");
  });
});
