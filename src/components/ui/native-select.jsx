import React from "react";
import { cn } from "@/lib/utils.js";

export function NativeSelect({ className, children, ...props }) {
  return (
    <select
      className={cn(
        "flex min-h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-base text-foreground shadow-inner outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
