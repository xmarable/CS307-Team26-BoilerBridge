import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import {
  fetchTripItineraryWithCache,
  fetchTripItineraryFromNetwork,
} from "@/lib/offline/fetchTripItineraryWithCache";
import { saveUserOfflineItinerary, getFullTripItineraryCache } from "@/lib/offline/tripItineraryCache";

const TRIP = "507f1f77bcf86cd799439012";
const GROUP = "g2";

const sample = (v: number) => ({
  _id: TRIP,
  groupID: GROUP,
  primaryItinerary: [],
  rainyDayItinerary: [],
  itineraryVersion: v,
});

function setOnline(v: boolean) {
  Object.defineProperty(globalThis.navigator, "onLine", {
    value: v,
    configurable: true,
  });
}

function clearIdb() {
  return new Promise<void>((resolve, reject) => {
    const d = indexedDB.deleteDatabase("bb-offline-v1");
    d.onsuccess = () => resolve();
    d.onerror = () => reject(d.error);
  });
}

beforeEach(async () => {
  await clearIdb();
  setOnline(true);
  (global as unknown as { fetch?: unknown }).fetch = undefined;
  jest.restoreAllMocks();
});

describe("fetchTripItineraryWithCache", () => {
  it("network_fetch_does_not_create_offline_row_without_prior_user_save", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => sample(1),
    });
    (global as unknown as { fetch: typeof fetch }).fetch = mockFetch;
    const out = await fetchTripItineraryWithCache(TRIP, GROUP);
    expect(out.source).toBe("network");
    expect(out.isStale).toBe(false);
    expect((out.data as { itineraryVersion: number })?.itineraryVersion).toBe(1);
    expect(await getFullTripItineraryCache(TRIP)).toBeNull();
  });

  it("network_fetch_updates_existing_user_offline_copy", async () => {
    await saveUserOfflineItinerary(TRIP, GROUP, sample(0) as unknown as Record<string, unknown>);
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => sample(9),
    });
    (global as unknown as { fetch: typeof fetch }).fetch = mockFetch;
    const out = await fetchTripItineraryWithCache(TRIP, GROUP);
    expect(out.source).toBe("network");
    const row = await getFullTripItineraryCache(TRIP);
    expect(row?.savedByUser).toBe(true);
    expect((row?.payload as { itineraryVersion: number }).itineraryVersion).toBe(9);
  });

  it("uses_user_saved_cache_when_offline", async () => {
    await saveUserOfflineItinerary(TRIP, GROUP, sample(5) as unknown as Record<string, unknown>);
    setOnline(false);
    (global as unknown as { fetch: typeof fetch }).fetch = jest
      .fn()
      .mockRejectedValue(new Error("no network"));
    const out = await fetchTripItineraryWithCache(TRIP, GROUP);
    expect(out.source).toBe("cache");
    expect((out.data as { itineraryVersion: number })?.itineraryVersion).toBe(5);
  });

  it("ignores_non_user_cache_when_offline", async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open("bb-offline-v1", 1);
      r.onerror = () => rej(r.error);
      r.onsuccess = () => res(r.result);
      r.onupgradeneeded = (ev) => {
        const d = (ev.target as IDBOpenDBRequest).result;
        if (!d.objectStoreNames.contains("trips")) {
          d.createObjectStore("trips", { keyPath: "tripId" });
        }
        if (!d.objectStoreNames.contains("groupTripId")) {
          d.createObjectStore("groupTripId", { keyPath: "groupId" });
        }
      };
    });
    await new Promise<void>((res, rej) => {
      const tx = db.transaction("trips", "readwrite");
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
      tx.objectStore("trips").put({
        tripId: TRIP,
        groupId: GROUP,
        payload: sample(1),
        itineraryVersion: 1,
        cacheRecordVersion: 1,
        updatedAt: Date.now(),
        savedByUser: false,
        savedAt: null,
        lastSyncedAt: null,
      });
    });
    db.close();
    setOnline(false);
    const out = await fetchTripItineraryWithCache(TRIP, GROUP);
    expect(out.error).toBe("offline_unavailable");
  });

  it("falls_back_to_user_saved_cache_on_network_error_when_online", async () => {
    await saveUserOfflineItinerary(TRIP, GROUP, sample(2) as unknown as Record<string, unknown>);
    setOnline(true);
    (global as unknown as { fetch: typeof fetch }).fetch = jest
      .fn()
      .mockRejectedValue(new Error("econnrefused"));
    const out = await fetchTripItineraryWithCache(TRIP, GROUP);
    expect(out.source).toBe("cache");
    expect(out.isStale).toBe(true);
  });

  it("returns_offline_unavailable_without_user_saved_cache", async () => {
    setOnline(false);
    (global as unknown as { fetch: typeof fetch }).fetch = jest
      .fn()
      .mockRejectedValue(new Error("no network"));
    const out = await fetchTripItineraryWithCache(TRIP, "gx");
    expect(out.source).toBe("none");
    expect(out.error).toBe("offline_unavailable");
  });

  it("does_not_use_cache_for_401", async () => {
    await saveUserOfflineItinerary(TRIP, GROUP, sample(0) as unknown as Record<string, unknown>);
    (global as unknown as { fetch: typeof fetch }).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });
    const out = await fetchTripItineraryWithCache(TRIP, GROUP);
    expect(out.error).toBe("unauthorized");
  });
});

describe("fetchTripItineraryFromNetwork", () => {
  it("returns_network_payload_without_touching_idb", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => sample(3),
    });
    (global as unknown as { fetch: typeof fetch }).fetch = mockFetch;
    const out = await fetchTripItineraryFromNetwork(TRIP);
    expect(out.source).toBe("network");
    expect(await getFullTripItineraryCache(TRIP)).toBeNull();
  });
});
