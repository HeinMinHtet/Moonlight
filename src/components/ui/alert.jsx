import React from "react";
import { cn } from "@/lib/utils.js";

export function Alert({ className, variant = "default", ...props }) {
  return (
    <div
      role="alert"
      className={cn(
        "relative rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-sm",
        variant === "destructive" && "border-destructive/60 bg-destructive/15 text-foreground",
        className
      )}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }) {
  return <h3 className={cn("mb-1 font-semibold leading-none", className)} {...props} />;
}

export function AlertDescription({ className, ...props }) {
  return <div className={cn("text-sm leading-relaxed text-muted-foreground", className)} {...props} />;
}
