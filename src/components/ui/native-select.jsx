import React from "react";
import { cn } from "@/lib/utils.js";

export function NativeSelect({ className, children, ...props }) {
  return (
    <select
      className={cn(
        "flex min-h-11 w-full rounded-xl border border-input bg-popover/80 px-3 py-2 text-base text-foreground shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
