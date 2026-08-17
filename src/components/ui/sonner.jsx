import React from "react";
import { Toaster as Sonner } from "sonner";

export function Toaster(props) {
  return (
    <Sonner
      position="bottom-center"
      richColors
      toastOptions={{
        classNames: {
          toast: "border-border bg-slate-950 text-white shadow-xl",
          description: "text-slate-300"
        }
      }}
      {...props}
    />
  );
}
