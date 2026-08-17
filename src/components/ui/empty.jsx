import React from "react";
import { cn } from "@/lib/utils.js";

export function Empty({ className, ...props }) {
  return <div className={cn("ui-page-state", className)} {...props} />;
}

export function EmptyTitle({ className, ...props }) {
  return <h3 className={cn("ui-page-state-title", className)} {...props} />;
}

export function EmptyDescription({ className, ...props }) {
  return <p className={cn("ui-page-state-description", className)} {...props} />;
}
