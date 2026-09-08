import { money } from "../utils/format.js";

export function useExpenseAndNoteActions({
  request,
  runAction,
  setData,
  setEditing,
  setExpenseFormKey,
  loadExpenses,
  showToast,
  askConfirm,
  raidNotes
}) {
  const submitExternalExpense = (event) => runAction(async () => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    body.amount = Number(body.amount);
    await request("/api/external-expenses", {
      method: "POST",
      body: JSON.stringify(body)
    });
    setExpenseFormKey((key) => key + 1);
    await loadExpenses();
    showToast("External expense recorded.");
  });

  const patchExternalExpense = (id, body, message = "External expense updated.") => runAction(async () => {
    const payload = await request(`/api/external-expenses/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    setEditing(null);
    setData((current) => ({
      ...current,
      externalExpenses: payload.expenses || current.externalExpenses.map((e) => (e.id === id ? payload.expense : e))
    }));
    showToast(message);
  });

  const deleteExternalExpense = (expense) => runAction(async () => {
    const confirmed = await askConfirm({
      title: "Delete external expense?",
      body: `This removes the ${money(expense.amount)} ${expense.category} (${expense.title || "expense"}). This action cannot be undone.`,
      confirmLabel: "Delete expense",
      dangerous: true
    });
    if (!confirmed) return;
    const payload = await request(`/api/external-expenses/${expense.id}`, { method: "DELETE" });
    setData((current) => ({
      ...current,
      externalExpenses: payload.expenses || current.externalExpenses.filter((e) => e.id !== expense.id)
    }));
    showToast("External expense deleted.");
  });

  const createRaidNote = (noteData) => runAction(async () => {
    const payload = await request("/api/raid-notes", {
      method: "POST",
      body: JSON.stringify(noteData)
    });
    setData((current) => ({
      ...current,
      raidNotes: payload.notes || [payload.note, ...current.raidNotes]
    }));
    showToast("Raid note created.");
  });

  const patchRaidNote = (id, updates) => runAction(async () => {
    const payload = await request(`/api/raid-notes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates)
    });
    setData((current) => ({
      ...current,
      raidNotes: payload.notes || current.raidNotes.map((n) => (n.id === id ? payload.note : n))
    }));
  });

  const deleteRaidNote = (id) => runAction(async () => {
    const note = (raidNotes || []).find((n) => n.id === id);
    const confirmed = await askConfirm({
      title: "Delete raid note?",
      body: `This removes "${note?.title || "this raid note"}" and all of its buyer checklist items. This action cannot be undone.`,
      confirmLabel: "Delete raid note",
      dangerous: true
    });
    if (!confirmed) return;
    const payload = await request(`/api/raid-notes/${id}`, { method: "DELETE" });
    setData((current) => ({
      ...current,
      raidNotes: payload.notes || current.raidNotes.filter((n) => n.id !== id)
    }));
    showToast("Raid note deleted.");
  });

  return {
    submitExternalExpense,
    patchExternalExpense,
    deleteExternalExpense,
    createRaidNote,
    patchRaidNote,
    deleteRaidNote
  };
}
