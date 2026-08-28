import React from "react";
import { dateOnly, formatThailandTime, formatThailandDateTime } from "../utils/format.js";

export function TableDateCell({ date, createdAt, className = "" }) {
  const displayDate = dateOnly(date || createdAt);
  const insertedTime = createdAt ? formatThailandTime(createdAt) : "";
  const fullDateTime = createdAt ? formatThailandDateTime(createdAt, { includeSeconds: true }) : displayDate;

  return (
    <div
      className={`flex flex-col items-center justify-center leading-tight ${className}`.trim()}
      title={createdAt ? `Inserted: ${fullDateTime} (ICT / Thailand Time)` : displayDate}
    >
      <span className="font-mono tabular-nums">{displayDate}</span>
      {insertedTime ? (
        <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
          {insertedTime}
        </span>
      ) : null}
    </div>
  );
}
