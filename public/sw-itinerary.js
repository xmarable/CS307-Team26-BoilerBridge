/* eslint-disable no-undef */
/**
 * BoilerBridge offline shell:
 * - HTML navigations: network-first, then Cache Storage (so refresh works offline).
 * - /_next/static/*: cache-first (hashed assets safe to keep).
 * - Selected GET APIs: network-first, then cache (trip, groups, friends, auth, share).
 *
 * Prefer verifying with: npm run build && npm run start
 * (next dev can change chunk URLs between loads, which weakens offline refresh.)
 */

const CACHE_NS = "bb-offline-v2";
const NAV = `${CACHE_NS}-nav`;
const STATIC = `${CACHE_NS}-static`;
const API = `${CACHE_NS}-api`;
const LEGACY_CACHES = ["bb-sw-trip-get-v1"];

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of LEGACY_CACHES) {
        try {
          await caches.delete(name);
        } catch (_) {}
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate" || req.destination === "document") {
    event.respondWith(navNetworkFirst(req));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staticCacheFirst(req));
    return;
  }

  if (shouldInterceptApi(url)) {
    event.respondWith(apiNetworkFirst(req));
  }
});

function shouldInterceptApi(url) {
  const p = url.pathname;
  if (/^\/api\/trip\/[a-f0-9]{24}\/?$/i.test(p)) return true;
  if (p === "/api/trip" || p === "/api/trip/") return true;
  if (/^\/api\/groups\/[0-9a-f-]+/i.test(p)) return true;
  if (p.startsWith("/api/friends")) return true;
  if (p.startsWith("/api/itineraries/share")) return true;
  if (p.startsWith("/api/auth/")) return true;
  return false;
}

async function navNetworkFirst(request) {
  const cache = await caches.open(NAV);
  try {
    const res = await fetch(request);
    if (res.ok) {
      try {
        await cache.put(request, res.clone());
      } catch (_) {}
    }
    return res;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    return offlineDocumentFallback(request.url);
  }
}

function offlineDocumentFallback(pageUrl) {
  const safe = String(pageUrl).replace(/</g, "");
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Offline • BoilerBridge</title></head><body style="font-family:system-ui,sans-serif;max-width:36rem;margin:2rem auto;padding:0 1rem;line-height:1.5">
<h1 style="font-size:1.25rem">You’re offline</h1>
<p>This page hasn’t been saved in your browser yet. While you have Wi‑Fi or data, open the itinerary (or dashboard) once so BoilerBridge can keep a copy for travel.</p>
<p><a href="/dashboard">Go to Dashboard</a></p>
<p style="font-size:.8rem;opacity:.65">Requested: ${safe}</p>
</body></html>`;
  return new Response(html, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function staticCacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (res.ok) {
      try {
        await cache.put(request, res.clone());
      } catch (_) {}
    }
    return res;
  } catch {
    return Response.error();
  }
}

async function apiNetworkFirst(request) {
  const cache = await caches.open(API);
  try {
    const res = await fetch(request);
    if (res.ok) {
      try {
        await cache.put(request, res.clone());
      } catch (_) {}
    }
    return res;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    return new Response(
      JSON.stringify({
        error: "Network unavailable",
        offline: true,
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
