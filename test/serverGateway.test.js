import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlinkSync, existsSync } from "node:fs";
import { createHmac, randomBytes } from "node:crypto";

process.env.NODE_ENV = "test";
const testDbPath = join(tmpdir(), `test-server-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
process.env.TEST_DB_PATH = testDbPath;
process.env.SESSION_SECRET = "test-secret-key-for-gateway-tests";

const { server } = await import("../server.js");
const { saveSessionToDb } = await import("../lib/db.js");

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

test("Server Gateway Integration Tests", async (t) => {
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(() => {
    server.close();
    if (existsSync(testDbPath)) {
      try { unlinkSync(testDbPath); } catch {}
    }
  });

  await t.test("GET /api/config returns public config without authentication", async () => {
    const res = await fetch(`${baseUrl}/api/config`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.user, null);
    assert.equal(data.csrfToken, null);
    assert.equal(typeof data.permissions, "object");
    assert.equal(data.permissions.supplierRecords, false);
    assert.equal(data.permissions.profitReport, false);
    assert.ok(Array.isArray(data.supplierServices));
    assert.ok(Array.isArray(data.boosterPrices));
  });

  await t.test("Privileged endpoints reject unauthenticated requests with 403", async () => {
    const endpoints = [
      "/api/supplier-records",
      "/api/supplier-withdrawals",
      "/api/profit-report?from=2026-01-01&to=2026-01-07",
      "/api/external-expenses",
      "/api/raid-notes",
      "/api/raid-schedules",
      "/api/booster-records"
    ];

    for (const ep of endpoints) {
      const res = await fetch(`${baseUrl}${ep}`);
      assert.equal(res.status, 403, `Expected 403 for ${ep}, got ${res.status}`);
    }
  });

  await t.test("ETag returns 304 Not Modified on conditional GET when ledgerVersion is unchanged", async () => {
    const { cookieHeader, sessionId, sessionData } = createSessionCookie({
      role: "admin",
      discordId: "admin-test-id",
      username: "AdminTester",
      csrfToken: "csrf-token-123"
    });
    await saveSessionToDb(sessionId, sessionData);

    const firstRes = await fetch(`${baseUrl}/api/supplier-records`, {
      headers: { Cookie: cookieHeader }
    });
    assert.equal(firstRes.status, 200);
    const etag = firstRes.headers.get("etag");
    assert.ok(etag, "ETag header must be present on response");

    const secondRes = await fetch(`${baseUrl}/api/supplier-records`, {
      headers: {
        Cookie: cookieHeader,
        "If-None-Match": etag
      }
    });
    assert.equal(secondRes.status, 304, "Subsequent request with matching ETag should return 304 Not Modified");
  });

  await t.test("Enforces CSRF token validation on write requests", async () => {
    const csrfSecret = "csrf-secret-validation-token";
    const { cookieHeader, sessionId, sessionData } = createSessionCookie({
      role: "admin",
      discordId: "admin-csrf-test",
      username: "AdminCsrf",
      csrfToken: csrfSecret
    });
    await saveSessionToDb(sessionId, sessionData);

    // Request missing CSRF token
    const missingCsrfRes = await fetch(`${baseUrl}/api/supplier-records`, {
      method: "POST",
      headers: {
        Cookie: cookieHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        buyerName: "TestBuyer",
        serviceType: "m6",
        quantity: 1
      })
    });
    assert.equal(missingCsrfRes.status, 403);
    const missingData = await missingCsrfRes.json();
    assert.match(missingData.error, /session changed/i);

    // Request with valid CSRF token
    const validRes = await fetch(`${baseUrl}/api/supplier-records`, {
      method: "POST",
      headers: {
        Cookie: cookieHeader,
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfSecret
      },
      body: JSON.stringify({
        buyerName: "TestBuyer",
        serviceType: "m6",
        quantity: 1
      })
    });
    assert.equal(validRes.status, 201);
    const validData = await validRes.json();
    assert.equal(validData.record.buyerName, "TestBuyer");
  });

  await t.test("Returns 404 for unknown endpoints", async () => {
    const res = await fetch(`${baseUrl}/api/non-existent-route`);
    assert.equal(res.status, 404);
  });

  await t.test("Rate limiter returns 429 Too Many Requests after exceeding limit", async () => {
    const promises = [];
    for (let i = 0; i < 130; i++) {
      promises.push(fetch(`${baseUrl}/api/logout`, { method: "POST" }));
    }
    const results = await Promise.all(promises);
    const statuses = results.map((r) => r.status);
    assert.ok(statuses.includes(429), "Expected rate limit (429) to be triggered when burst exceeds limit");
  });
});
