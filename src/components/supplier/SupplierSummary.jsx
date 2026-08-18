import React from "react";
import { EmptyState } from "../EmptyState.jsx";
import { money } from "../../utils/format.js";
import { Card } from "@/components/ui/card.jsx";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";

export function SupplierSummary({ rows, grandTotal, embedded = false, children }) {
  return (
    <Card asChild><aside className={`summary-panel${embedded ? " rounded-none border-x-0 shadow-none" : ""}`}>
      <div className="section-head">
        <div>
          <h2>Verified unpaid total</h2>
          <p className="panel-note">Only verified unpaid sales records are counted.</p>
        </div>
        <div className="section-actions">
          <strong className="font-mono text-xl font-bold tabular-nums text-emerald-300">{money(grandTotal)}</strong>
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
          <TableRow>
            <TableCell colSpan="3">Verified unpaid total</TableCell>
            <TableCell>{money(grandTotal)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </aside></Card>
  );
}
