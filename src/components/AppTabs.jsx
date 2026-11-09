import React from "react";
import { Calculator, ChartNoAxesCombined, Coins, History, ListTodo, Receipt, ScrollText, SlidersHorizontal, Wallet } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.jsx";

// Top-level groups, in navbar order. Each item id is an internal tab id used by App.jsx.
export const NAV_GROUPS = [
  {
    id: "sales",
    label: "Sales",
    icon: ScrollText,
    adminOnly: true,
    items: [
      { id: "supplier", label: "Sales ledger", icon: ScrollText, route: "sales" },
      { id: "supplierHistory", label: "Paid history", icon: History, route: "sales/paid" }
    ]
  },
  {
    id: "booster",
    label: "Booster payouts",
    icon: Coins,
    items: [{ id: "booster", label: "Booster payouts", icon: Coins, route: "boosters" }]
  },
  {
    id: "finance",
    label: "Income & Expense",
    icon: Wallet,
    adminOnly: true,
    items: [
      { id: "expenses", label: "Expenses", icon: Receipt, route: "finance/expenses" },
      { id: "profit", label: "Profit report", icon: ChartNoAxesCombined, route: "finance/profit" },
      { id: "calculator", label: "Price calculator", icon: Calculator, route: "finance/calculator" }
    ]
  },
  {
    id: "prices",
    label: "Default rates",
    icon: SlidersHorizontal,
    adminOnly: true,
    items: [{ id: "prices", label: "Default rates", icon: SlidersHorizontal, route: "rates" }]
  },
  {
    id: "notes",
    label: "Raid notes",
    icon: ListTodo,
    adminOnly: true,
    items: [{ id: "notes", label: "Raid notes", icon: ListTodo, route: "notes" }]
  }
];

const ALL_ITEMS = NAV_GROUPS.flatMap((group) => group.items.map((item) => ({ ...item, group })));

export const ADMIN_ONLY_TABS = ALL_ITEMS.filter((item) => item.group.adminOnly).map((item) => item.id);

export function groupForTab(tabId) {
  return ALL_ITEMS.find((item) => item.id === tabId)?.group || NAV_GROUPS[1];
}

export function hashForTab(tabId) {
  const item = ALL_ITEMS.find((entry) => entry.id === tabId);
  return item ? `#/${item.route}` : "";
}

export function tabFromHash(hash) {
  const route = String(hash || "").replace(/^#\/?/, "").replace(/\/+$/, "");
  if (!route) return null;
  return ALL_ITEMS.find((item) => item.route === route)?.id || null;
}

export function canOpenTab(tabId, isAdmin) {
  const item = ALL_ITEMS.find((entry) => entry.id === tabId);
  return Boolean(item) && (isAdmin || !item.group.adminOnly);
}

function CountBadge({ count }) {
  if (!(count > 0)) return null;
  return (
    <span className="ml-1 rounded-full border border-warning/30 bg-warning/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-warning-text">
      {count}
    </span>
  );
}

export function AppTabs({ activeTab, isAdmin, onChange, badges = {} }) {
  const visibleGroups = NAV_GROUPS.filter((group) => !group.adminOnly || isAdmin);
  const activeGroup = groupForTab(activeTab);
  const groupBadge = (group) => group.items.reduce((sum, item) => sum + Number(badges[item.id] || 0), 0);

  return (
    <nav className="ledger-navigation" aria-label="Ledger sections">
      <Tabs
        value={activeGroup.id}
        onValueChange={(groupId) => {
          const group = NAV_GROUPS.find((entry) => entry.id === groupId);
          if (group && group.id !== activeGroup.id) onChange(group.items[0].id);
        }}
      >
        <TabsList className="ledger-navigation-list grid h-auto" aria-label="Workspace views">
          {visibleGroups.map((group) => {
            const Icon = group.icon;
            return (
              <TabsTrigger key={group.id} value={group.id} className="ledger-navigation-item">
                <Icon className="size-4" aria-hidden="true" />
                <span>{group.label}</span>
                <CountBadge count={groupBadge(group)} />
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {activeGroup.items.length > 1 && (
        <Tabs value={activeTab} onValueChange={onChange}>
          <TabsList className="ledger-subnav-list flex h-auto w-full flex-wrap justify-start" aria-label={`${activeGroup.label} views`}>
            {activeGroup.items.map((item) => {
              const Icon = item.icon;
              return (
                <TabsTrigger key={item.id} value={item.id} className="ledger-subnav-item">
                  <Icon className="size-4" aria-hidden="true" />
                  <span>{item.label}</span>
                  <CountBadge count={badges[item.id]} />
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      )}
    </nav>
  );
}
