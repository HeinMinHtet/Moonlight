import React from "react";
import { TableDateCell } from "../TableDateCell.jsx";
import { mmk, money } from "../../utils/format.js";
import { Badge } from "@/components/ui/badge.jsx";
import { Card } from "@/components/ui/card.jsx";
import { Banknote, Lock } from "lucide-react";

export function BoosterSettlementsTable({ transactions = [], emptyMessage = "No settlement history found." }) {
  const [page, setPage] = React.useState(1);
  const pageSize = 10;
  
  React.useEffect(() => {
    setPage(1);
  }, [transactions]);
  
  const totalPages = Math.ceil(transactions.length / pageSize) || 1;
  const currentTransactions = transactions.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Card className="overflow-hidden border-border/80 bg-card/90 mt-4">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border/80 bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Booster</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3 text-right">Gold Settled</th>
              <th className="px-4 py-3 text-right">Rate</th>
              <th className="px-4 py-3 text-right">Converted Amount (MMK)</th>
              <th className="px-4 py-3">Note</th>
              <th className="px-4 py-3">Processed By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 font-medium text-xs sm:text-sm">
            {currentTransactions.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-xs text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              currentTransactions.map((tx) => (
                <tr key={tx.id} className="transition-colors hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                    <TableDateCell date={tx.date} createdAt={tx.createdAt} className="items-start" />
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                    {tx.boosterName}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant="success" className="gap-1 text-[11px] font-bold">
                      <Banknote className="size-3" aria-hidden="true" />
                      Paid Balance
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap text-amber-300">
                    {money(tx.goldAmount)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground whitespace-nowrap">
                    {tx.rate} MMK
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap text-sky-400">
                    {mmk(tx.amount)}
                  </td>
                  <td className="px-4 py-3 text-foreground/90 max-w-xs truncate" title={tx.note}>
                    {tx.note}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {tx.createdByName || "Admin"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/80 bg-muted/10 text-xs">
          <span className="text-muted-foreground">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, transactions.length)} of {transactions.length} records
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-7 px-2.5"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <span className="px-2 font-medium">Page {page} of {totalPages}</span>
            <button
              type="button"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-7 px-2.5"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
