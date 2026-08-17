# New Feature Requirements

This document captures the next feature set for the payout and reporting workspace.

## Goals

- Give admins a clear daily and monthly profit report.
- Keep page data current without requiring users to manually refresh.
- Keep booster payout visibility role-based.
- Improve the visual balance of key action buttons.
- Improve exported sales photo design and filename clarity.

## Feature 1: Daily and Monthly Profit Report

### Summary

Add reporting that calculates profit from supplier payments minus booster payouts.

Profit formula:

```text
profit = supplier paid total - booster payout total
```

### Requirements

- Add daily profit reporting.
- Add monthly profit reporting.
- Use supplier records that have been marked paid.
- Use booster payout records that have been marked paid.
- Show totals for:
  - supplier paid amount
  - booster payout amount
  - net profit
- Support filtering by date range.
- Keep daily and monthly calculations consistent with the saved paid dates, not the current record edit date.

### Acceptance Criteria

- Admin can view profit for a selected day.
- Admin can view profit for a selected month.
- Report totals update when paid supplier records or paid booster payout records change.
- Profit report does not include unpaid supplier records.
- Profit report does not include unpaid booster payout records.
- Booster users cannot access admin profit reporting unless explicitly granted later.

## Feature 2: Page Data Polling

### Summary

Some page data currently requires the user to refresh manually after records change. Add automatic data polling so active pages stay up to date.

### Requirements

- Add automatic polling for pages that display mutable payout data.
- Refresh visible data after create, edit, delete, mark paid, reopen, or status changes.
- Avoid excessive requests by using a reasonable polling interval.
- Pause or reduce polling when the browser tab is not visible.
- Preserve user filters, selected tabs, and form input while background data refreshes.
- Show updated totals without requiring a full page reload.

### Suggested Pages

- Supplier unpaid records
- Supplier paid history
- Booster payout page
- Profit report page
- Rate settings if default rate changes affect visible options

### Acceptance Criteria

- User sees updated records without manually refreshing the browser.
- Admin actions immediately update visible tables and summaries.
- Booster payout changes are reflected for both admin and affected booster views.
- Background refresh does not clear active filters or unsaved form fields.
- Polling does not create duplicate records or repeated payment actions.

## Feature 3: Booster Payout Tab Visibility

### Summary

Remove the `All records` tab from booster users in the booster payout page. Admins still need the `All records` tab.

### Requirements

- Booster users should only see payout data they are allowed to access.
- Admin users should continue to see the `All records` tab.
- Permission enforcement must happen on the server as well as the UI.
- Existing admin workflow must not lose access to all booster payout records.

### Acceptance Criteria

- Booster users do not see the `All records` tab.
- Booster users cannot access all records by manually calling the API.
- Admin users still see and can use the `All records` tab.
- Admin and booster views remain visually consistent after the tab is removed.

## Feature 4: Record Button UI Resize

### Summary

Resize the `Record sale` and `Record run` buttons for better UI and UX.

### Requirements

- Adjust button sizing so both actions feel balanced and easy to scan.
- Keep the buttons usable on desktop and mobile.
- Prevent button text from wrapping awkwardly.
- Keep styling consistent with the rest of the app.
- Preserve existing button behavior.

### Acceptance Criteria

- `Record sale` button is visually balanced with surrounding controls.
- `Record run` button is visually balanced with surrounding controls.
- Buttons remain easy to tap on mobile.
- Buttons do not overlap nearby content.
- No form submission or modal behavior changes unintentionally.

## Feature 5: Export Sales Photo Design and Filename

### Summary

Improve the exported sales photo so it looks cleaner and more professional, and update the exported file name to include the verified sales date range.

Filename format:

```text
Sale-{startDate}-{lastDate}
```

### Requirements

- Improve the visual design of the exported sales photo.
- Make the exported photo easier to read when shared outside the app.
- Include clear header information such as report title, date range, total rows, and total amount.
- Use only verified sales when determining the filename date range.
- Use the earliest verified sale date as `startDate`.
- Use the latest verified sale date as `lastDate`.
- Keep the filename consistent and safe for Windows/macOS file systems.
- Preserve the current export behavior unless the selected rows or filters already control which records are exported.

### Acceptance Criteria

- Exported sales photo has improved spacing, alignment, and readable typography.
- Exported sales photo includes enough context to understand what was exported.
- Export filename starts with `Sale`.
- Export filename includes the first and last dates from the verified sales included in the export.
- Filename does not use unpaid or unverified sales to determine the date range.
- Export still works when there is only one verified sale date.
- Export still works when multiple verified sales share the same date.

## Implementation Notes

- Profit reporting should be admin-only unless a later requirement says otherwise.
- Use saved paid timestamps for reporting periods so historical reports stay stable.
- Page data polling should be centralized where practical, so intervals and cleanup are consistent.
- Role-based tab visibility should not be treated as security by itself; API access must also be scoped.
- UI button resizing should be verified at both desktop and mobile widths.
- Export photo layout should be checked with short and long buyer, service, and note values.

## Suggested Implementation Order

1. Restrict booster `All records` tab visibility and confirm server-side access rules.
2. Resize `Record sale` and `Record run` buttons.
3. Improve sales photo export design and filename format.
4. Add page data polling for existing pages.
5. Add daily and monthly profit report after paid supplier and paid booster data refresh reliably.
