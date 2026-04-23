"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchTripItineraryFromNetwork,
  fetchTripItineraryWithCache,
  readUserSavedOfflineTripItinerary,
} from "@/lib/offline/fetchTripItineraryWithCache";
import {
  clearGroupTripPresence,
  getGroupTripPresenceTripId,
  setGroupTripPresence,
} from "@/lib/offline/groupTripPresence";
import {
  deleteTripItineraryCache,
  getFullTripItineraryCache,
  getTripIdForGroup,
  hasUserSavedOfflineItineraryForGroup,
  isItineraryCacheSupported,
  patchItineraryInCache,
  putGroupTripIdMapping,
  saveUserOfflineItinerary,
} from "@/lib/offline/tripItineraryCache";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import type { RainyDayTripInput } from "@/components/RainyDayToggle";

type GroupTripDetailState = (RainyDayTripInput & { _id: string }) | null;

type Options = {
  groupId: string | undefined;
  itinerarySectionOpen: boolean;
};

type ItinerarySyncState = "idle" | "syncing" | "failed";

function isTripPayloadUsable(
  d: Record<string, unknown> | null | undefined,
): d is Record<string, unknown> {
  if (!d) return false;
  return (
    d._id != null &&
    Array.isArray(d.primaryItinerary) &&
    Array.isArray(d.rainyDayItinerary)
  );
}

async function resolveTripIdForGroup(
  groupId: string,
  isOnline: boolean,
  listTripsForGroup: (gid: string) => Promise<Response>,
): Promise<string | null> {
  let tripId: string | null = null;
  if (isOnline) {
    try {
      const listRes = await listTripsForGroup(groupId);
      if (listRes.ok) {
        const data = (await listRes.json()) as unknown;
        const trips = Array.isArray(data) ? data : [];
        const mine = trips.find(
          (t: { groupID?: string; tripID?: string }) => t?.groupID === groupId,
        ) as { tripID?: string } | undefined;
        if (mine?.tripID) {
          tripId = String(mine.tripID);
          await putGroupTripIdMapping(groupId, tripId);
        }
      }
    } catch {
      /* fall through */
    }
  }
  if (!tripId) {
    tripId = await getTripIdForGroup(groupId);
  }
  if (!tripId) {
    tripId = getGroupTripPresenceTripId(groupId);
  }
  return tripId;
}

function applyTripFetchToState(
  out: Awaited<ReturnType<typeof fetchTripItineraryWithCache>>,
  setters: {
    setGroupTripDetail: (v: GroupTripDetailState) => void;
    setIsShowingCached: (v: boolean) => void;
    setTripPlanError: (v: null | "offline_unavailable" | "auth" | "other") => void;
    setUserHasOfflineSave: (v: boolean) => void;
    setSavedAt: (v: number | null) => void;
    setLastSyncedAt: (v: number | null) => void;
  },
) {
  if (out.error === "unauthorized") {
    setters.setGroupTripDetail(null);
    setters.setTripPlanError("auth");
    setters.setIsShowingCached(false);
    setters.setUserHasOfflineSave(false);
    setters.setSavedAt(null);
    setters.setLastSyncedAt(null);
    return;
  }

  if (isTripPayloadUsable(out.data as Record<string, unknown> | null)) {
    const d = out.data as Record<string, unknown>;
    setters.setGroupTripDetail({
      _id: String(d._id),
      primaryItinerary: d.primaryItinerary as RainyDayTripInput["primaryItinerary"],
      rainyDayItinerary: d.rainyDayItinerary as RainyDayTripInput["rainyDayItinerary"],
      itineraryVersion:
        typeof d.itineraryVersion === "number" ? d.itineraryVersion : 0,
    });
    setters.setIsShowingCached(out.source === "cache" || out.isStale);
    setters.setTripPlanError(null);
    return;
  }

  if (out.error === "offline_unavailable") {
    setters.setGroupTripDetail(null);
    setters.setTripPlanError("offline_unavailable");
    setters.setIsShowingCached(false);
    setters.setUserHasOfflineSave(false);
    setters.setSavedAt(null);
    setters.setLastSyncedAt(null);
    return;
  }

  setters.setGroupTripDetail(null);
  setters.setTripPlanError("other");
  setters.setIsShowingCached(false);
  setters.setUserHasOfflineSave(false);
  setters.setSavedAt(null);
  setters.setLastSyncedAt(null);
}

export function useGroupItineraryOffline({
  groupId,
  itinerarySectionOpen,
}: Options) {
  const isOnline = useOnlineStatus();
  const [tripActive, setTripActive] = useState(false);
  const [groupTripDetail, setGroupTripDetail] =
    useState<GroupTripDetailState>(null);
  const [tripPlanLoading, setTripPlanLoading] = useState(false);
  const [tripPlanError, setTripPlanError] = useState<
    null | "offline_unavailable" | "auth" | "other"
  >(null);
  const [isShowingCached, setIsShowingCached] = useState(false);
  const [userHasOfflineSave, setUserHasOfflineSave] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [idbSupported, setIdbSupported] = useState(true);
  const [itinerarySyncState, setItinerarySyncState] =
    useState<ItinerarySyncState>("idle");
  const [offlineActionBusy, setOfflineActionBusy] = useState(false);
  const loadGen = useRef(0);
  const tripActiveGen = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    setIdbSupported(isItineraryCacheSupported());
  }, []);

  const listTripsForGroup = useCallback((gid: string) => {
    const q = new URLSearchParams({ groupId: gid });
    return fetch(`/api/trip?${q.toString()}`, { credentials: "include" });
  }, []);

  const refreshOfflineMeta = useCallback(async (tripId: string) => {
    try {
      const rec = await getFullTripItineraryCache(tripId);
      const saved = rec?.savedByUser === true;
      setUserHasOfflineSave(saved);
      setSavedAt(saved && typeof rec?.savedAt === "number" ? rec.savedAt : null);
      setLastSyncedAt(
        saved && typeof rec?.lastSyncedAt === "number" ? rec.lastSyncedAt : null,
      );
    } catch {
      setUserHasOfflineSave(false);
      setSavedAt(null);
      setLastSyncedAt(null);
    }
  }, []);

  const resolveTripActive = useCallback(async () => {
    if (!groupId) {
      tripActiveGen.current += 1;
      setTripActive(false);
      return;
    }
    const my = ++tripActiveGen.current;
    let active = false;
    if (!isOnline) {
      if (await hasUserSavedOfflineItineraryForGroup(groupId)) {
        active = true;
      } else if (getGroupTripPresenceTripId(groupId)) {
        active = true;
      } else if (await getTripIdForGroup(groupId)) {
        active = true;
      }
      if (my !== tripActiveGen.current) return;
      setTripActive(active);
      return;
    }

    try {
      const res = await listTripsForGroup(groupId);
      if (my !== tripActiveGen.current) return;
      if (res.ok) {
        const data = (await res.json()) as unknown;
        if (my !== tripActiveGen.current) return;
        const trips = Array.isArray(data) ? data : [];
        const mine = trips.find(
          (t: { groupID?: string; tripID?: string }) => t?.groupID === groupId,
        ) as { tripID?: string } | undefined;
        if (mine?.tripID) {
          active = true;
          await putGroupTripIdMapping(groupId, String(mine.tripID));
        }
        if (my !== tripActiveGen.current) return;
      }
    } catch {
      if (my !== tripActiveGen.current) return;
    }
    if (!active) {
      const fromMap = await getTripIdForGroup(groupId);
      if (my !== tripActiveGen.current) return;
      if (fromMap) {
        active = true;
      }
    }
    if (my !== tripActiveGen.current) return;
    setTripActive(active);
  }, [groupId, isOnline, listTripsForGroup]);

  useEffect(() => {
    if (!groupId) return;
    void resolveTripActive();
  }, [groupId, isOnline, resolveTripActive]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      loadGen.current += 1;
      tripActiveGen.current += 1;
    };
  }, []);

  const loadTripDetail = useCallback(async () => {
    if (!groupId || !tripActive || !itinerarySectionOpen) {
      loadGen.current += 1;
      setGroupTripDetail(null);
      setTripPlanError(null);
      setIsShowingCached(false);
      setUserHasOfflineSave(false);
      setSavedAt(null);
      setLastSyncedAt(null);
      setTripPlanLoading(false);
      setItinerarySyncState("idle");
      return;
    }
    const myGen = ++loadGen.current;
    setTripPlanError(null);

    if (!isOnline) {
      setItinerarySyncState("idle");
      setTripPlanLoading(true);
      const tripId =
        (await getTripIdForGroup(groupId)) ?? getGroupTripPresenceTripId(groupId);
      if (myGen !== loadGen.current) return;
      if (!tripId) {
        setGroupTripDetail(null);
        setTripPlanError("offline_unavailable");
        setIsShowingCached(false);
        setUserHasOfflineSave(false);
        setSavedAt(null);
        setLastSyncedAt(null);
        setTripPlanLoading(false);
        return;
      }
      const out = await readUserSavedOfflineTripItinerary(tripId);
      if (myGen !== loadGen.current) return;
      const setters = {
        setGroupTripDetail,
        setIsShowingCached,
        setTripPlanError,
        setUserHasOfflineSave,
        setSavedAt,
        setLastSyncedAt,
      };
      applyTripFetchToState(out, setters);
      if (out.data && myGen === loadGen.current) {
        await refreshOfflineMeta(tripId);
      }
      if (myGen === loadGen.current) {
        setTripPlanLoading(false);
      }
      return;
    }

    setTripPlanLoading(true);
    setIsShowingCached(false);

    let hadUserSave = false;
    try {
      const tripId = await resolveTripIdForGroup(
        groupId,
        isOnline,
        listTripsForGroup,
      );
      if (myGen !== loadGen.current) return;
      if (tripId) {
        const pre = await getFullTripItineraryCache(tripId);
        hadUserSave = pre?.savedByUser === true;
        if (hadUserSave) {
          setItinerarySyncState("syncing");
        }
      }
      if (!tripId) {
        if (myGen === loadGen.current) {
          setGroupTripDetail(null);
          setTripPlanError(null);
          setUserHasOfflineSave(false);
          setSavedAt(null);
          setLastSyncedAt(null);
          setItinerarySyncState("idle");
        }
        return;
      }

      const out = await fetchTripItineraryWithCache(tripId, groupId);
      if (myGen !== loadGen.current) return;

      if (out.data && out.error === "none" && out.source === "network") {
        setGroupTripPresence(groupId, tripId);
      }

      applyTripFetchToState(out, {
        setGroupTripDetail,
        setIsShowingCached,
        setTripPlanError,
        setUserHasOfflineSave,
        setSavedAt,
        setLastSyncedAt,
      });

      if (out.data && myGen === loadGen.current) {
        await refreshOfflineMeta(tripId);
      }

      if (myGen === loadGen.current) {
        if (
          hadUserSave &&
          out.data &&
          out.error === "none" &&
          (out.source === "cache" || out.isStale)
        ) {
          setItinerarySyncState("failed");
        } else {
          setItinerarySyncState("idle");
        }
      }
    } catch {
      if (myGen === loadGen.current) {
        setGroupTripDetail(null);
        setTripPlanError("other");
        setIsShowingCached(false);
        setUserHasOfflineSave(false);
        setSavedAt(null);
        setLastSyncedAt(null);
        setItinerarySyncState(hadUserSave ? "failed" : "idle");
      }
    } finally {
      if (myGen === loadGen.current) {
        setTripPlanLoading(false);
      }
    }
  }, [
    groupId,
    tripActive,
    itinerarySectionOpen,
    isOnline,
    listTripsForGroup,
    refreshOfflineMeta,
  ]);

  useEffect(() => {
    void loadTripDetail();
  }, [loadTripDetail]);

  const saveForOffline = useCallback(async () => {
    if (!groupId || !idbSupported) return;
    const tid =
      groupTripDetail?._id ??
      (await getTripIdForGroup(groupId)) ??
      getGroupTripPresenceTripId(groupId);
    if (!tid) return;
    setOfflineActionBusy(true);
    setItinerarySyncState("syncing");
    try {
      const net = await fetchTripItineraryFromNetwork(tid);
      if (!net.data || net.error !== "none") {
        setItinerarySyncState("failed");
        return;
      }
      await saveUserOfflineItinerary(tid, groupId, net.data);
      await putGroupTripIdMapping(groupId, tid);
      setGroupTripPresence(groupId, tid);
      setGroupTripDetail({
        _id: String(net.data._id),
        primaryItinerary: net.data.primaryItinerary as RainyDayTripInput["primaryItinerary"],
        rainyDayItinerary: net.data.rainyDayItinerary as RainyDayTripInput["rainyDayItinerary"],
        itineraryVersion:
          typeof net.data.itineraryVersion === "number" ? net.data.itineraryVersion : 0,
      });
      setIsShowingCached(false);
      setTripPlanError(null);
      await refreshOfflineMeta(tid);
      setItinerarySyncState("idle");
    } catch {
      setItinerarySyncState("failed");
    } finally {
      setOfflineActionBusy(false);
    }
  }, [groupId, groupTripDetail, idbSupported, refreshOfflineMeta]);

  const onItinerarySynced = useCallback(
    (payload: {
      itineraryVersion: number;
      primaryItinerary: RainyDayTripInput["primaryItinerary"];
      rainyDayItinerary: RainyDayTripInput["rainyDayItinerary"];
    }) => {
      if (!mountedRef.current) return;
      setGroupTripDetail((prev) => {
        if (!prev) return null;
        const next: GroupTripDetailState = {
          ...prev,
          primaryItinerary: payload.primaryItinerary,
          rainyDayItinerary: payload.rainyDayItinerary,
          itineraryVersion: payload.itineraryVersion,
        };
        if (groupId) {
          void patchItineraryInCache(String(next._id), groupId, {
            primaryItinerary: payload.primaryItinerary,
            rainyDayItinerary: payload.rainyDayItinerary,
            itineraryVersion: payload.itineraryVersion,
          }).then(() => {
            if (mountedRef.current) {
              void refreshOfflineMeta(String(next._id));
            }
          });
        }
        return next;
      });
    },
    [groupId, refreshOfflineMeta],
  );

  const removeLocalItineraryCopy = useCallback(async () => {
    if (!groupId) return;
    if (
      !window.confirm(
        "Remove the offline copy of this itinerary from this device? " +
          "You will need an internet connection to view it again unless you save it again while online.",
      )
    ) {
      return;
    }
    const tid =
      groupTripDetail?._id ||
      (await getTripIdForGroup(groupId)) ||
      getGroupTripPresenceTripId(groupId) ||
      null;
    if (!tid) return;
    await deleteTripItineraryCache(tid, groupId);
    setUserHasOfflineSave(false);
    setSavedAt(null);
    setLastSyncedAt(null);
    setIsShowingCached(false);
    await loadTripDetail();
  }, [groupId, groupTripDetail, loadTripDetail]);

  const resetAfterTripDelete = useCallback(() => {
    if (groupId) {
      clearGroupTripPresence(groupId);
    }
    loadGen.current += 1;
    tripActiveGen.current += 1;
    setTripActive(false);
    setGroupTripDetail(null);
    setTripPlanError(null);
    setIsShowingCached(false);
    setUserHasOfflineSave(false);
    setSavedAt(null);
    setLastSyncedAt(null);
    setTripPlanLoading(false);
    setItinerarySyncState("idle");
  }, [groupId]);

  return {
    tripActive,
    groupTripDetail,
    tripPlanLoading,
    tripPlanError,
    isOffline: !isOnline,
    isShowingCached,
    userHasOfflineSave,
    savedAt,
    lastSyncedAt,
    lastDeviceSavedAt: lastSyncedAt,
    idbSupported,
    itinerarySyncState,
    offlineActionBusy,
    refreshTripItinerary: loadTripDetail,
    removeLocalItineraryCopy,
    saveForOffline,
    onItinerarySynced,
    resetAfterTripDelete,
  };
}
