import React from "react";
import { ChartNoAxesCombined, Coins, History, ScrollText, SlidersHorizontal } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.jsx";

const tabs = [
  { id: "supplier", label: "Sales ledger", icon: ScrollText, adminOnly: true },
  { id: "supplierHistory", label: "Paid history", icon: History, adminOnly: true },
  { id: "booster", label: "Booster payouts", icon: Coins },
  { id: "profit", label: "Profit report", icon: ChartNoAxesCombined, adminOnly: true },
  { id: "prices", label: "Default rates", icon: SlidersHorizontal, adminOnly: true }
];

export function AppTabs({ activeTab, isAdmin, onChange }) {
  const visibleTabs = tabs.filter((tab) => !tab.adminOnly || isAdmin);

  return (
    <Tabs value={activeTab} onValueChange={onChange} className="ledger-navigation" aria-label="Ledger sections">
      <TabsList className="ledger-navigation-list" aria-label="Workspace views">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger key={tab.id} value={tab.id} className="ledger-navigation-item">
              <Icon className="size-4" aria-hidden="true" />
              <span>{tab.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
