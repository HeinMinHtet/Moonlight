import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "test-secret-step2";

const { server } = await import("../server.js");
const { saveSessionToDb } = await import("../lib/db.js");

async function adminSession() {
  const id = randomBytes(24).toString("base64url");
  const encoded = Buffer.from(JSON.stringify({ id })).toString("base64url");
  const signature = createHmac("sha256", process.env.SESSION_SECRET).update(encoded).digest("base64url");
  const csrfToken = "csrf-step2";
  await saveSessionToDb(id, {
    role: "admin",
    discordId: "admin-step2",
    username: "Admin",
    csrfToken,
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000
  });
  return { cookie: `wow_ledger_session=${encoded}.${signature}`, csrfToken };
}

test("ledger version, ETags and static caching", async (t) => {
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const { cookie, csrfToken } = await adminSession();

  await t.test("GET /api/ledger-version is cheap and carries a boot id", async () => {
    const res = await fetch(`${base}/api/ledger-version`);
    assert.equal(res.status, 200);
    const { version } = await res.json();
    assert.match(version, /^[A-Za-z0-9_-]+-\d+$/);
  });

  await t.test("the version and the ETag change after a mutation", async () => {
    const before = (await (await fetch(`${base}/api/ledger-version`)).json()).version;
    const listRes = await fetch(`${base}/api/supplier-records`, { headers: { Cookie: cookie } });
    assert.equal(listRes.headers.get("etag"), `"${before}"`);

    const create = await fetch(`${base}/api/supplier-records`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ buyerName: "EtagBuyer", serviceType: "m6", quantity: 1, date: "2026-11-21" })
    });
    assert.equal(create.status, 201);

    const after = (await (await fetch(`${base}/api/ledger-version`)).json()).version;
    assert.notEqual(after, before);
    const stale = await fetch(`${base}/api/supplier-records`, { headers: { Cookie: cookie, "If-None-Match": `"${before}"` } });
    assert.equal(stale.status, 200, "an old version must not produce a 304");
    const fresh = await fetch(`${base}/api/supplier-records`, { headers: { Cookie: cookie, "If-None-Match": `"${after}"` } });
    assert.equal(fresh.status, 304);
  });

  await t.test("the avatar is served as image/jpeg with a validator", async () => {
    const res = await fetch(`${base}/moonlight-avatar.jpg`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/jpeg");
    assert.equal(res.headers.get("cache-control"), "no-cache");
    const etag = res.headers.get("etag");
    assert.ok(etag);
    const again = await fetch(`${base}/moonlight-avatar.jpg`, { headers: { "If-None-Match": etag } });
    assert.equal(again.status, 304);
  });

  await t.test("index.html must be revalidated, never cached blindly", async () => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/html/);
    assert.equal(res.headers.get("cache-control"), "no-cache");
  });

  await t.test("path traversal is still refused", async () => {
    const res = await fetch(`${base}/..%2f..%2fpackage.json`);
    assert.notEqual(res.status, 200);
  });
});
