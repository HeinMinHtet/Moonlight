import React from "react";
import { Badge } from "@/components/ui/badge.jsx";
import { buttonVariants } from "@/components/ui/button.jsx";
import { Card, CardContent } from "@/components/ui/card.jsx";
import { cn } from "@/lib/utils.js";

export function AuthPanel({ user, role, isAdmin, discordConfigured, discordOAuthConfigured, discordRolesConfigured, permissions }) {
  const permissionItems = [];
  if (permissions.canUseSupplier) permissionItems.push("Sales ledger");
  if (permissions.canUseBooster) permissionItems.push(isAdmin ? "All booster payouts" : "My payout");
  if (permissions.canMarkSupplierPaid) permissionItems.push("Supplier payments");
  if (permissions.canMarkBoosterPaid) permissionItems.push("Booster payments");
  if (permissions.canDeleteSupplierRows || permissions.canDeleteBoosterRows) permissionItems.push("Delete rows");
  if (permissions.canEditPrices) permissionItems.push("Default rates");
  if (!permissionItems.length) permissionItems.push("Sign in to continue");

  const hint = (() => {
    if (!discordOAuthConfigured) return "Discord OAuth is not configured on the server.";
    if (!discordRolesConfigured) return "Discord server and role IDs are not configured on the server.";
    if (isAdmin) return "Admin workspace active. You can manage sales, payouts, and rates.";
    if (role === "booster") return "Booster workspace active. You can record runs and track your payout.";
    return "Sign in with a Discord admin or booster role.";
  })();

  const loginDisabled = Boolean(user || !discordConfigured);

  return (
    <Card className="mb-4 border-t-2 border-t-primary/80">
      <CardContent className="flex flex-col items-start gap-4 p-4 lg:flex-row lg:items-center">
        <div className="min-w-56 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-wider text-primary">Discord access</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{hint}</p>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2" aria-label="Current access">
          <Badge variant={isAdmin ? "admin" : role === "booster" ? "booster" : "neutral"}>
            {user ? (isAdmin ? "Admin" : "Booster") : "Guest"}
          </Badge>
          <ul className="flex flex-wrap gap-1.5">
            {permissionItems.map((item) => <li key={item}><Badge variant="secondary">{item}</Badge></li>)}
          </ul>
        </div>
        <a
          className={cn(buttonVariants(), loginDisabled && "pointer-events-none opacity-50")}
          href="/auth/discord"
          aria-disabled={loginDisabled}
          tabIndex={loginDisabled ? -1 : 0}
        >
          {user ? "Signed in with Discord" : discordConfigured ? "Sign in with Discord" : "Discord setup needed"}
        </a>
      </CardContent>
    </Card>
  );
}
