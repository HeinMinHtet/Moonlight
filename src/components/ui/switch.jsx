import React from "react";
import { cn } from "@/lib/utils.js";

export function Switch({
  checked = false,
  onCheckedChange,
  disabled = false,
  id,
  name,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  ...props
}) {
  const handleClick = () => {
    if (disabled) return;
    onCheckedChange?.(!checked);
  };

  const handleKeyDown = (event) => {
    if (disabled) return;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      onCheckedChange?.(!checked);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      id={id}
      name={name}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-input",
        className
      )}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      {...props}
    >
      <span
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}
