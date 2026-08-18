import React from "react";
import { cn } from "@/lib/utils.js";

export function Alert({ className, variant = "default", ...props }) {
  return (
    <div
      role="alert"
      className={cn(
        "relative rounded-2xl border border-border/80 bg-card/90 px-5 py-4 text-sm shadow-md backdrop-blur-md",
        variant === "destructive" && "border-destructive/50 bg-destructive/15 text-rose-200",
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
