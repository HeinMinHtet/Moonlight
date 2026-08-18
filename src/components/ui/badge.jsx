import React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils.js";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold leading-none tracking-wide",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground font-bold shadow-sm",
        secondary: "border-border/60 bg-secondary text-slate-200",
        destructive: "border-rose-500/40 bg-rose-500/15 text-rose-300 font-bold",
        outline: "border-border/80 bg-card/60 text-foreground",
        success: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 font-bold",
        warning: "border-amber-500/40 bg-amber-500/15 text-amber-300 font-bold",
        info: "border-primary/40 bg-primary/15 text-primary font-bold",
        neutral: "border-border/60 bg-muted/80 text-slate-300",
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
