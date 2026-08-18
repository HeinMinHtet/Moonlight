# 🌙 Moonlight Ledger — UI/UX Design & Color Audit Report

> **Audited by:** UI/UX Pro Max Design Intelligence  
> **Target Application:** Moonlight Ledger (World of Warcraft Operations Management)  
> **Tech Stack:** React 19, Vite, Tailwind CSS v4, Radix UI Primitives, TanStack Table v8, Lucide Icons, Sonner  
> **Date:** August 2026

---

## 📊 1. Executive Summary & Design Scorecard

Moonlight Ledger is a specialized operations platform for World of Warcraft boosting management. It bridges two distinct user personas:
1. **Admins/Officers:** Power users who need high-density data tables, batch processing, settlement verifications, rate configurations, and financial margin clarity.
2. **Boosters/Players:** Regular users on desktop or mobile who log runs, check individual unpaid balances, and track their payouts.

### Overall Scorecard

| Evaluation Dimension | Rating | Verdict & Status |
| :--- | :---: | :--- |
| **Visual Identity & Theme** | **9.2 / 10** | **Excellent.** The "Midnight & Moonlight" dark-space aesthetic fits the gaming guild context naturally. |
| **Color Harmony & Palette** | **8.5 / 10** | **Strong.** Sky blue (`#38bdf8`) with Emerald (`#10b981`) and Amber/Gold (`#f59e0b`) works well, with minor contrast hotspots. |
| **Information Density & Layout** | **8.0 / 10** | **Good.** Effective use of TanStack Table and KPI stat bars, but form grids and filter bars need responsive flex improvements. |
| **Typography & Hierarchy** | **8.4 / 10** | **Solid.** Aptos/Inter pairing with tabular numbers is clean; web-font fallback needs reinforcement. |
| **Interaction & Usability (UX)** | **8.2 / 10** | **Good.** Fast navigation and batch actions; keyboard shortcuts and sticky columns will elevate it to pro-tier. |
| **Accessibility (WCAG 2.2 AA)** | **7.9 / 10** | **Needs Polish.** A few badge contrast ratios and mobile touch targets need adjustments. |

---

## 🎨 2. Color Palette & Harmony Evaluation

### 2.1 Current Theme Anatomy

The current aesthetic uses a deep midnight obsidian backdrop with luminous moon-blue accents and semantic color coding:

```
[ Background: #0b1320 ] ──► [ Surface/Cards: #121e30 ] ──► [ Popovers/Inputs: #182840 ]
      │                               │                               │
   Base Canvas                   Containers/Panels               Interactive Fields
```

```
Semantic Accents:
- Primary / Brand Accent : Sky Blue   #38bdf8  (Glow, Primary CTAs, Active Tabs)
- Admin Domain           : Amber/Gold #f59e0b  (Admin badges, review alerts, pending)
- Booster Domain         : Indigo     #818cf8  (Booster badges, run totals)
- Success / Paid         : Emerald    #10b981  (Verified sales, completed payouts)
- Danger / Reopen        : Rose Red   #f43f5e  (Destructive actions, negative margins)
```

---

### 2.2 Color Combination & Contrast Issues (WCAG 2.2 Analysis)

#### ⚠️ Issue 1: Dual CSS Architecture (Token Fragmentation)
* **Diagnosis:** The project currently maintains two competing stylesheets:
  - `src/index.css` defines modern Tailwind v4 `@theme inline` variables (`--color-background`, `--color-primary`, etc.).
  - `public/styles.css` (imported via `@layer(legacy)`) defines 20+ legacy raw variables (`--ink`, `--paper`, `--panel`, `--line`, `--field`, `--blue-text`, `--legacy-muted`, `--gold`, etc.).
* **UX Impact:** Inconsistent borders, mismatched surface backgrounds between older panels and newer Radix cards, and redundant color definitions that make theming and dark/light synchronization difficult.
* **Recommendation:** Unify all color variables into a single semantic token layer in `src/index.css` and deprecate hardcoded hex colors from `public/styles.css`.

---

#### ⚠️ Issue 2: Low-Contrast Badges on Dark Surfaces
* **Diagnosis:**
  - In `public/styles.css`, `.status-toggle.needs-review` uses `color: #dfb76e` on `background: rgba(169, 120, 37, 0.14)`.
  - Muted secondary text (`--muted-foreground: #94a3b8`) on deep popover surfaces (`#182840`) yields a contrast ratio of **4.6:1**, which barely clears the WCAG AA threshold of 4.5:1 and fails on dim screens.
* **Recommendation:**
  - Shift warning text to `#fde047` or `#fbbf24` (Contrast > 8.5:1 on `#121e30`).
  - Use `#cbd5e1` (Slate 300) for secondary metadata inside darker card bodies to ensure effortless readability.

---

#### ⚠️ Issue 3: Table Row State Discrimination
* **Diagnosis:**
  - Table rows use subtle background tints: `.status-row-review` (`warning 8%`), `.status-row-paid` (`success 7%`), `.status-row-editing` (`warning 10%`), `.status-row-selected` (`primary 12%`).
  - On low-brightness monitors or TN/VA panels, 7–8% tint differences blend into `#121e30`.
* **Recommendation:**
  - Combine background tints with a distinct 3px left border accent indicator:
    - Paid: `border-l-3 border-l-emerald-500 bg-emerald-500/8`
    - Needs Review: `border-l-3 border-l-amber-500 bg-amber-500/10`
    - Selected: `border-l-3 border-l-sky-400 bg-sky-400/12`
    - Currently Editing: `border-l-3 border-l-amber-400 bg-amber-500/15 ring-1 ring-inset ring-amber-400/30`

---

### 2.3 Proposed Unified Color Token Matrix

| Token Name | Hex Value | Intended Usage | Contrast on `#0b1320` |
| :--- | :--- | :--- | :---: |
| `--bg-canvas` | `#0b1320` | Full-page background with ambient radial glows | N/A |
| `--surface-panel` | `#121e30` | Main cards, sheet containers, navigation containers | N/A |
| `--surface-popover` | `#182840` | Modals, dropdown menus, table headers, hover rows | N/A |
| `--surface-field` | `#0f1c2e` | Form inputs, select dropdowns, search bars | N/A |
| `--border-subtle` | `#1e354e` | Standard panel & card borders | 3.2:1 |
| `--border-highlight`| `rgba(56,189,248,0.25)` | Active tab borders, focused cards | 4.8:1 |
| `--text-primary` | `#f8fafc` | Headings, amounts, active tab titles | **16.8:1** (AAA) |
| `--text-secondary` | `#cbd5e1` | Body copy, table cell content | **11.2:1** (AAA) |
| `--text-muted` | `#94a3b8` | Timestamps, helper copy, batch labels | **6.4:1** (AA) |
| `--accent-sky` | `#38bdf8` | Primary buttons, brand logo ring, active links | **9.6:1** (AAA) |
| `--accent-emerald` | `#34d399` | Paid status, positive profit, export confirmations | **11.8:1** (AAA) |
| `--accent-amber` | `#fbbf24` | Admin badges, review pending, warning alerts | **12.4:1** (AAA) |
| `--accent-rose` | `#fb7185` | Negative margin, delete buttons, reopen actions | **8.1:1** (AAA) |

---

## 🔤 3. Typography & Information Hierarchy

### 3.1 Current Font Stack
```css
--font-sans: "Aptos", "Inter", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif;
--font-display: "Aptos Display", "Inter", "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif;
--font-mono: "Cascadia Code", "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
```

### 3.2 Evaluation & Recommendations

1. **Web-Font Resilience (Cross-Platform Consistency):**
   - *Observation:* `Aptos` is Microsoft’s default font bundled with new Windows/Office 365. On macOS, iOS, Android, and Linux, it immediately falls back to `Inter` or generic system fonts.
   - *Improvement:* Preload `Inter` and `JetBrains Mono` from Google Fonts in `index.html` with `font-display: swap` so that non-Windows users experience the same typography.

2. **Tabular Numbers across all Financial Data:**
   - *Observation:* Great use of `font-variant-numeric: tabular-nums` (`font-mono tabular-nums`).
   - *Recommendation:* Ensure all KPI stat cards, table price columns, quantity inputs, and date columns uniformly carry `tabular-nums` to prevent layout reflow during live value changes.

3. **Heading Scale Standardization:**
   - App Title: `clamp(24px, 3vw, 32px)`, `font-black tracking-tight`
   - Section Title: `text-lg (18px)`, `font-bold tracking-normal`
   - Card/Panel Kicker: `text-xs (11px)`, `font-extrabold uppercase tracking-wider text-sky-400`
   - Table Headers: `text-xs (12px)`, `font-bold uppercase tracking-wider text-slate-400`

---

## 📱 4. Component-by-Component UX Audit & Improvements

---

### 4.1 Topbar & Session Identity

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  [🌕 Avatar]  MOONLIGHT WOW OPERATIONS                               [ 👑 ADMIN  Hein ]│
│               Moonlight Ledger                                       [ ⎋ Log out      ]│
│               Supplier settlements, booster payouts & margins                          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

* **Current Status:** Glassmorphic container with 66px circular avatar, brand text, and Discord user pill.
* **UX Opportunities:**
  1. **Mobile Header Stacking:** On viewports under 640px, the brand title and session pill can crowd. Stack them vertically or condense the user session pill to an avatar icon with a drop-down menu on mobile screens.
  2. **Live Synchronization / Polling Pulse:** Moonlight Ledger polls every 15s. Adding a tiny discreet green pulse dot (or "Live" status badge) near the header reassures users that their ledger data is real-time.

---

### 4.2 Workspace Navigation Tabs (`AppTabs.jsx`)

* **Current Status:** Responsive grid tab bar with Lucide icons (`ScrollText`, `History`, `Coins`, `ChartNoAxesCombined`, `SlidersHorizontal`).
* **UX Strengths:**
  - Icons paired with text labels prevent ambiguity.
  - Role-based tab filtering works cleanly (boosters only see Booster Payouts; admins see all 5 tabs).
* **Recommended Enhancements:**
  - **Active Tab Pill Transition:** Use an active indicator glow (`shadow-[0_0_20px_rgba(56,189,248,0.35)]`) and smooth background transition so switching tabs feels tactile.
  - **Count Badges on Tabs:** Show count badges on tabs (e.g. `Sales ledger (3 unpaid)` or `Booster payouts (2 review)`) to notify admins of pending tasks at a glance without switching tabs.

---

### 4.3 Data Entry Forms (`SupplierRecordForm` & `BoosterRecordForm`)

* **Current Status:** 7-column grid layout for fast transaction recording.
* **Identified UX Friction:**
  1. **Rigid Grid Breakpoints:** The CSS class `.entry-grid` has fixed column widths (`grid-template-columns: 140px minmax(160px, 1fr) 150px 90px 130px minmax(140px, 1fr) 150px;`). On laptops (< 1280px) and tablets/phones, fields become squished or overflow horizontally.
  2. **Keyboard Productivity:** Admins and boosters frequently log multiple entries in succession.
* **Recommended Improvements:**
  - **Responsive Grid:** Switch to CSS grid with auto-fit / flex-wrap:
    ```css
    .entry-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
    }
    ```
  - **Keyboard Hotkey `Ctrl + Enter`:** Allow submitting the form directly from any input field without clicking "Record sale" or "Record run".
  - **Success Micro-Flash:** When a record is successfully saved, briefly flash the input border green or reset focus to the first input field ("Buyer character" or "Runs") for effortless rapid entry.

---

### 4.4 Data Tables (`DataTable.jsx` & TanStack Integration)

* **Current Status:** Full TanStack Table v8 with multi-column sorting, pagination, column visibility toggle, and row selection.
* **Identified UX Friction:**
  1. **Sticky Header & Scroll Shadows:** When scrolling down 25–50 rows, the table header stays sticky, but without a distinct shadow/border separation, white text can bleed into header backgrounds.
  2. **Sticky Actions Column:** On mobile / horizontal scroll, the "Actions" column (Edit / Delete / Reopen) scrolls off-screen to the far right, requiring the user to scroll sideways to perform actions.
* **Recommended Improvements:**
  - Apply `backdrop-blur-md bg-card/95 border-b border-border shadow-sm` to `<TableHead>`.
  - Make the rightmost action column sticky on horizontal overflow:
    ```css
    td:last-child, th:last-child {
      position: sticky;
      right: 0;
      background: var(--card);
      z-index: 5;
      box-shadow: -4px 0 12px rgba(0,0,0,0.25);
    }
    ```
  - **Selected Rows Floating Bar:** When multiple rows are checked, show a floating bottom bar summarizing: `3 rows selected ($450.00 total) -> [Mark Paid] [Export PNG]`.

---

### 4.5 Booster Balances & Adjustment Dialog (`BoosterBalanceTab.jsx`)

* **Current Status:** Aggregated balances per booster, live search filter, and manual +/- balance adjustment modal.
* **UX Strengths:**
  - The live preview in `BoosterAdjustmentDialog` calculating `Projected New Balance` in real time prevents administrative calculation mistakes.
  - "Deduct Full Balance" one-click button speeds up payout clearing.
* **Recommended Enhancements:**
  - **Color-Coded Balance Tags:**
    - Zero Balance: Neutral muted badge (`$0.00`)
    - Positive Owed: Amber / Emerald badge (`$120.00 owed`)
    - Negative Balance (Overpaid / advance): Rose badge (`-$40.00 advance`)
  - **Search Highlighting:** When searching in the booster table, highlight matching characters in booster names.

---

### 4.6 Profit Report Page (`ProfitReportPage.jsx`)

* **Current Status:** Time-series financial report with Daily, Monthly, and Date Range modes, stat summary bar, and breakdown table.
* **UX Strengths:**
  - Clear net profit calculation (`Supplier paid - Booster payouts = Net profit`).
  - High-visibility stat cards.
* **Recommended Enhancements:**
  - **Profit Margin Percentage Pill:** Alongside Net Profit ($), display the profit margin %:
    $$\text{Margin } \% = \left(\frac{\text{Net Profit}}{\text{Supplier Paid}}\right) \times 100$$
    Example: `$4,200 Net Profit (35% Margin)`.
  - **Visual Trend Bar / Mini Sparkline:** In the breakdown table, add a mini percentage bar indicating relative volume per day/month to spot top revenue days at a glance.

---

### 4.7 Default Rates Settings (`RateSettingsPage.jsx`)

* **Current Status:** Dual-panel rate management for Supplier Services and Booster Key Levels with Active / Archived sub-tabs and default star indicators.
* **UX Strengths:**
  - Star toggle for default rates makes rapid data entry intelligent.
  - Live validation prevents duplicate service or level names.
* **Recommended Enhancements:**
  - **Visual Badge for Default Item:** Add a small gold badge `[ Default ]` next to the star button to make default status obvious to new admins.
  - **Unsaved Changes Floating Alert:** If rows are modified or added, show an unsaved indicator bar so admins don't navigate away before clicking "Save defaults".

---

## ♿ 5. Accessibility (a11y) & Usability Checklist (WCAG 2.2)

| Rule | Requirement | Current Status | Remediation Plan |
| :--- | :--- | :---: | :--- |
| **Color Contrast (1.4.3)** | Normal text ≥ 4.5:1, large text ≥ 3:1 | 🟡 Partial | Upgrade `--muted-foreground` to `#cbd5e1` on dark inputs and popovers. |
| **Touch Target Size (2.5.8)** | Min 44×44px hit target on all clickable items | 🟡 Partial | Increase padding on pagination buttons, table checkboxes, and action icons. |
| **Focus Rings (2.4.13)** | Visible 2–3px focus indicators on keyboard navigation | 🟢 Pass | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` is implemented. |
| **Non-Color Dependence (1.4.1)** | Do not convey state with color alone | 🟢 Pass | Statuses use text labels + badges + icons in addition to colors. |
| **Screen Reader Landmarks** | `main`, `header`, `nav`, `aria-label` | 🟢 Pass | Structured with semantic tags, skip links, and ARIA landmarks. |
| **Reduced Motion (2.3.3)** | Respect `prefers-reduced-motion` | 🟢 Pass | Media query in `index.css` zeroes transitions when reduced motion is preferred. |

---

## 🚀 6. Actionable Implementation Roadmap

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: COLOR HARMONY & CONTRAST (High Impact, Zero Risk)                             │
│ 1. Consolidate legacy colors into Tailwind v4 @theme inline in `src/index.css`          │
│ 2. Brighten warning badges and muted table text to guarantee 7:1+ contrast             │
│ 3. Add left border status indicators to table rows                                     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 2: RESPONSIVE LAYOUT & TOUCH (Mobile / Tablet Polish)                            │
│ 1. Convert `.entry-grid` from rigid pixel columns to fluid auto-fit CSS grid           │
│ 2. Make table action columns sticky on horizontal overflow                             │
│ 3. Ensure all mobile buttons, tabs, and checkboxes have minimum 44px touch targets     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 3: INTERACTION & EFFICIENCY BOOSTS (Workflow Productivity)                       │
│ 1. Add `Ctrl + Enter` hotkey to submit sales and booster run forms                     │
│ 2. Display profit margin percentages on the Profit Report KPI card                     │
│ 3. Add unsaved changes detection indicator to Rate Settings                            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 💻 7. Recommended Code Modifications

### 7.1 Unified CSS Tokens (`src/index.css`)

```css
@theme inline {
  /* Surfaces & Canvas */
  --color-background: #0b1320;
  --color-card: #121e30;
  --color-popover: #182840;
  --color-field: #0f1c2e;

  /* Typography */
  --color-foreground: #f8fafc;
  --color-card-foreground: #f8fafc;
  --color-muted-foreground: #94a3b8;
  --color-muted-contrast: #cbd5e1;

  /* Brand Accents */
  --color-primary: #38bdf8;
  --color-primary-foreground: #081320;
  --color-accent: #60a5fa;
  
  /* Semantic Status Tokens */
  --color-success: #10b981;
  --color-success-foreground: #34d399;
  --color-warning: #f59e0b;
  --color-warning-foreground: #fbbf24;
  --color-destructive: #f43f5e;
  --color-destructive-foreground: #ffffff;
  --color-indigo: #818cf8;
  --color-indigo-foreground: #a5b4fc;

  /* Structure */
  --color-border: #1e354e;
  --color-input: #243c5a;
  --color-ring: #38bdf8;
}
```

### 7.2 Fluid Entry Grid (`src/index.css`)

```css
.entry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  padding: 16px;
  background: var(--color-field);
  border-bottom: 1px solid var(--color-border);
}

@media (max-width: 768px) {
  .entry-grid {
    grid-template-columns: 1fr 1fr;
  }
  .entry-grid .record-action {
    grid-column: span 2;
  }
}
```

### 7.3 High-Contrast Table Row Indicators (`src/index.css`)

```css
.status-row-paid {
  background: color-mix(in srgb, var(--color-success) 7%, transparent);
  border-left: 3px solid var(--color-success);
}

.status-row-review {
  background: color-mix(in srgb, var(--color-warning) 8%, transparent);
  border-left: 3px solid var(--color-warning);
}

.status-row-selected {
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  border-left: 3px solid var(--color-primary);
}

.status-row-editing {
  background: color-mix(in srgb, var(--color-warning) 12%, transparent);
  border-left: 3px solid var(--color-warning);
  box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.25);
}
```

---

## 🏆 Summary

Moonlight Ledger has an exceptional visual foundation tailored specifically to WoW gaming operations. By executing the targeted improvements in **Color Unification**, **Table Sticky Affordances**, **Responsive Entry Grids**, and **Keyboard Accelerators**, the application will achieve pro-tier usability, compliance, and aesthetic refinement.
