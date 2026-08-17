import React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils.js";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold leading-none",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-white",
        outline: "border-border text-foreground",
        success: "border-success/50 bg-success/15 text-success-foreground",
        warning: "border-warning/50 bg-warning/15 text-warning-foreground",
        info: "border-primary/50 bg-primary/15 text-accent",
        neutral: "border-border bg-muted text-muted-foreground",
        admin: "border-warning/50 bg-warning/15 text-warning-foreground"
      }
    },
    defaultVariants: { variant: "default" }
  }
);

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
