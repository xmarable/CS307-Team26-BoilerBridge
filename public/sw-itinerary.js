/* eslint-disable no-undef */
/**
 * BoilerBridge offline shell:
 * - HTML navigations: network-first (redirect: manual), then Cache Storage, then minimal HTML fallback.
 * - Group pages with an explicit Save for Offline (IndexedDB) get broader cache matching on refresh offline.
 * - /_next/static/*: cache-first.
 * - Selected GET APIs: network-first, then cache — not /api/auth/*.
 */

const CACHE_NS = "bb-offline-v3";
const NAV = `${CACHE_NS}-nav`;
const STATIC = `${CACHE_NS}-static`;
const API = `${CACHE_NS}-api`;
const LEGACY_CACHES = ["bb-sw-trip-get-v1"];
const IDB_NAME = "bb-offline-v1";
const IDB_VERSION = 1;

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
      const keys = await caches.keys();
      for (const name of keys) {
        if (name.startsWith("bb-offline-v2")) {
          try {
            await caches.delete(name);
          } catch (_) {}
        }
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
  return false;
}

function shouldPutNavigationInCache(requestUrl, responseUrl, response) {
  if (!response || !response.ok || response.status !== 200 || response.type === "opaqueredirect") {
    return false;
  }
  let reqPath;
  let resPath;
  try {
    reqPath = new URL(requestUrl).pathname;
    resPath = new URL(responseUrl).pathname;
  } catch (_) {
    return false;
  }
  if (reqPath !== resPath) return false;
  if (reqPath === "/signin" || reqPath.startsWith("/signin/")) return false;
  if (reqPath === "/signup" || reqPath.startsWith("/signup/")) return false;
  if (reqPath === "/signout" || reqPath.startsWith("/signout/")) return false;
  if (reqPath === "/dashboard" || reqPath === "/dashboard/") return false;
  if (reqPath.startsWith("/api/auth") || reqPath.startsWith("/api/auth/")) return false;
  return true;
}

function idbOpen() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(IDB_NAME, IDB_VERSION);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => resolve(r.result);
  });
}

function idbGet(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbHasUserSavedItineraryForGroup(groupId) {
  let db;
  try {
    db = await idbOpen();
    const mapRow = await idbGet(db, "groupTripId", groupId);
    const tripId = mapRow && typeof mapRow.tripId === "string" ? mapRow.tripId : null;
    if (!tripId) return false;
    const tripRow = await idbGet(db, "trips", tripId);
    const p = tripRow && tripRow.payload;
    return !!(
      tripRow &&
      tripRow.savedByUser === true &&
      p &&
      Array.isArray(p.primaryItinerary) &&
      Array.isArray(p.rainyDayItinerary)
    );
  } catch (_) {
    return false;
  } finally {
    try {
      if (db) db.close();
    } catch (_) {}
  }
}

async function matchNavCacheForGroup(cache, groupId) {
  const keys = await cache.keys();
  const needle = `/dashboard/groups/${groupId}`;
  for (const req of keys) {
    try {
      const u = new URL(req.url);
      if (u.pathname === needle || u.pathname === `${needle}/`) {
        const hit = await cache.match(req);
        if (hit) return hit;
      }
    } catch (_) {}
  }
  for (const req of keys) {
    if (req.url.includes(needle)) {
      const hit = await cache.match(req);
      if (hit) return hit;
    }
  }
  return null;
}

async function navNetworkFirst(request) {
  const cache = await caches.open(NAV);
  try {
    const res = await fetch(request, { redirect: "manual" });
    if (shouldPutNavigationInCache(request.url, res.url, res)) {
      try {
        await cache.put(request, res.clone());
      } catch (_) {}
    }
    return res;
  } catch {
    const pathname = offlinePathname(request.url);
    const m = /^\/dashboard\/groups\/([^/]+)\/?$/i.exec(pathname);
    let hit = null;
    try {
      hit = await cache.match(request, { ignoreSearch: true });
    } catch (_) {}
    if (!hit) {
      try {
        const noQuery = request.url.split("?")[0];
        hit = await cache.match(noQuery);
      } catch (_) {}
    }
    if (!hit) {
      try {
        hit = await cache.match(request);
      } catch (_) {}
    }
    if (!hit && m) {
      hit = await matchNavCacheForGroup(cache, m[1]);
    }
    if (hit) return hit;
    const hasSaved = m ? await idbHasUserSavedItineraryForGroup(m[1]) : false;
    return offlineDocumentFallback(request.url, hasSaved);
  }
}

function offlinePathname(pageUrl) {
  try {
    return new URL(pageUrl).pathname || "/";
  } catch (_) {
    return "/";
  }
}

function offlineDocumentFallback(pageUrl, hasUserSavedForGroup) {
  const safe = String(pageUrl).replace(/</g, "");
  const pathname = offlinePathname(pageUrl);
  const onDashboardRoot = pathname === "/dashboard" || pathname === "/dashboard/";
  const onGroupPage = /^\/dashboard\/groups\/[^/]+\/?$/i.test(pathname);

  let body =
    "This exact URL has not been stored in this browser yet (or the cache was cleared). Reconnect once, open the page you need, then try offline again.";
  if (onDashboardRoot) {
    body =
      "The dashboard needs a connection the first time it loads in this browser. For an <strong>offline itinerary</strong>: while online, open a <strong>group</strong> → <strong>Itinerary</strong> → <strong>Save for Offline</strong>. After that, that <strong>group</strong> page can open here without internet (not this dashboard list).";
  } else if (onGroupPage && hasUserSavedForGroup) {
    body =
      "Your itinerary is saved on this device, but the cached page shell is missing. With a brief connection, open this group page once (it will reload), then tap <strong>Save for Offline</strong> again to restore offline refresh.";
  } else if (onGroupPage) {
    body =
      "This itinerary is not saved for offline viewing. While online, open this group and choose <strong>Save for Offline</strong> near the timeline section.";
  }

  let extra =
    '<p><a href="/dashboard">Go to Dashboard</a> <span style="opacity:.75">(works when you are online again)</span></p>';
  if (onDashboardRoot) {
    extra =
      '<p style="font-size:.9rem;opacity:.85">When you are back online, open a group you use often first; that is what gets saved for offline viewing.</p>';
  }

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Offline • BoilerBridge</title></head><body style="font-family:system-ui,sans-serif;max-width:36rem;margin:2rem auto;padding:0 1rem;line-height:1.5">
<h1 style="font-size:1.25rem">You’re offline</h1>
<p>${body}</p>
${extra}
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
