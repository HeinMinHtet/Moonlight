// Loaded by `npm test` (node --test --import ./test/setup.js) before every test file.
// It guarantees tests can never touch real ledger data:
//   - JSON storage always points at a fresh temp file (never data/database.json).
//   - DATABASE_URL from the shell is ignored. To run the Postgres tests, set
//     TEST_DATABASE_URL to a throwaway database (never production).
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";

process.env.NODE_ENV = "test";

if (!process.env.TEST_DB_PATH) {
  const testDbPath = join(tmpdir(), `wow-ledger-test-${process.pid}-${Date.now()}.json`);
  process.env.TEST_DB_PATH = testDbPath;
  process.on("exit", () => {
    try {
      rmSync(testDbPath, { force: true });
    } catch {
      // best effort cleanup
    }
  });
}

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else {
  delete process.env.DATABASE_URL;
}

// server.js loads .env on import, which could bring back a production DATABASE_URL.
// Mark the variable as explicitly handled so loadEnv() leaves it alone.
process.env.LEDGER_TEST_ENV_LOCKED = "1";

// With a test Postgres, create the schema once up front so tests that use lib/db.js
// directly (without calling initDb themselves) do not fail on a fresh database.
if (process.env.DATABASE_URL) {
  const { initDb } = await import("../lib/db.js");
  await initDb();
  process.env.LEDGER_SCHEMA_READY = "1";
}
