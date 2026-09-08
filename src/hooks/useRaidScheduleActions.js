export function useRaidScheduleActions({
  request,
  runAction,
  setData,
  loadSchedules,
  showToast,
  askConfirm,
  raidSchedules
}) {
  const submitRaidSchedule = (scheduleData) => runAction(async () => {
    const payload = await request("/api/raid-schedules", {
      method: "POST",
      body: JSON.stringify(scheduleData)
    });
    setData((current) => ({
      ...current,
      raidSchedules: payload.schedules || [payload.schedule, ...(current.raidSchedules || [])]
    }));
    showToast(`Scheduled ${scheduleData.difficulty || "Heroic"} ${scheduleData.raid} at ${scheduleData.timeEst || ""} EST.`);
  });

  const patchRaidSchedule = (id, updates, message = "Raid schedule updated.") => runAction(async () => {
    const payload = await request(`/api/raid-schedules/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates)
    });
    setData((current) => ({
      ...current,
      raidSchedules: payload.schedules || (current.raidSchedules || []).map((s) => (s.id === id ? payload.schedule : s))
    }));
    showToast(message);
  });

  const deleteRaidSchedule = (schedule) => runAction(async () => {
    const confirmed = await askConfirm({
      title: "Delete raid schedule?",
      body: `Remove ${schedule.difficulty} ${schedule.raid} on ${schedule.date} at ${schedule.timeEst} EST? This action cannot be undone.`,
      confirmLabel: "Delete raid",
      dangerous: true
    });
    if (!confirmed) return;

    const payload = await request(`/api/raid-schedules/${schedule.id}`, { method: "DELETE" });
    setData((current) => ({
      ...current,
      raidSchedules: payload.schedules || (current.raidSchedules || []).filter((s) => s.id !== schedule.id)
    }));
    showToast("Raid run deleted from schedule.");
  });

  const addBuyerToSchedule = (scheduleId, buyerName) => runAction(async () => {
    const cleanName = String(buyerName || "").trim();
    if (!cleanName) return;

    const schedule = (raidSchedules || []).find((s) => s.id === scheduleId);
    if (!schedule) return;

    if ((schedule.buyers || []).length >= schedule.maxBuyers) {
      showToast(`Raid is already at its maximum capacity of ${schedule.maxBuyers} 8/8 buyers.`);
      return;
    }

    const updatedBuyers = [...(schedule.buyers || []), cleanName];
    const payload = await request(`/api/raid-schedules/${scheduleId}`, {
      method: "PATCH",
      body: JSON.stringify({ buyers: updatedBuyers })
    });

    setData((current) => ({
      ...current,
      raidSchedules: payload.schedules || (current.raidSchedules || []).map((s) => (s.id === scheduleId ? payload.schedule : s))
    }));
    showToast(`Added buyer ${cleanName} to 8/8 roster.`);
  });

  const removeBuyerFromSchedule = (scheduleId, buyerIndex) => runAction(async () => {
    const schedule = (raidSchedules || []).find((s) => s.id === scheduleId);
    if (!schedule) return;

    const currentBuyers = [...(schedule.buyers || [])];
    const [removed] = currentBuyers.splice(buyerIndex, 1);

    const payload = await request(`/api/raid-schedules/${scheduleId}`, {
      method: "PATCH",
      body: JSON.stringify({ buyers: currentBuyers })
    });

    setData((current) => ({
      ...current,
      raidSchedules: payload.schedules || (current.raidSchedules || []).map((s) => (s.id === scheduleId ? payload.schedule : s))
    }));
    showToast(`Removed buyer ${removed || ""}.`);
  });

  return {
    submitRaidSchedule,
    patchRaidSchedule,
    deleteRaidSchedule,
    addBuyerToSchedule,
    removeBuyerFromSchedule
  };
}
