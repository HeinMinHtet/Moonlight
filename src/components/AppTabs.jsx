import React from "react";
import { Calculator, ChartNoAxesCombined, Coins, History, ListTodo, Receipt, ScrollText, SlidersHorizontal } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.jsx";

const tabs = [
  { id: "supplier", label: "Sales ledger", icon: ScrollText, adminOnly: true },
  { id: "supplierHistory", label: "Paid history", icon: History, adminOnly: true },
  { id: "notes", label: "Raid notes", icon: ListTodo, adminOnly: true },
  { id: "booster", label: "Booster payouts", icon: Coins },
  { id: "expenses", label: "Expenses", icon: Receipt, adminOnly: true },
  { id: "profit", label: "Profit report", icon: ChartNoAxesCombined, adminOnly: true },
  { id: "prices", label: "Default rates", icon: SlidersHorizontal, adminOnly: true },
  { id: "calculator", label: "Price calculator", icon: Calculator, adminOnly: true }
];

export function AppTabs({ activeTab, isAdmin, onChange, badges = {} }) {
  const visibleTabs = tabs.filter((tab) => !tab.adminOnly || isAdmin);

  return (
    <Tabs value={activeTab} onValueChange={onChange} className="ledger-navigation" aria-label="Ledger sections">
      <TabsList className="ledger-navigation-list" aria-label="Workspace views">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const badgeCount = badges[tab.id];
          return (
            <TabsTrigger key={tab.id} value={tab.id} className="ledger-navigation-item">
              <Icon className="size-4" aria-hidden="true" />
              <span>{tab.label}</span>
              {badgeCount > 0 && (
                <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30 font-mono">
                  {badgeCount}
                </span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
