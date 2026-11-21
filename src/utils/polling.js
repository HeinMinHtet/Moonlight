// Decides whether a background poll can skip the full data reload.
// Skips only when the server reported a version, it matches what this client last
// loaded, and the periodic full refresh is not yet due.
export function canSkipPoll({ serverVersion, seenVersion, lastFullPollAt, now = Date.now(), fullRefreshMs }) {
  if (!serverVersion || !seenVersion) return false;
  if (serverVersion !== seenVersion) return false;
  return now - Number(lastFullPollAt || 0) < fullRefreshMs;
}
