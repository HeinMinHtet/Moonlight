# CLAUDE.md — Moonlight Ledger (`wow-ledger`)

Working rules, verification commands, workflow routing and subagent policy live in AGENTS.md and apply in full:

@AGENTS.md

This file adds the project map: what the app is, where things live, and the patterns to follow.

## What this is

Moonlight Ledger is an internal operations ledger for a World of Warcraft boosting business. It tracks:
- **Supplier sales**: rows with a buyer, a service type, an armor stack, a verified flag and a paid flag. Unpaid rows go into payment batches, which can be reopened.
- **Supplier withdrawals**: money drawn against verified sales, with partial and debt tracking (`parent_withdrawal_id`, `original_amount`).
- **Booster payouts**: run records, adjustments, settlements, and a booster cash vault with withdrawals.
- **Expenses**, a **profit report** (daily, weekly or monthly), a **price calculator**, and **raid notes**. (The old Raid schedule feature was removed in Nov 2026. Existing `raid_schedules` rows and JSON data were left in place, but no code reads them.)
- **Default rates**: supplier service prices, booster level prices, armor types, supplier guilds, raid note titles and buyer purchase types.

Users sign in with Discord OAuth. Guild roles map each user to `admin` (everything) or `booster` (booster payouts only). This is **not** a Discord bot.

Times display in **Asia/Bangkok** (see `src/utils/format.js`). Some amounts are shown in MMK (`mmk()`).

## Stack

- Node ≥ 20, ES modules everywhere (`"type": "module"`), plain JavaScript/JSX. There is no TypeScript.
- Server: Node's built-in `http` in `server.js`. No Express or other framework.
- Frontend: React 19 with Vite 6, Tailwind CSS v4 (`@tailwindcss/vite`), shadcn/ui (new-york style, JSX, lucide icons), Radix primitives, TanStack Table v8 and sonner toasts.
- Storage: PostgreSQL through `pg` when `DATABASE_URL` is set (Railway). Otherwise it falls back to the JSON file `data/database.json`.
- Tests: `node --test` for the server and logic, Vitest with jsdom and Testing Library for the UI.

## Commands

```bash
npm run dev       # node server.js --dev → Vite middleware + HMR (HMR port = PORT+10000)
npm start         # production: serves dist/ (falls back to public/)
npm run build     # vite build → dist/
npm run check     # syntax-check server.js
npm test          # Node tests in test/*.test.js (serial: --test-concurrency=1)
npm run test:ui   # Vitest: src/**/*.test.{js,jsx}
```
Copy `.env.example` to `.env`. Without the Discord variables, login does not work. Without `DATABASE_URL`, the app uses the JSON file.

## Layout

```
server.js                 Whole HTTP gateway (~1.7k lines): env loading, rate limiting, signed
                          session cookie + CSRF, permissions, every /api/* route (handleApi),
                          Discord OAuth (handleDiscord), static/Vite serving, input cleaners
                          (cleanPriceRows, cleanArmorRows, ...). Exports `server` for tests.
lib/db.js                 Data access layer (~3.3k lines). Every exported function has BOTH a
                          Postgres branch and a JSON-file branch. Schema + seeds in initDb().
lib/profitReport.js       Pure profit aggregation (buildProfitReport, validIsoDate).
src/main.jsx → App.jsx    App.jsx holds global state, the active tab, config/permissions and
                          data loading per tab; renders the page components.
src/api.js                The ONLY place that calls fetch: api(path, options, csrfToken).
src/hooks/use*Actions.js  Mutation handlers per domain (supplier, booster, rates, expenses+notes).
                          These call api() and update App state.
src/components/<domain>/  Pages, forms, tables, and dialogs per tab: supplier, booster, expenses,
                          notes, rates, profit, calculator.
src/components/ui/        shadcn primitives. Add new ones in shadcn style, aliased via @/.
src/components/data-table/  Shared TanStack DataTable (toolbar, pagination, column header,
                          view options, selection helpers).
src/utils/                Pure frontend business logic (booster balances/settlement/vault,
                          supplier batch summary, withdrawals reconciliation, price calculator,
                          supplier PNG/SVG report export, formatting).
test/                     Node tests. Many import ../server.js and hit a real listening server.
data/                     database.json (gitignored, may hold real data). database.example.json is a sample.
public/                   styles.css (imported into Tailwind as the `legacy` layer, still in use),
                          avatar, and an OLD vanilla-JS app (app.js/index.html). Only served when dist/ is missing.
                          Do not edit public/app.js for new features.
.agents/, .workflows/     Role prompts and playbooks referenced by AGENTS.md. Design skills are in
                          .agents/skills/ (ui-ux-pro-max, design-system, ui-styling, brand, ...).
```

The root planning docs (`system-workflow.md`, `ui-changes.md`, `ui-ux-improvement.md`, `shadcn-tanstack-refactor-plan.md`, `new-feature-requirements.md`) are background and history. Some parts are out of date (for example, they describe only JSON storage). The code is the source of truth.

## Navigation, tabs and permissions

`NAV_GROUPS` in `src/components/AppTabs.jsx` defines the navigation. It has two levels: the group bar, then a sub-tab row for groups that have more than one view.

| Group | Views (internal tab id → URL hash) |
|---|---|
| Sales | `supplier` → `#/sales`, `supplierHistory` → `#/sales/paid` |
| Booster payouts | `booster` → `#/boosters` |
| Income & Expense | `expenses` → `#/finance/expenses`, `profit` → `#/finance/profit`, `calculator` → `#/finance/calculator` |
| Default rates | `prices` → `#/rates` |
| Raid notes | `notes` → `#/notes` (always last) |

All groups except Booster payouts are admin-only. The current view is kept in the URL hash, so refresh, back/forward and shared links work. Change tabs through `navigateTo` in `App.jsx`, not `setActiveTab` directly. `navigateTo` blocks leaving Default rates while there are unsaved edits; that state is tracked in `src/utils/rateDrafts.js` against the `savedRates` baseline. To add a view, add it to `NAV_GROUPS`, render it in `App.jsx`, and give it a route.

The server decides access. `permissionsFor(session)` in `server.js` builds the permissions object that `/api/config` returns, and the UI only reads it. The rules:
- Supplier, expenses, profit, prices and notes: admin only.
- Booster records: boosters can edit or delete only their own **unpaid** records. Admins can see, edit and mark paid all of them.

A new privileged route needs both a server-side permission check and `requireCsrf`.

## Patterns to follow

**Adding or changing an API route**
1. Add the branch in `handleApi` in `server.js`. Routes are matched with `pathname === ...` / `startsWith` plus `req.method`. Read the body with `readJson(req)` and reply with `sendJson(res, status, payload)`. Use `notAllowed(res)` for 403.
2. Check the session, the permission and CSRF (`requireCsrf`, which compares the `X-CSRF-Token` header to the session token with a timing-safe comparison).
3. Validate and normalize input on the server.
4. Call a `lib/db.js` function.
5. Call `incrementLedgerVersion()` after a successful mutation. GET responses for supplier, booster, expenses and raid-notes use `ledgerVersion` as an ETag and return 304 when it is unchanged, so a missed bump means clients keep showing stale data.
6. Import the new db function in the big import block at the top of `server.js`.
7. On the client, call it through a `use*Actions` hook with `api(path, { method, body: JSON.stringify(...) }, csrfToken)`.

**Changing persistence (`lib/db.js`)**
- Implement **both** branches: `if (isPostgres()) { ...pg client... } else { readFileDb(); mutate; writeFileDb(db) }`.
- New column: add it to the `CREATE TABLE` **and** add `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `initDb()` so existing Railway databases migrate. Map snake_case to camelCase in the `map*FromRow` function. Add the default to `defaultDb` and the array guard in `readFileDb()` if a new collection is added.
- Use `BEGIN`/`COMMIT`/`ROLLBACK` for multi-row operations (for example mark-paid, settle, batch reopen).
- Keep persisted shapes backward compatible. `data/database.json` and production Postgres hold real ledger data.

**Money and business rules**
- Keep totals logic in pure functions (`lineTotal`, `src/utils/*`, `lib/profitReport.js`) and test them. Round with the existing `round2` helpers.
- `rateAtRecord` is fixed when a record is created. Changing default rates must not change historical totals.
- Incorrect totals, data loss and broken authorization are the highest-severity bugs (see the review rules in AGENTS.md).

**Frontend**
- Use `@/` for imports (`@/components/ui/button.jsx`, `@/lib/utils.js` → `cn`). Include the `.jsx` or `.js` extension.
- **Colours: use semantic tokens only.** Do not use raw Tailwind palette classes (`emerald-*`, `rose-*`, `amber-*`, `sky-*`, `slate-*`). Use:
  - Backgrounds and borders: `success`, `warning`, `destructive`, `primary` (info), `special` (violet), with opacity such as `bg-success/15`.
  - Text and icons: `text-success-text`, `text-warning-text`, `text-danger-text`, `text-info-text`, `text-special-text`.
  - Neutral text: `text-foreground`, `text-secondary-foreground`, `text-muted-foreground`.

  All values live in `:root` in `src/index.css`. The variables in `public/styles.css` are only aliases of those tokens.
- Fonts: Inter (sans) and JetBrains Mono (numbers), loaded in `index.html`, via `font-sans` / `font-mono` / `var(--font-*)`.
- Build with shadcn/ui and Tailwind classes. Older class-based styles come from `public/styles.css` in the `legacy` CSS layer, so check there before restyling an existing element.
- Entry forms (`.entry-grid`, `.expense-entry-grid`) use auto-fit grids. Do not set fixed pixel column templates.
- Use the shared `DataTable` for tables, `ConfirmDialog` for destructive actions, `EmptyState` and `skeleton` for empty and loading states, and `sonner` toasts for feedback.
- Format dates and times with the Thailand helpers in `src/utils/format.js`. Treat `YYYY-MM-DD` strings as dates without a timezone.

## Tests

- Node server tests set `NODE_ENV=test`, `TEST_DB_PATH=<tmp json>` and `SESSION_SECRET` **before** `await import("../server.js")`. They listen on port 0 and forge a signed session cookie (see `test/serverGateway.test.js`). Copy that setup. Do not touch `data/database.json` in tests.
- Known failure on main as of Nov 2026: `RaidNotesPage.test.jsx` › "copies individual buyer name to clipboard". It predates the nav/colour refactor.
- `test/postgresIntegration.test.js` skips itself unless `DATABASE_URL` is set. Do not point it at production.
- Put UI tests next to their component as `*.test.jsx`. Setup is in `src/vitest.setup.js` (jest-dom, cleanup).

## Gotchas

- `server.js` runs `await initDb()` at the top level when it is imported, and starts listening unless `NODE_ENV=test`.
- Sessions live in an in-memory Map and in the database (the Postgres `sessions` table or the JSON file). A 15-minute interval prunes expired ones.
- Rate limits are in memory per IP: auth 30/min, mutations 120/min.
- `.env` and `data/database.json` hold secrets and real data. Never print, commit or send them to the browser.
