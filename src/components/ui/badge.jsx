import React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils.js";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold leading-none tracking-wide",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground font-bold shadow-sm",
        secondary: "border-border/60 bg-secondary text-secondary-foreground",
        destructive: "border-destructive/40 bg-destructive/15 text-rose-300",
        outline: "border-border/80 bg-card/60 text-foreground",
        success: "border-success/40 bg-success/15 text-success-foreground",
        warning: "border-warning/40 bg-warning/15 text-warning-foreground",
        info: "border-primary/40 bg-primary/15 text-primary",
        neutral: "border-border/60 bg-muted/80 text-muted-foreground",
        admin: "border-amber-500/40 bg-amber-500/15 text-amber-300 font-bold",
        booster: "border-indigo-400/40 bg-indigo-500/15 text-indigo-200 font-bold"
      }
    },
    defaultVariants: { variant: "default" }
  }
);

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
