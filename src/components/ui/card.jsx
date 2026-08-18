import React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils.js";

export function Card({ className, asChild = false, ...props }) {
  const Comp = asChild ? Slot : "section";
  return <Comp className={cn("rounded-2xl border border-border/80 bg-card/90 text-card-foreground shadow-[0_16px_40px_-10px_rgba(0,0,0,0.4)] backdrop-blur-md", className)} {...props} />;
}

export function CardHeader({ className, ...props }) {
  return <header className={cn("flex flex-col gap-1.5 p-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }) {
  return <p className={cn("text-sm leading-relaxed text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }) {
  return <footer className={cn("flex items-center p-5 pt-0", className)} {...props} />;
}
