import test from "node:test";
import assert from "node:assert/strict";
import { canSkipPoll } from "../src/utils/polling.js";

const base = { fullRefreshMs: 300_000, now: 1_000_000 };

test("skips only when the version is unchanged and a full refresh is not due", () => {
  assert.equal(canSkipPoll({ ...base, serverVersion: "a-5", seenVersion: "a-5", lastFullPollAt: 900_000 }), true);
  assert.equal(canSkipPoll({ ...base, serverVersion: "a-6", seenVersion: "a-5", lastFullPollAt: 900_000 }), false);
  assert.equal(canSkipPoll({ ...base, serverVersion: "b-5", seenVersion: "a-5", lastFullPollAt: 900_000 }), false, "restart changes the boot id");
  assert.equal(canSkipPoll({ ...base, serverVersion: "a-5", seenVersion: "a-5", lastFullPollAt: 600_000 }), false, "full refresh due");
  assert.equal(canSkipPoll({ ...base, serverVersion: null, seenVersion: "a-5", lastFullPollAt: 900_000 }), false);
  assert.equal(canSkipPoll({ ...base, serverVersion: "a-5", seenVersion: null, lastFullPollAt: 900_000 }), false, "first poll always loads");
});
