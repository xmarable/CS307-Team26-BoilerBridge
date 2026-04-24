"use client";

import { useEffect } from "react";

/**
 * Registers `/sw-itinerary.js` (scope `/`). Navigation cache name matches
 * `OFFLINE_NAV_CACHE_NAME` in `lib/offline/primeOfflineGroupNavigationCache.ts`.
 * Offline refresh is most reliable
 * after `npm run build && npm run start`; `next dev` may invalidate chunk URLs between loads.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw-itinerary.js", {
          scope: "/",
          updateViaCache: "none",
        });
        if (!alive) return;
        void reg;
      } catch {
        // optional (unsupported, user disabled SW, etc.)
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return null;
}
