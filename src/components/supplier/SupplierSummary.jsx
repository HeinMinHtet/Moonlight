import React from "react";
import { EmptyState } from "../EmptyState.jsx";
import { money } from "../../utils/format.js";
import { Card } from "@/components/ui/card.jsx";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";

export function SupplierSummary({
  rows,
  grandTotal,
  activeWithdrawalsTotal = 0,
  netBalance,
  embedded = false,
  children
}) {
  const calculatedNet = netBalance !== undefined ? netBalance : (grandTotal - activeWithdrawalsTotal);
  const isDeficit = calculatedNet < 0;

  return (
    <Card asChild><aside className={`summary-panel${embedded ? " rounded-none border-x-0 shadow-none" : ""}`}>
      <div className="section-head">
        <div>
          <h2>Verified unpaid summary</h2>
          <p className="panel-note">
            {activeWithdrawalsTotal > 0
              ? "Verified sales offset by active pre-withdrawals."
              : "Only verified unpaid sales records are counted."}
          </p>
        </div>
        <div className="section-actions">
          <div className="flex flex-col items-end gap-0.5">
            <strong className={`font-mono text-xl font-bold tabular-nums ${isDeficit ? "text-rose-400" : "text-emerald-300"}`}>
              {money(calculatedNet)}
            </strong>
            {activeWithdrawalsTotal > 0 && (
              <span className="text-[11px] text-muted-foreground font-mono">
                Sales: {money(grandTotal)} | Withdrawals: -{money(activeWithdrawalsTotal)}
              </span>
            )}
          </div>
          {children}
        </div>
      </div>
      <Table className="summary-table">
        <TableHeader>
          <TableRow>
            <TableHead>Service</TableHead>
            <TableHead>Total qty</TableHead>
            <TableHead>Rate</TableHead>
            <TableHead>Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!rows.length && <EmptyState colSpan="4">No verified unpaid sales totals yet.</EmptyState>}
          {rows.map((row) => (
            <TableRow key={`${row.type}-${row.price}`}>
              <TableCell>{row.type}</TableCell>
              <TableCell>{money(row.totalQty)}</TableCell>
              <TableCell>{money(row.price)}</TableCell>
              <TableCell>{money(row.totalCost)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          {activeWithdrawalsTotal > 0 ? (
            <>
              <TableRow>
                <TableCell colSpan="3">Verified sales total</TableCell>
                <TableCell>{money(grandTotal)}</TableCell>
              </TableRow>
              <TableRow className="text-amber-300">
                <TableCell colSpan="3">Active pre-withdrawals offset</TableCell>
                <TableCell>-{money(activeWithdrawalsTotal)}</TableCell>
              </TableRow>
              <TableRow className="font-bold">
                <TableCell colSpan="3">Net payable balance</TableCell>
                <TableCell className={isDeficit ? "text-rose-400" : "text-emerald-300"}>
                  {money(calculatedNet)}
                </TableCell>
              </TableRow>
            </>
          ) : (
            <TableRow>
              <TableCell colSpan="3">Verified unpaid total</TableCell>
              <TableCell>{money(grandTotal)}</TableCell>
            </TableRow>
          )}
        </TableFooter>
      </Table>
    </aside></Card>
  );
}
