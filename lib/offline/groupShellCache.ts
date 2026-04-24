const PREFIX = "bb:groupShell:v1:";

function key(groupId: string): string {
  return `${PREFIX}${groupId}`;
}

export function cacheGroupShell(groupId: string, group: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(groupId), JSON.stringify(group));
  } catch {
    /* quota / private mode */
  }
}

export function readGroupShell<T = unknown>(groupId: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(groupId));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearGroupShell(groupId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(groupId));
  } catch {
    /* ignore */
  }
}
