import React from "react";
import { ShieldAlert } from "lucide-react";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty.jsx";

export function AccessDenied({ title = "Admin access required", message = "Sign in with an allowed Discord admin role to view this page." }) {
  return (
    <Empty className="min-h-64 rounded-2xl border border-border/80 bg-card/90 shadow-md backdrop-blur-md">
      <span className="mb-3 rounded-full border border-amber-500/30 bg-amber-500/15 p-3 text-amber-300 shadow-sm"><ShieldAlert className="size-6" aria-hidden="true" /></span>
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>{message}</EmptyDescription>
    </Empty>
  );
}
