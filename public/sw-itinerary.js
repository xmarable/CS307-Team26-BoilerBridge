/* eslint-disable no-undef */
const TRIP_GET_CACHE = "bb-sw-trip-get-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Caches only successful GET /api/trip/<24-hex> responses. Network-first; offline uses cache.
 */
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!/^\/api\/trip\/[a-f0-9]{24}\/?$/i.test(url.pathname)) return;

  event.respondWith(networkFirstWithOptionalCache(event.request));
});

async function networkFirstWithOptionalCache(request) {
  const cache = await caches.open(TRIP_GET_CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) {
      await cache.put(request, res.clone());
    }
    return res;
  } catch (err) {
    const hit = await cache.match(request, { ignoreSearch: false });
    if (hit) return hit;
    throw err;
  }
}
