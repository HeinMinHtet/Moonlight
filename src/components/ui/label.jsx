import React from "react";
import { cn } from "@/lib/utils.js";

export function Label({ className, ...props }) {
  return <label className={cn("text-xs font-bold uppercase tracking-wide text-muted-foreground", className)} {...props} />;
}
