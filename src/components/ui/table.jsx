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
  return <tr className={cn("border-b transition-colors hover:bg-muted/45 data-[state=selected]:bg-primary/10", className)} {...props} />;
}

export function TableHead({ className, ...props }) {
  return (
    <th
      className={cn("sticky top-0 z-10 h-11 whitespace-nowrap bg-background/95 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm", className)}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }) {
  return <td className={cn("whitespace-nowrap px-3 py-2 align-middle", className)} {...props} />;
}

export function TableCaption({ className, ...props }) {
  return <caption className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />;
}
