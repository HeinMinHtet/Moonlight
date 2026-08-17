import React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils.js";

export const buttonVariants = cva(
  "inline-flex shrink-0 touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        default: "border border-primary/70 bg-primary text-primary-foreground shadow-[0_8px_24px_rgb(3_12_20_/_0.2)] hover:bg-primary/90",
        destructive: "border border-destructive/70 bg-destructive text-white shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-card/80 text-foreground shadow-sm hover:border-primary/60 hover:bg-secondary",
        secondary: "border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "bg-transparent text-foreground hover:bg-secondary hover:text-secondary-foreground",
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
