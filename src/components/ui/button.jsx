import React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils.js";

export const buttonVariants = cva(
  "inline-flex shrink-0 touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "border border-primary/90 bg-primary text-primary-foreground font-bold shadow-[0_4px_16px_rgba(56,189,248,0.25)] hover:bg-primary/90 hover:shadow-[0_6px_22px_rgba(56,189,248,0.35)] active:scale-[0.98]",
        destructive: "border border-destructive/80 bg-destructive text-white font-bold shadow-[0_4px_16px_rgba(244,63,94,0.25)] hover:bg-destructive/90 hover:shadow-[0_6px_22px_rgba(244,63,94,0.35)] active:scale-[0.98]",
        outline: "border border-border/80 bg-card/80 text-foreground shadow-sm hover:border-primary/50 hover:bg-secondary hover:text-foreground active:scale-[0.98]",
        secondary: "border border-border/60 bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-[0.98]",
        ghost: "bg-transparent text-foreground/90 hover:bg-secondary hover:text-foreground active:scale-[0.98]",
        link: "bg-transparent text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "min-h-11 px-4 py-2",
        sm: "min-h-10 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-md px-8",
        icon: "size-11"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
