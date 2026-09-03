import React, { useMemo, useState } from "react";
import { AccessDenied } from "../AccessDenied.jsx";
import { ExpenseRecordForm } from "./ExpenseRecordForm.jsx";
import { ExpenseRecordsTable } from "./ExpenseRecordsTable.jsx";
import { money } from "../../utils/format.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card } from "@/components/ui/card.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { NativeSelect } from "@/components/ui/native-select.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";

const filterDefaults = {
  category: "all",
  search: "",
  dateFrom: "",
  dateTo: ""
};

export function ExpensesPage({
  isAdmin,
  loading,
  loadError,
  expenses = [],
  editing,
  formKey,
  onSubmitExpense,
  onPatchExpense,
  onDeleteExpense,
  onSetEditing
}) {
  const [filters, setFilters] = useState(filterDefaults);

  const resetFilters = () => setFilters(filterDefaults);
  const isFiltered = filters.category !== "all" || filters.search || filters.dateFrom || filters.dateTo;

  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      if (filters.category !== "all") {
        const cat = String(item.category || "").toLowerCase();
        if (filters.category === "raid" && !cat.includes("raid")) return false;
        if (filters.category === "outsource" && !cat.includes("outsource") && !cat.includes("m+")) return false;
        if (filters.category === "other" && (cat.includes("raid") || cat.includes("outsource") || cat.includes("m+"))) return false;
      }
      if (filters.dateFrom && item.date < filters.dateFrom) return false;
      if (filters.dateTo && item.date > filters.dateTo) return false;
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const titleMatch = String(item.title || "").toLowerCase().includes(query);
        const recipientMatch = String(item.recipient || "").toLowerCase().includes(query);
        const noteMatch = String(item.note || "").toLowerCase().includes(query);
        const catMatch = String(item.category || "").toLowerCase().includes(query);
        if (!titleMatch && !recipientMatch && !noteMatch && !catMatch) return false;
      }
      return true;
    });
  }, [expenses, filters]);

  const summary = useMemo(() => {
    let total = 0;
    let raidTotal = 0;
    let raidCount = 0;
    let outsourceTotal = 0;
    let outsourceCount = 0;
    let otherTotal = 0;
    let otherCount = 0;

    for (const exp of filteredExpenses) {
      const amt = Number(exp.amount || 0);
      total += amt;
      const cat = String(exp.category || "").toLowerCase();
      if (cat.includes("raid")) {
        raidTotal += amt;
        raidCount += 1;
      } else if (cat.includes("outsource") || cat.includes("m+")) {
        outsourceTotal += amt;
        outsourceCount += 1;
      } else {
        otherTotal += amt;
        otherCount += 1;
      }
    }

    return {
      total,
      count: filteredExpenses.length,
      raidTotal,
      raidCount,
      outsourceTotal,
      outsourceCount,
      otherTotal,
      otherCount
    };
  }, [filteredExpenses]);

  if (!isAdmin) return <AccessDenied />;

  return (
    <section className="tab-panel active">
      <section className="sheet-layout grid-cols-1">
        <Card asChild><article className="sheet-main">
          <div className="section-head">
            <div>
              <h2>External Expenses</h2>
              <p className="panel-note">Record and manage external payments including raid payments and M+ outsource booster payments.</p>
            </div>
            <span>{expenses.length} expense record{expenses.length === 1 ? "" : "s"}</span>
          </div>

          <section className="batch-bar" aria-label="Expenses summary">
            <div className="border-t-2 border-t-rose-500/80">
              <span className="batch-label">Total Expenses</span>
              <strong className="text-rose-300">{money(summary.total)}</strong>
              <small>{summary.count} recorded row{summary.count === 1 ? "" : "s"}</small>
            </div>
            <div className="border-t-2 border-t-purple-500/80">
              <span className="batch-label">Raid Payments</span>
              <strong className="text-purple-300">{money(summary.raidTotal)}</strong>
              <small>{summary.raidCount || 0} raid pot{summary.raidCount === 1 ? "" : "s"}</small>
            </div>
            <div className="border-t-2 border-t-sky-400/80">
              <span className="batch-label">M+ Outsource Payments</span>
              <strong className="text-sky-300">{money(summary.outsourceTotal)}</strong>
              <small>{summary.outsourceCount || 0} outsource key{summary.outsourceCount === 1 ? "" : "s"}</small>
            </div>
            {summary.otherTotal > 0 && (
              <div className="border-t-2 border-t-slate-500/80">
                <span className="batch-label">Other Expenses</span>
                <strong className="text-slate-300">{money(summary.otherTotal)}</strong>
                <small>{summary.otherCount || 0} row{summary.otherCount === 1 ? "" : "s"}</small>
              </div>
            )}
          </section>

          <ExpenseRecordForm key={formKey} disabled={loading} onSubmit={onSubmitExpense} />

          <section className="filter-bar expense-filter-bar" aria-label="External expense filters">
            <Label className="filter-search">
              Search
              <Input
                type="search"
                placeholder="Description, recipient, or note..."
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              />
            </Label>
            <Label className="filter-select">
              Category
              <NativeSelect
                value={filters.category}
                onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
              >
                <option value="all">All categories</option>
                <option value="raid">Raid payment</option>
                <option value="outsource">M+ outsource payment</option>
                <option value="other">Other</option>
              </NativeSelect>
            </Label>
            <Label className="filter-date">
              From
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
              />
            </Label>
            <Label className="filter-date">
              To
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
              />
            </Label>
            <Button
              className="filter-action"
              variant="outline"
              type="button"
              onClick={resetFilters}
              disabled={!isFiltered}
            >
              Clear filters
            </Button>
          </section>

          {loading && !expenses.length && (
            <div className="space-y-2 p-4" aria-label="Loading external expenses">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          )}

          {!loading && loadError && (
            <Alert variant="destructive" className="m-4">
              <AlertTitle>Could not load expenses</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}

          <ExpenseRecordsTable
            expenses={filteredExpenses}
            editing={editing}
            onSetEditing={onSetEditing}
            onPatchExpense={onPatchExpense}
            onDeleteExpense={onDeleteExpense}
            emptyMessage={isFiltered ? "No expenses match the selected filters." : "No external expenses recorded yet."}
          />
        </article></Card>
      </section>
    </section>
  );
}
