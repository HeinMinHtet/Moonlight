# shadcn/ui and TanStack Table Refactor Plan

## Goal

Refactor the React frontend to use **shadcn/ui** components for the shared interface and **TanStack Table** for record-table behavior, while preserving the existing payout workflows, permissions, API contracts, and WoW-specific terminology.

> Assumption: “ShatDCN” means [shadcn/ui](https://ui.shadcn.com/).

## Implementation Status — 2026-08-17

The source refactor is implemented:

- shadcn/ui configuration, Tailwind theme tokens, Vite aliasing, and JavaScript component primitives are present.
- Shared buttons, fields, badges, cards, tabs, alerts, confirmation dialogs, checkboxes, empty/loading states, and toast handling have been migrated.
- Supplier unpaid records, booster payouts, and supplier paid-history records use the shared TanStack Table renderer.
- Stable row IDs, sorting, pagination, current-page selection, conditional eligibility, selected counts, column visibility, and inline editing are implemented.
- Legacy CSS is isolated in a lower-priority cascade layer while the remaining layout rules are migrated incrementally.
- Dependencies are installed and `package-lock.json` contains the resolved dependency graph.
- Native Node regression tests pass, including new stable-selection tests, and every source JavaScript/JSX file passes a syntax transform.
- Vitest/Testing Library pagination and sorting tests pass in jsdom.
- The production Vite build succeeds.

Remaining manual validation:

- Complete browser-based desktop, tablet, mobile, and keyboard smoke testing.

## Current State

- React 19 and Vite 6 using JavaScript/JSX.
- Shared presentation is implemented in `public/styles.css`.
- No Tailwind CSS, shadcn/ui, component alias, or TanStack Table dependency is configured.
- Supplier and booster filtering, selection, row editing, and bulk-action state are implemented manually.
- Discord OAuth, role permissions, CSRF protection, and all persistence logic live outside the UI components and must remain unchanged.

## Scope

### shadcn/ui migration

Refactor these interface patterns:

| Current pattern | Target component |
| --- | --- |
| Native buttons and custom variants | `Button` |
| Inputs and native selects | `Input`, `NativeSelect` or `Select`, `Label`/`Field` |
| Custom `.pill` statuses | `Badge` |
| Custom panels and statistic blocks | `Card` |
| `AppTabs` and booster view switch | `Tabs` |
| `ConfirmDialog` | `AlertDialog` |
| Custom `Toast` | `Sonner` |
| Native checkboxes | `Checkbox` |
| Loading and empty states | `Skeleton`, `Empty`, and `Alert` |
| Row actions | `Button` or `DropdownMenu` where space is constrained |
| Table markup | shadcn/ui `Table` primitives |

### TanStack Table migration

Use TanStack Table for the three domain record tables:

1. `src/components/supplier/SupplierRecordsTable.jsx`
2. `src/components/booster/BoosterRecordsTable.jsx`
3. The paid-record table inside `src/components/supplier/SupplierPaidHistoryPage.jsx`

Keep `SupplierSummary` and `ProfitReportPage` as simple shadcn/ui tables. They are small aggregate views and do not currently need sorting, selection, filtering, or pagination.

## Non-goals

- No backend, API route, authentication, authorization, or database changes.
- No recalculation of saved supplier or booster rates.
- No TypeScript conversion as part of this refactor.
- No redesign of the payout rules or bulk-payment confirmation flow.
- No table virtualization unless real record volume demonstrates a need.

## Phase 1 — Add the UI Foundation

- [ ] Add Tailwind CSS through the Vite integration.
- [ ] Add a `vite.config.js` alias from `@` to `src`.
- [ ] Add `jsconfig.json` so JavaScript imports resolve the same alias.
- [ ] Initialize shadcn/ui in JavaScript mode and commit `components.json`.
- [ ] Create `src/index.css` for Tailwind, shadcn theme variables, and app-level tokens.
- [ ] Import `src/index.css` from `src/main.jsx`.
- [ ] Keep `public/styles.css` temporarily and migrate it by surface; do not remove it until every legacy selector has been audited.
- [ ] Map the existing Moonlight colors to shadcn semantic tokens such as background, foreground, primary, muted, destructive, border, and ring.
- [ ] Add only the shadcn components needed by the component inventory above.
- [ ] Add `@tanstack/react-table` and lock the installed API version in `package-lock.json` before table work begins.

### Phase 1 acceptance checks

- [ ] The app builds and loads with both style layers enabled.
- [ ] The current visual hierarchy and light/dark contrast do not regress.
- [ ] Existing server startup and API routes are unchanged.
- [ ] No generated shadcn component contains TypeScript-only syntax.

## Phase 2 — Migrate Shared UI Components

- [ ] Replace `ConfirmDialog` with an `AlertDialog` wrapper that preserves the current promise-based `askConfirm` API.
- [ ] Replace `Toast` and its global timer with a `Sonner` host and calls from the existing action handlers.
- [ ] Refactor `AppTabs` to `Tabs`, keeping the existing admin-only visibility rules.
- [ ] Refactor `AuthPanel`, `AccessDenied`, and `EmptyState` using `Card`, `Alert`, `Badge`, `Button`, and `Empty` primitives.
- [ ] Refactor supplier and booster record forms using `Field`/`Label`, `Input`, `NativeSelect` or `Select`, and `Button`.
- [ ] Refactor rate settings controls, profit-report controls, filter bars, summary panels, and status indicators.
- [ ] Use `DropdownMenu` only for secondary row actions; keep high-risk or primary actions visibly labeled.
- [ ] Preserve visible focus styles, disabled reasons, escape-to-close, focus restoration, and mobile layouts.

### Phase 2 acceptance checks

- [ ] Every interactive control is keyboard reachable and has a visible focus state.
- [ ] Destructive actions still require confirmation and use destructive styling.
- [ ] Admin-only controls remain absent for boosters.
- [ ] Forms retain their current defaults, validation constraints, submit payloads, and error behavior.
- [ ] Loading, empty, error, unauthorized, and success states remain distinguishable.

## Phase 3 — Build the Shared Data-Table Layer

Create a small reusable layer rather than one oversized table component:

```text
src/components/data-table/
├── DataTable.jsx
├── DataTableColumnHeader.jsx
├── DataTablePagination.jsx
├── DataTableToolbar.jsx
└── DataTableViewOptions.jsx
```

- [ ] Render TanStack header groups, rows, and cells with shadcn/ui `Table` primitives.
- [ ] Support controlled sorting, column filters, pagination, row selection, and column visibility.
- [ ] Use stable domain IDs through `getRowId: (row) => String(row.id)`; never use the visual row index as identity.
- [ ] Provide an accessible sortable header with a text label and sort direction.
- [ ] Provide page-size choices of 25, 50, and 100 rows, with 25 as the default.
- [ ] Reset the page index when a filter changes and clamp it when data refresh removes the current page.
- [ ] Add horizontal overflow behavior for narrow viewports without hiding critical status or action controls.
- [ ] Keep an explicit empty-row message and avoid rendering a fake table solely for loading or error states.
- [ ] Keep table state controlled only where a parent workflow needs it; avoid duplicating the same filter or selection in both page state and table state.

### Selection rules

- Supplier rows are selectable only when `record.correct && !record.paid`.
- Booster rows are selectable only for admins and only when `!record.paid`.
- The header checkbox selects eligible rows on the current filtered page.
- Selection persists while paging but clears when filters, view, or refreshed data invalidate a row.
- Bulk actions derive their payload from selected original records, not visible indexes.
- The toolbar always shows the exact selected count before export, supplier payment, or booster payment.

## Phase 4 — Migrate Supplier Tables

### Unpaid supplier records

- [ ] Define supplier columns in a dedicated module or column factory so permission and callback dependencies stay explicit.
- [ ] Move status, service, and date filtering into TanStack controlled column-filter state.
- [ ] Add opt-in sorting for date, buyer, service, quantity, saved rate, amount, and verified status.
- [ ] Preserve current incoming order until the user selects a sort.
- [ ] Preserve selection eligibility and selected export/mark-paid behavior.
- [ ] Preserve inline editing in the first pass, using shadcn inputs and selects inside cells.
- [ ] Keep the verified toggle permission-gated and clearly labeled.
- [ ] Derive the supplier summary from the same filtered and selected original rows used by the table so totals cannot drift from the active payout batch.

### Paid supplier history

- [ ] Keep payment-batch grouping and expand/collapse behavior.
- [ ] Convert each expanded batch’s record list to TanStack Table with sorting and pagination where needed.
- [ ] Keep batch export and reopen actions outside the nested table.
- [ ] Preserve the batch ID, paid-by, paid date, row count, and total as visible audit context.

### Supplier acceptance checks

- [ ] Unverified rows can never enter export or mark-paid payloads.
- [ ] Selection and totals still refer to records by stable ID after sorting or pagination.
- [ ] Editing a row does not save stale data after the active row changes.
- [ ] Reopened payments return to the unpaid workflow after refresh.
- [ ] Currency and date formatting match the existing `money` and `dateOnly` utilities.

## Phase 5 — Migrate Booster Records

- [ ] Define separate admin and personal column sets from a shared column factory.
- [ ] Move view, booster, key-level, and date filtering into controlled TanStack state.
- [ ] Add opt-in sorting for date, booster, key level, runs, saved rate, payout, status, and paid date.
- [ ] Preserve the rule that boosters see only server-authorized personal records.
- [ ] Preserve the rule that boosters cannot edit `rateAtRecord`.
- [ ] Preserve paid/open/review badge logic and review-row emphasis.
- [ ] Preserve inline editing and exact patch payloads.
- [ ] Derive open totals, booster balances, review count, and selected payment rows from the same filtered original rows used by the table.

### Booster acceptance checks

- [ ] Personal and admin tables expose the correct columns and actions.
- [ ] Paid rows cannot be selected or edited through open-row actions.
- [ ] “Pay selected” sends exactly the selected eligible IDs, independent of sort order and page.
- [ ] Empty open, paid-history, and all-record views retain distinct guidance.

## Phase 6 — Remove Legacy Styles and Verify

- [ ] Search for remaining legacy class names and migrate each owning component.
- [ ] Remove only selectors proven unused from `public/styles.css`.
- [ ] Remove the stylesheet link from `index.html` after all required rules live in `src/index.css` or component utilities.
- [ ] Keep any genuinely shared custom utilities small, documented, and based on semantic theme tokens.
- [ ] Run the existing Node test suite and production build.
- [ ] Add focused UI tests for the table and permission workflows.
- [ ] Test at desktop, tablet, and mobile widths with keyboard-only navigation.

## Test Plan

Add a separate UI test setup using Vitest, React Testing Library, `user-event`, and jsdom while retaining the current Node test command for backend/domain tests.

### Automated coverage

- [ ] Column sorting for dates, numbers, currency values, and text.
- [ ] Combined status/service/date and booster/key-level/date filters.
- [ ] Conditional row selection and header-checkbox indeterminate state.
- [ ] Selection correctness after sorting, filtering, pagination, and data refresh.
- [ ] Exact bulk-action payloads for supplier export, supplier payment, and booster payment.
- [ ] Inline edit save/cancel behavior and permission-restricted fields.
- [ ] Admin versus booster column and action visibility.
- [ ] Loading, error, empty, and unauthorized rendering.
- [ ] Alert-dialog cancel, confirm, escape, and focus restoration.

### Manual smoke coverage

- [ ] Admin records, edits, verifies, selects, exports, and pays supplier rows.
- [ ] Admin filters and reopens a paid supplier batch.
- [ ] Admin records, edits, selects, and pays booster rows.
- [ ] Booster records a run and cannot see or mutate admin-only data.
- [ ] Keyboard navigation works through tabs, filters, sortable headers, checkboxes, row actions, pagination, and dialogs.
- [ ] Tables remain usable at 320 px width and do not place important actions behind clipped content.

## Migration Order

1. Foundation and theme tokens.
2. Shared primitives and feedback components.
3. Shared data-table renderer.
4. Supplier unpaid records.
5. Booster records.
6. Supplier paid-history records.
7. Simple summary/profit tables.
8. Legacy CSS removal and regression testing.

Each step should be independently buildable and reviewable. Avoid converting every component in one change set.

## Risks and Guardrails

- **Mixed CSS cascade:** Tailwind and `public/styles.css` may conflict during migration. Keep legacy styles temporarily, migrate by surface, and verify responsive breakpoints after each phase.
- **Bulk-action safety:** Sorting and pagination can make selected rows less obvious. Use stable IDs, current-page select-all, an exact selected count, and the existing confirmation step.
- **Derived totals:** Supplier summaries and booster balances can diverge if filters exist in two places. Use the TanStack filtered row model as the single source for table-derived totals.
- **Polling refresh:** The app refreshes data in the background. Reconcile controlled selection and editing state when IDs disappear, become paid, or become ineligible.
- **Inline editing:** A table rerender can reset draft values. Keep draft state keyed by record ID and add save/cancel regression tests.
- **Permissions:** shadcn and TanStack are presentation tools only. Continue enforcing authorization on the server.
- **Library API drift:** Follow the API of the locked installed TanStack version; do not mix v8 and v9 examples.

## Definition of Done

- [ ] All listed shared UI surfaces use shadcn/ui primitives or documented app-specific wrappers.
- [ ] All three domain record tables use TanStack Table for their applicable behavior.
- [ ] Existing API payloads, permission rules, confirmation flows, and payout calculations are unchanged.
- [ ] Existing tests pass and the production build succeeds.
- [ ] New UI tests cover selection, filters, sorting, editing, bulk actions, states, and role differences.
- [ ] No obsolete global selectors or duplicate table/filter state remain.
- [ ] Desktop and mobile workflows pass the manual smoke checklist.

## Gateway Intents

No new Discord Gateway Intents are required. This is a frontend-only refactor; Discord OAuth and existing server-side role checks remain unchanged.

## References

- [shadcn/ui installation for an existing Vite app](https://ui.shadcn.com/docs/installation/vite)
- [shadcn/ui JavaScript configuration](https://ui.shadcn.com/docs/javascript)
- [shadcn/ui data-table guide](https://ui.shadcn.com/docs/components/data-table)
- [TanStack Table React documentation](https://tanstack.com/table/latest/docs/framework/react)
