import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { fetchTripItineraryWithCache } from "@/lib/offline/fetchTripItineraryWithCache";
import { putFullTripItineraryCache } from "@/lib/offline/tripItineraryCache";

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
  it("serves_network_and_persists_to_cache", async () => {
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
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(`/api/trip/${TRIP}`),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("uses_cache_when_offline", async () => {
    await putFullTripItineraryCache(TRIP, GROUP, sample(5) as unknown as Record<string, unknown>);
    setOnline(false);
    (global as unknown as { fetch: typeof fetch }).fetch = jest
      .fn()
      .mockRejectedValue(new Error("no network"));
    const out = await fetchTripItineraryWithCache(TRIP, GROUP);
    expect(out.source).toBe("cache");
    expect((out.data as { itineraryVersion: number })?.itineraryVersion).toBe(5);
  });

  it("falls_back_to_cache_on_network_error_when_online", async () => {
    await putFullTripItineraryCache(TRIP, GROUP, sample(2) as unknown as Record<string, unknown>);
    setOnline(true);
    (global as unknown as { fetch: typeof fetch }).fetch = jest
      .fn()
      .mockRejectedValue(new Error("econnrefused"));
    const out = await fetchTripItineraryWithCache(TRIP, GROUP);
    expect(out.source).toBe("cache");
    expect(out.isStale).toBe(true);
  });

  it("returns_offline_unavailable_without_cache", async () => {
    setOnline(false);
    (global as unknown as { fetch: typeof fetch }).fetch = jest
      .fn()
      .mockRejectedValue(new Error("no network"));
    const out = await fetchTripItineraryWithCache(TRIP, "gx");
    expect(out.source).toBe("none");
    expect(out.error).toBe("offline_unavailable");
  });

  it("does_not_use_cache_for_401", async () => {
    await putFullTripItineraryCache(TRIP, GROUP, sample(0) as unknown as Record<string, unknown>);
    (global as unknown as { fetch: typeof fetch }).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });
    const out = await fetchTripItineraryWithCache(TRIP, GROUP);
    expect(out.error).toBe("unauthorized");
  });
});
