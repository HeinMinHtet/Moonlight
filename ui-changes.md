# UI Changes Roadmap

This roadmap is split into small work packages so each request can be implemented and checked without rewriting the whole app at once.

## Current App

- Backend: Node.js built-in HTTP server in `server.js`
- Frontend: React 19 with Vite, component code in `src/`, and shared CSS in `public/styles.css`
- Auth: Discord OAuth with admin and booster role checks
- Storage: local JSON database at `data/database.json`
- Main workflows: unpaid supplier sales, paid supplier history, booster payouts, rate settings, PNG export

## Product Goal

Build a clearer payout workspace for WoW boosting operations:

- Admins can review unpaid supplier sales, export verified payment batches, mark batches paid, inspect paid history, manage booster payouts, and update rate defaults.
- Boosters can record their own runs and see only their allowed payout data.
- Existing records keep saved rates so old payouts do not change when rates are edited or deleted.
- Permission boundaries must stay enforced on the server, not only hidden in the UI.

## Recommended Direction

Move the frontend to React with Vite while keeping the current backend API first.

Do not rewrite the backend and frontend at the same time. The safer path is:

1. Keep `server.js` and current API routes working.
2. Replace `public/app.js` and `public/index.html` behavior with React.
3. Improve UI components and workflow states.
4. After the React UI is stable, consider SQLite or another database.

## Phase 1: React Setup Without Feature Changes

Status: Complete

Goal: introduce React while preserving current behavior.

Tasks:

- Add Vite, React, and React DOM.
- Create `src/main.jsx`, `src/App.jsx`, and `src/api.js`.
- Move current global state into React state.
- Keep current backend routes unchanged.
- Keep Discord login link and cookie/session flow unchanged.
- Keep existing CSS initially to reduce visual risk.
- Update package scripts for `dev`, `build`, and `start`.

Acceptance checks:

- Admin can sign in and see supplier, paid history, booster, and rates tabs.
- Booster can sign in and see only booster payouts.
- Guest cannot access protected data.
- Existing supplier and booster records load correctly.
- Existing PNG export still works or has a documented temporary replacement.

Suggested prompt:

> Convert the current vanilla frontend to React with Vite, but do not redesign yet and do not change backend routes.

## Phase 2: Component Split

Status: Complete

Goal: make the UI easier to maintain before visual redesign.

Components to create:

- `AuthPanel`
- `AppTabs`
- `SupplierUnpaidPage`
- `SupplierRecordForm`
- `SupplierRecordsTable`
- `SupplierSummary`
- `SupplierPaidHistoryPage`
- `BoosterPayoutPage`
- `BoosterRecordsTable`
- `RateSettingsPage`
- `ConfirmDialog`
- `Toast`
- `EmptyState`
- `AccessDenied`

Acceptance checks:

- No duplicated supplier row rendering logic.
- Delete and paid actions use one shared confirmation dialog.
- Loading, empty, error, and unauthorized states are visible and understandable.
- No protected admin screen is visible to boosters.

Suggested prompt:

> Split the React UI into components and add shared confirmation, toast, empty, and access-denied states.

## Phase 3: Supplier Payout Workflow UX

Status: Complete

Goal: make admin supplier payment flow safer and faster.

Tasks:

- Add a clear payout batch header with:
  - verified unpaid row count
  - verified unpaid total
  - export status
  - last paid batch time if available
- Add filters:
  - all unpaid
  - verified only
  - needs review
  - service
  - date range
- Add row selection for partial payment batches.
- Export only selected verified rows when selection exists.
- Mark only selected verified rows paid when selection exists.
- Keep current "mark all verified paid" as a fallback action.
- Add a review warning before marking paid if any selected row has missing note, zero amount, or unusual quantity.

Acceptance checks:

- Admin can export the exact rows they intend to pay.
- Admin can mark the same selected rows paid.
- Paid rows move to paid history immediately.
- Unverified rows never get marked paid by batch actions.
- Supplier summary matches the currently selected or filtered payment batch.

Suggested prompt:

> Improve supplier payout batching: add filters, row selection, selected export, selected mark-paid, and safer confirmation copy.

## Phase 4: Paid Supplier History UX

Status: Complete

Goal: make paid history useful for audit and mistake recovery.

Tasks:

- Add filters:
  - paid date range
  - sale date range
  - buyer
  - service
  - paid by
- Add grouped history by payment batch.
- Show batch total and row count.
- Add export paid batch PNG.
- Add admin-only "reopen payment" action with confirmation.
- Store and show a `paymentBatchId` for records marked paid together.

Acceptance checks:

- Paid history can be searched without scrolling through every old row.
- Each payment batch is auditable.
- Reopened rows return to unpaid supplier records.
- Reopen action is admin-only on the server.

Suggested prompt:

> Add paid supplier history filters, payment batch grouping, paid-batch export, and admin-only reopen payment.

## Phase 5: Booster Payout Workflow UX

Status: Complete

Goal: make booster records clearer for both boosters and admins.

Tasks:

- Separate admin booster view from booster personal view.
- Add admin summary cards:
  - total unpaid booster payout
  - unpaid boosters count
  - paid this week
  - rows needing review
- Add filters:
  - booster
  - paid/open
  - key level
  - date range
- Add selected mark-paid for admin.
- Add paid booster history tab or section.
- Keep saved payout rate visible.
- Keep saved payout rate editable only by admins.

Acceptance checks:

- Booster cannot see other boosters' records.
- Booster cannot change saved payout rate.
- Admin can pay multiple booster rows safely.
- Open payout totals match filtered rows.

Suggested prompt:

> Improve booster payout workflow with admin summary, filters, selected mark-paid, and paid booster history.

## Phase 6: Rate Settings UX

Status: Complete

Goal: make rate changes safer because they only affect future records.

Tasks:

- Rename rate settings page to `Default rates`.
- Add copy explaining: "Changes affect new records only."
- Show active rates separately for supplier and booster.
- Add duplicate-name validation in the UI.
- Add "disabled/archive" state instead of deleting rates immediately.
- Show warnings when removing or archiving a rate that has historical records.
- Add rate change history later if needed.

Acceptance checks:

- Admin understands rate edits do not change old records.
- Duplicate service or key level names are blocked before save.
- Archived rates are hidden from new-record forms but old records still display correctly.

Suggested prompt:

> Improve default rate settings with clearer copy, duplicate validation, and archive instead of hard delete.

## Phase 7: Visual Design Pass

Status: Complete

Goal: make the app feel like an operations dashboard, not a spreadsheet copied into a page.

Design direction:

- Dense, quiet admin UI for repeated daily use.
- Use WoW language where it improves clarity, but keep data tables readable.
- Avoid decorative fantasy styling that reduces scan speed.
- Use color for state and risk:
  - verified
  - needs review
  - paid
  - unpaid
  - admin-only
  - destructive action

Tasks:

- Create a small design token system:
  - color
  - spacing
  - type scale
  - button variants
  - table states
  - badges
- Improve responsive table behavior.
- Add sticky table headers.
- Add compact row density.
- Add clearer action grouping.
- Add accessible focus states.
- Replace browser confirm boxes with in-app dialogs.

Acceptance checks:

- No text overlaps on mobile.
- Tables remain scannable on desktop.
- Dangerous actions are visually distinct.
- Keyboard focus is visible.
- Empty states explain the next action.

Suggested prompt:

> Do a visual design pass for the React payout dashboard with better table density, states, dialogs, and responsive behavior.

## Phase 8: Data Safety Upgrade

Goal: reduce risk from local JSON storage as records grow.

Recommended backend upgrade:

- Move from `data/database.json` to SQLite.
- Add migrations.
- Add tables:
  - `supplier_records`
  - `booster_records`
  - `supplier_rates`
  - `booster_rates`
  - `payment_batches`
  - `audit_log`
- Keep saved rate fields on records.
- Add audit log for paid, reopen, delete, rate change, and edit actions.

Acceptance checks:

- Existing JSON data migrates into SQLite.
- Payment history remains intact.
- Old records keep saved rates.
- Admin actions are audit logged.

Suggested prompt:

> Migrate storage from local JSON to SQLite with migrations and preserve all existing supplier and booster records.

## Security Rules To Preserve

- Discord login is the only login method.
- Admin role can see supplier records, paid supplier history, all booster records, and rates.
- Booster role can only see allowed booster payout data.
- Boosters must not see supplier records, supplier paid history, or admin prices.
- Server must enforce permissions even if someone edits the browser JavaScript.
- CSRF protection must remain on write actions.
- Session cookies must stay `HttpOnly` and `SameSite=Lax`.
- Saved rates must remain on records and must not be recalculated from current defaults.

## Good First Workload

Start with Phase 1 and Phase 2 together only if you have time to test carefully.

Best first prompt:

> Start Phase 1 from `ui-changes.md`: convert the frontend to React with Vite while preserving current behavior and backend routes. Do not redesign yet.

Best second prompt:

> Continue Phase 2 from `ui-changes.md`: split the React UI into maintainable components and add shared dialog, toast, empty, error, and access-denied states.
