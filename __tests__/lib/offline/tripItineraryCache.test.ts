import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach } from "@jest/globals";
import {
  saveUserOfflineItinerary,
  getFullTripItineraryCache,
  getTripIdForGroup,
  hasUserSavedOfflineItineraryForGroup,
  patchItineraryInCache,
  deleteTripItineraryCache,
} from "@/lib/offline/tripItineraryCache";

const TRIP = "507f1f77bcf86cd799439011";
const GROUP = "g-group-1";

const basePayload: Record<string, unknown> = {
  _id: TRIP,
  groupID: GROUP,
  primaryItinerary: [],
  rainyDayItinerary: [],
  itineraryVersion: 0,
};

function clearIdb() {
  return new Promise<void>((resolve, reject) => {
    const d = indexedDB.deleteDatabase("bb-offline-v1");
    d.onsuccess = () => resolve();
    d.onerror = () => reject(d.error);
  });
}

beforeEach(async () => {
  await clearIdb();
});

describe("tripItineraryCache (IndexedDB)", () => {
  it("writes_and_reads_user_offline_copy", async () => {
    const payload = { ...basePayload, itineraryVersion: 2 };
    await saveUserOfflineItinerary(TRIP, GROUP, payload);
    const r = await getFullTripItineraryCache(TRIP);
    expect(r).not.toBeNull();
    expect(r!.savedByUser).toBe(true);
    expect(r!.payload.itineraryVersion).toBe(2);
    const gid = await getTripIdForGroup(GROUP);
    expect(gid).toBe(TRIP);
  });

  it("hasUserSavedOfflineItineraryForGroup", async () => {
    expect(await hasUserSavedOfflineItineraryForGroup(GROUP)).toBe(false);
    await saveUserOfflineItinerary(TRIP, GROUP, { ...basePayload });
    expect(await hasUserSavedOfflineItineraryForGroup(GROUP)).toBe(true);
  });

  it("patchItineraryInCache_merges_and_updates_version", async () => {
    await saveUserOfflineItinerary(TRIP, GROUP, { ...basePayload, mustHaves: [1, 2] });
    const nextRow = { name: "X", dayId: "d1", itineraryActivityId: "a1" };
    await patchItineraryInCache(TRIP, GROUP, {
      primaryItinerary: [nextRow],
      rainyDayItinerary: [nextRow],
      itineraryVersion: 3,
    });
    const r = await getFullTripItineraryCache(TRIP);
    expect((r!.payload as { mustHaves: unknown }).mustHaves).toEqual([1, 2]);
    expect((r!.payload as { itineraryVersion: number }).itineraryVersion).toBe(3);
    const pri = (r!.payload as { primaryItinerary: unknown[] }).primaryItinerary;
    expect(pri[0]).toEqual(nextRow);
  });

  it("deleteTripItineraryCache_removes_both", async () => {
    await saveUserOfflineItinerary(TRIP, GROUP, { ...basePayload });
    await deleteTripItineraryCache(TRIP, GROUP);
    expect(await getFullTripItineraryCache(TRIP)).toBeNull();
    expect(await getTripIdForGroup(GROUP)).toBeNull();
  });
});
