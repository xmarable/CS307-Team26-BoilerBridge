"use client";

import { useEffect } from "react";

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
        });
        if (!alive) return;
        void reg;
      } catch {
        // registration optional (localhost http, user disabled SW, etc.)
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return null;
}
