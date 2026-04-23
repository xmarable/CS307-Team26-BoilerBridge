/** @jest-environment jsdom */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useGroupItineraryOffline } from "@/hooks/useGroupItineraryOffline";
import {
  saveUserOfflineItinerary,
  putGroupTripIdMapping,
} from "@/lib/offline/tripItineraryCache";
import { setGroupTripPresence } from "@/lib/offline/groupTripPresence";

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
        expect(result.current.userHasOfflineSave).toBe(false);
      },
      { timeout: 8000 },
    );
  });

  it("save_for_offline_persists_and_sets_flags", async () => {
    (global as unknown as { fetch: typeof fetch }).fetch = mockListAndTrip(
      [{ groupID: GROUP, tripID: TRIP }],
      { ...tripJson, itineraryVersion: 1 },
    );
    const { result } = renderHook(() =>
      useGroupItineraryOffline({ groupId: GROUP, itinerarySectionOpen: true }),
    );
    await waitFor(() => {
      expect(result.current.groupTripDetail?._id).toBe(TRIP);
    });
    await act(async () => {
      await result.current.saveForOffline();
    });
    await waitFor(() => {
      expect(result.current.userHasOfflineSave).toBe(true);
      expect(result.current.savedAt).not.toBeNull();
      expect(result.current.lastSyncedAt).not.toBeNull();
    });
  });

  it("serves_user_saved_cache_when_offline_without_spinner_stuck", async () => {
    await saveUserOfflineItinerary(
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
        expect(result.current.tripPlanLoading).toBe(false);
      },
      { timeout: 8000 },
    );
  });

  it("refetches_higher_version_after_reconnecting_and_updates_user_copy", async () => {
    await putGroupTripIdMapping(GROUP, TRIP);
    await saveUserOfflineItinerary(
      TRIP,
      GROUP,
      { ...tripJson, itineraryVersion: 1 } as unknown as Record<string, unknown>,
    );
    setGroupTripPresence(GROUP, TRIP);
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

  it("unmount_ignores_deferred_trip_list_fetch", async () => {
    let resList1!: (v: { ok: boolean; status: number; json: () => Promise<unknown> }) => void;
    const pList1 = new Promise<{
      ok: boolean;
      status: number;
      json: () => Promise<unknown>;
    }>((r) => {
      resList1 = r;
    });
    (global as unknown as { fetch: typeof fetch }).fetch = jest.fn(
      (url: string) => {
        const s = String(url);
        if (s.includes("/api/trip") && !s.match(/\/api\/trip\/[a-f0-9]+$/i)) {
          return pList1 as unknown as ReturnType<typeof fetch>;
        }
        if (s.includes("/api/trip/") && s.includes(TRIP)) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ ...tripJson, itineraryVersion: 1 }),
          } as { ok: boolean; status: number; json: () => Promise<typeof tripJson> });
        }
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
      },
    );
    const { unmount } = renderHook(() =>
      useGroupItineraryOffline({ groupId: GROUP, itinerarySectionOpen: true }),
    );
    unmount();
    await act(async () => {
      resList1!({
        ok: true,
        status: 200,
        json: async () => [{ groupID: GROUP, tripID: TRIP }],
      });
    });
  });

  it("closing_itinerary_section_drops_in_flight_trip_list_fetch", async () => {
    let resList2!: (v: { ok: boolean; status: number; json: () => Promise<unknown> }) => void;
    const pList2 = new Promise<{
      ok: boolean;
      status: number;
      json: () => Promise<unknown>;
    }>((r) => {
      resList2 = r;
    });
    let listCount = 0;
    (global as unknown as { fetch: typeof fetch }).fetch = jest.fn(
      (url: string) => {
        const s = String(url);
        if (s.includes("/api/trip/") && s.includes(TRIP)) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ ...tripJson, itineraryVersion: 1 }),
          } as { ok: boolean; status: number; json: () => Promise<typeof tripJson> });
        }
        if (s.includes("/api/trip") && !s.match(/\/api\/trip\/[a-f0-9]+$/i)) {
          listCount += 1;
          if (listCount === 1) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => [{ groupID: GROUP, tripID: TRIP }],
            } as { ok: boolean; status: number; json: () => Promise<unknown> });
          }
          return pList2 as unknown as ReturnType<typeof fetch>;
        }
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
      },
    );
    const { result, rerender } = renderHook(
      (open: boolean) =>
        useGroupItineraryOffline({ groupId: GROUP, itinerarySectionOpen: open }),
      { initialProps: true },
    );
    await waitFor(
      () => {
        expect(result.current.tripActive).toBe(true);
        expect(listCount).toBeGreaterThanOrEqual(1);
      },
      { timeout: 8000 },
    );
    await act(async () => {
      rerender(false);
    });
    expect(result.current.tripPlanLoading).toBe(false);
    expect(result.current.groupTripDetail).toBeNull();
    await act(async () => {
      resList2!({
        ok: true,
        status: 200,
        json: async () => [{ groupID: GROUP, tripID: TRIP }],
      });
    });
    expect(result.current.groupTripDetail).toBeNull();
  });

  it("offline_with_no_user_save_shows_empty_trip_state", async () => {
    setGroupTripPresence(GROUP, TRIP);
    setOnline(false);
    emitNet("offline");
    (global as unknown as { fetch: typeof fetch }).fetch = mockListAndTrip("fail", null);
    const { result } = renderHook(() =>
      useGroupItineraryOffline({ groupId: GROUP, itinerarySectionOpen: true }),
    );
    await waitFor(
      () => {
        expect(result.current.tripActive).toBe(true);
        expect(result.current.groupTripDetail).toBeNull();
        expect(result.current.tripPlanError).toBe("offline_unavailable");
        expect(result.current.tripPlanLoading).toBe(false);
      },
      { timeout: 8000 },
    );
  });

  it("offline_with_idb_trip_mapping_only_sets_active_and_offline_unavailable", async () => {
    await putGroupTripIdMapping(GROUP, TRIP);
    setOnline(false);
    emitNet("offline");
    (global as unknown as { fetch: typeof fetch }).fetch = mockListAndTrip("fail", null);
    const { result } = renderHook(() =>
      useGroupItineraryOffline({ groupId: GROUP, itinerarySectionOpen: true }),
    );
    await waitFor(
      () => {
        expect(result.current.tripActive).toBe(true);
        expect(result.current.groupTripDetail).toBeNull();
        expect(result.current.tripPlanError).toBe("offline_unavailable");
        expect(result.current.tripPlanLoading).toBe(false);
      },
      { timeout: 8000 },
    );
  });

  it("offline_with_no_presence_and_no_save_is_inactive", async () => {
    setOnline(false);
    emitNet("offline");
    (global as unknown as { fetch: typeof fetch }).fetch = mockListAndTrip("fail", null);
    const { result } = renderHook(() =>
      useGroupItineraryOffline({ groupId: GROUP, itinerarySectionOpen: true }),
    );
    await waitFor(
      () => {
        expect(result.current.tripActive).toBe(false);
        expect(result.current.groupTripDetail).toBeNull();
        expect(result.current.tripPlanError).toBeNull();
      },
      { timeout: 8000 },
    );
  });

  it("remove_offline_copy_clears_user_save", async () => {
    await saveUserOfflineItinerary(
      TRIP,
      GROUP,
      tripJson as unknown as Record<string, unknown>,
    );
    setGroupTripPresence(GROUP, TRIP);
    (global as unknown as { fetch: typeof fetch }).fetch = mockListAndTrip(
      [{ groupID: GROUP, tripID: TRIP }],
      { ...tripJson, itineraryVersion: 1 },
    );
    const { result } = renderHook(() =>
      useGroupItineraryOffline({ groupId: GROUP, itinerarySectionOpen: true }),
    );
    await waitFor(() => {
      expect(result.current.userHasOfflineSave).toBe(true);
    });
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
    await act(async () => {
      await result.current.removeLocalItineraryCopy();
    });
    confirmSpy.mockRestore();
    await waitFor(() => {
      expect(result.current.userHasOfflineSave).toBe(false);
    });
  });
});
