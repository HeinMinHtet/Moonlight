import React from "react";
import { ShieldAlert } from "lucide-react";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty.jsx";

export function AccessDenied({ title = "Admin access required", message = "Sign in with an allowed Discord admin role to view this page." }) {
  return (
    <Empty className="min-h-64 bg-card shadow-sm">
      <span className="mb-3 rounded-full bg-amber-950/50 p-3 text-amber-300"><ShieldAlert className="size-6" aria-hidden="true" /></span>
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>{message}</EmptyDescription>
    </Empty>
  );
}
