import React from "react";
import { Toaster as Sonner } from "sonner";

export function Toaster(props) {
  return (
    <Sonner
      position="bottom-center"
      richColors
      toastOptions={{
        classNames: {
          toast: "border-border bg-background text-white shadow-xl",
          description: "text-secondary-foreground"
        }
      }}
      {...props}
    />
  );
}
