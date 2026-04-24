/** Must match `NAV` cache name in `public/sw-itinerary.js`. */
export const OFFLINE_NAV_CACHE_NAME = "bb-offline-v3-nav";

export function offlineGroupPageUrl(origin: string, groupId: string): string {
  const o = origin.replace(/\/$/, "");
  return `${o}/dashboard/groups/${encodeURIComponent(groupId)}`;
}

/**
 * Stores the current group document HTML in Cache Storage so an offline full refresh
 * can boot the Next.js app shell while itinerary/group data hydrates from IndexedDB/localStorage.
 */
export async function primeOfflineGroupNavigationCache(groupId: string): Promise<boolean> {
  if (typeof window === "undefined" || !groupId) {
    return false;
  }
  const cachesApi = globalThis.caches;
  if (!cachesApi || typeof cachesApi.open !== "function") {
    return false;
  }
  const origin = window.location.origin;
  const url = offlineGroupPageUrl(origin, groupId);
  try {
    const cache = await cachesApi.open(OFFLINE_NAV_CACHE_NAME);
    const res = await fetch(url, {
      credentials: "include",
      redirect: "manual",
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
    });
    if (res.status === 200 && res.type !== "opaqueredirect") {
      await cache.put(new Request(url, { credentials: "include" }), res.clone());
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export async function clearOfflineGroupNavigationCache(groupId: string): Promise<void> {
  if (typeof window === "undefined" || !groupId) return;
  const cachesApi = globalThis.caches;
  if (!cachesApi || typeof cachesApi.open !== "function") return;
  try {
    const cache = await cachesApi.open(OFFLINE_NAV_CACHE_NAME);
    const keys = await cache.keys();
    const needle = `/dashboard/groups/${encodeURIComponent(groupId)}`;
    for (const req of keys) {
      if (req.url.includes(needle)) {
        await cache.delete(req);
      }
    }
  } catch {
    /* ignore */
  }
}
