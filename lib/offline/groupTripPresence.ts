const PREFIX = "bb:tripPresence:v1:";

function key(groupId: string): string {
  return `${PREFIX}${groupId}`;
}

export function setGroupTripPresence(groupId: string, tripId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      key(groupId),
      JSON.stringify({ tripId, at: Date.now() }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearGroupTripPresence(groupId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(groupId));
  } catch {
    /* ignore */
  }
}

export function getGroupTripPresenceTripId(groupId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(groupId));
    if (!raw) return null;
    const o = JSON.parse(raw) as { tripId?: unknown };
    return typeof o.tripId === "string" ? o.tripId : null;
  } catch {
    return null;
  }
}
