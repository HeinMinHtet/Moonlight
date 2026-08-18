import React from "react";
import { cn } from "@/lib/utils.js";

export function Input({ className, type, ...props }) {
  return (
    <input
      type={type}
      className={cn(
        "flex min-h-11 w-full rounded-xl border border-input bg-popover/80 px-3 py-2 text-base text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm",
        className
      )}
      {...props}
    />
  );
}
