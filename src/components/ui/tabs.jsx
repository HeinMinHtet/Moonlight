import React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils.js";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }) {
  return (
    <TabsPrimitive.List
      className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-2xl border border-border/80 bg-card/85 p-1.5 text-muted-foreground shadow-md backdrop-blur-md", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-transparent px-3.5 py-2 text-sm font-semibold text-slate-300 outline-none transition-all duration-150 hover:bg-slate-800/70 hover:text-white focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:font-bold data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_4px_16px_rgba(56,189,248,0.3)]",
        className
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }) {
  return <TabsPrimitive.Content className={cn("mt-2 outline-none focus-visible:ring-2 focus-visible:ring-ring", className)} {...props} />;
}
