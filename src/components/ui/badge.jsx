import React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils.js";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold leading-none tracking-wide",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground font-bold shadow-sm",
        secondary: "border-border/60 bg-secondary text-foreground",
        destructive: "border-destructive/40 bg-destructive/15 text-danger-text font-bold",
        outline: "border-border/80 bg-card/60 text-foreground",
        success: "border-success/40 bg-success/15 text-success-text font-bold",
        warning: "border-warning/40 bg-warning/15 text-warning-text font-bold",
        info: "border-primary/40 bg-primary/15 text-primary font-bold",
        neutral: "border-border/60 bg-muted/80 text-secondary-foreground",
        admin: "border-warning/40 bg-warning/15 text-warning-text font-bold",
        booster: "border-special/40 bg-special/15 text-special-text font-bold"
      }
    },
    defaultVariants: { variant: "default" }
  }
);

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
