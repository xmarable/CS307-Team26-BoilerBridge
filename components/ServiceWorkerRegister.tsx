"use client";

import { useEffect } from "react";

/**
 * Registers `/sw-itinerary.js` in production only. `next dev` changes chunk URLs
 * often; an active SW then serves stale/missing `/_next/static` assets → unstyled
 * pages and broken hydration. Test offline with `npm run build && npm run start`.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV === "development") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
      if ("caches" in window) {
        void caches.keys().then((names) =>
          Promise.all(
            names
              .filter((n) => n.startsWith("bb-offline"))
              .map((n) => caches.delete(n)),
          ),
        );
      }
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
