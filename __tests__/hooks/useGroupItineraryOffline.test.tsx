/** @jest-environment jsdom */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useGroupItineraryOffline } from "@/hooks/useGroupItineraryOffline";
import { putFullTripItineraryCache, putGroupTripIdMapping } from "@/lib/offline/tripItineraryCache";

const TRIP = "507f1f77bcf86cd799439099";
const GROUP = "group-offline-test";

const tripJson = {
  _id: TRIP,
  groupID: GROUP,
  primaryItinerary: [] as unknown[],
  rainyDayItinerary: [] as unknown[],
  itineraryVersion: 0,
};

function clearIdb() {
  return new Promise<void>((resolve, reject) => {
    const d = indexedDB.deleteDatabase("bb-offline-v1");
    d.onsuccess = () => resolve();
    d.onerror = () => reject(d.error);
  });
}

function setOnline(v: boolean) {
  Object.defineProperty(globalThis.navigator, "onLine", {
    value: v,
    configurable: true,
  });
}

function emitNet(v: "online" | "offline") {
  window.dispatchEvent(new Event(v));
}

function mockListAndTrip(
  body: { groupID: string; tripID: string }[] | "fail",
  tripBody: typeof tripJson | null,
) {
  return jest.fn().mockImplementation((url: string) => {
    const s = String(url);
    if (s.includes("/api/trip") && s.includes(TRIP)) {
      if (!tripBody) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => tripBody,
      });
    }
    if (s.includes("/api/trip") && !s.match(/\/api\/trip\/[a-f0-9]+$/i)) {
      if (body === "fail") {
        return Promise.reject(new Error("network down"));
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => body });
    }
    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  });
}

beforeEach(async () => {
  await clearIdb();
  setOnline(true);
  emitNet("online");
  (global as unknown as { fetch?: unknown }).fetch = undefined;
  jest.restoreAllMocks();
});

describe("useGroupItineraryOffline", () => {
  it("loads_trip_from_network_and_sets_active", async () => {
    (global as unknown as { fetch: typeof fetch }).fetch = mockListAndTrip(
      [{ groupID: GROUP, tripID: TRIP }],
      { ...tripJson, itineraryVersion: 1 },
    );
    const { result } = renderHook(() =>
      useGroupItineraryOffline({ groupId: GROUP, itinerarySectionOpen: true }),
    );
    await waitFor(
      () => {
        expect(result.current.tripActive).toBe(true);
        expect(result.current.groupTripDetail?.itineraryVersion).toBe(1);
        expect(result.current.isShowingCached).toBe(false);
      },
      { timeout: 8000 },
    );
  });

  it("serves_cache_when_map_and_payload_exist_offline", async () => {
    await putFullTripItineraryCache(
      TRIP,
      GROUP,
      tripJson as unknown as Record<string, unknown>,
    );
    (global as unknown as { fetch: typeof fetch }).fetch = mockListAndTrip("fail", null);
    setOnline(false);
    emitNet("offline");
    const { result } = renderHook(() =>
      useGroupItineraryOffline({ groupId: GROUP, itinerarySectionOpen: true }),
    );
    await waitFor(
      () => {
        expect(result.current.tripActive).toBe(true);
        expect(result.current.isOffline).toBe(true);
        expect(result.current.groupTripDetail?._id).toBe(TRIP);
        expect(result.current.isShowingCached).toBe(true);
      },
      { timeout: 8000 },
    );
  });

  it("refetches_higher_version_after_reconnecting", async () => {
    await putGroupTripIdMapping(GROUP, TRIP);
    await putFullTripItineraryCache(
      TRIP,
      GROUP,
      { ...tripJson, itineraryVersion: 1 } as unknown as Record<string, unknown>,
    );
    (global as unknown as { fetch: typeof fetch }).fetch = mockListAndTrip(
      [{ groupID: GROUP, tripID: TRIP }],
      { ...tripJson, itineraryVersion: 1 },
    );
    const { result } = renderHook(() =>
      useGroupItineraryOffline({ groupId: GROUP, itinerarySectionOpen: true }),
    );
    await waitFor(() => {
      expect(result.current.groupTripDetail?.itineraryVersion).toBe(1);
    });
    await act(async () => {
      setOnline(false);
      emitNet("offline");
    });
    await waitFor(() => {
      expect(result.current.isOffline).toBe(true);
    });
    (global as unknown as { fetch: typeof fetch }).fetch = mockListAndTrip(
      [{ groupID: GROUP, tripID: TRIP }],
      { ...tripJson, itineraryVersion: 22 },
    );
    await act(async () => {
      setOnline(true);
      emitNet("online");
    });
    await waitFor(
      () => {
        expect(result.current.isOffline).toBe(false);
        expect(result.current.groupTripDetail?.itineraryVersion).toBe(22);
        expect(result.current.isShowingCached).toBe(false);
      },
      { timeout: 8000 },
    );
  });
});
