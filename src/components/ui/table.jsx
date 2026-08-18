import React from "react";
import { cn } from "@/lib/utils.js";

export function Table({ className, ...props }) {
  return <table className={cn("w-full caption-bottom text-sm", className)} {...props} />;
}

export function TableHeader({ className, ...props }) {
  return <thead className={cn("[&_tr]:border-b", className)} {...props} />;
}

export function TableBody({ className, ...props }) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableFooter({ className, ...props }) {
  return <tfoot className={cn("border-t bg-muted/50 font-medium", className)} {...props} />;
}

export function TableRow({ className, ...props }) {
  return <tr className={cn("border-b border-border/60 transition-colors hover:bg-primary/[0.04] data-[state=selected]:bg-primary/12", className)} {...props} />;
}

export function TableHead({ className, ...props }) {
  return (
    <th
      className={cn("sticky top-0 z-10 h-11 whitespace-nowrap border-b border-border bg-card/95 px-3 text-left align-middle text-xs font-bold uppercase tracking-wider text-muted-foreground backdrop-blur-md", className)}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }) {
  return <td className={cn("whitespace-nowrap px-3 py-2.5 align-middle text-sm text-foreground/90", className)} {...props} />;
}

export function TableCaption({ className, ...props }) {
  return <caption className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />;
}
