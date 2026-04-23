"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTripItineraryWithCache } from "@/lib/offline/fetchTripItineraryWithCache";
import {
  getTripIdForGroup,
  hasUsableItineraryCacheForGroup,
  patchItineraryInCache,
  putGroupTripIdMapping,
} from "@/lib/offline/tripItineraryCache";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import type { RainyDayTripInput } from "@/components/RainyDayToggle";

type GroupTripDetailState = (RainyDayTripInput & { _id: string }) | null;

type Options = {
  groupId: string | undefined;
  itinerarySectionOpen: boolean;
};

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
  const loadGen = useRef(0);
  const tripActiveGen = useRef(0);
  const mountedRef = useRef(true);

  const resolveTripActive = useCallback(async () => {
    if (!groupId) {
      tripActiveGen.current += 1;
      setTripActive(false);
      return;
    }
    const my = ++tripActiveGen.current;
    let active = false;
    try {
      const res = await fetch(`/api/trip`, { credentials: "include" });
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
      if (fromMap && (await hasUsableItineraryCacheForGroup(groupId))) {
        active = true;
      }
    }
    if (my !== tripActiveGen.current) return;
    setTripActive(active);
  }, [groupId]);

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
      setTripPlanLoading(false);
      return;
    }
    const myGen = ++loadGen.current;
    setTripPlanLoading(true);
    setTripPlanError(null);
    setIsShowingCached(false);
    let tripId: string | null = null;
    try {
      if (isOnline) {
        try {
          const listRes = await fetch(`/api/trip`, { credentials: "include" });
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
          // will fall back to mapping + cache
        }
        if (myGen !== loadGen.current) return;
      }
      if (!tripId) {
        tripId = await getTripIdForGroup(groupId);
      }
      if (myGen !== loadGen.current) return;
      if (!tripId) {
        if (myGen === loadGen.current) {
          setGroupTripDetail(null);
          if (!isOnline) setTripPlanError("offline_unavailable");
          setIsShowingCached(false);
        }
        return;
      }
      const out = await fetchTripItineraryWithCache(tripId, groupId);
      if (myGen !== loadGen.current) return;

      if (out.error === "unauthorized") {
        setGroupTripDetail(null);
        setTripPlanError("auth");
        setIsShowingCached(false);
        return;
      }

      if (isTripPayloadUsable(out.data as Record<string, unknown> | null)) {
        const d = out.data as Record<string, unknown>;
        setGroupTripDetail({
          _id: String(d._id),
          primaryItinerary: d.primaryItinerary as RainyDayTripInput["primaryItinerary"],
          rainyDayItinerary: d.rainyDayItinerary as RainyDayTripInput["rainyDayItinerary"],
          itineraryVersion:
            typeof d.itineraryVersion === "number" ? d.itineraryVersion : 0,
        });
        setIsShowingCached(out.source === "cache" || out.isStale);
        setTripPlanError(null);
        return;
      }

      if (out.error === "offline_unavailable") {
        setGroupTripDetail(null);
        setTripPlanError("offline_unavailable");
        setIsShowingCached(false);
        return;
      }

      setGroupTripDetail(null);
      setTripPlanError("other");
      setIsShowingCached(false);
    } catch {
      if (myGen === loadGen.current) {
        setGroupTripDetail(null);
        setTripPlanError(!isOnline ? "offline_unavailable" : "other");
        setIsShowingCached(false);
      }
    } finally {
      if (myGen === loadGen.current) {
        setTripPlanLoading(false);
      }
    }
  }, [groupId, tripActive, itinerarySectionOpen, isOnline]);

  useEffect(() => {
    void loadTripDetail();
  }, [loadTripDetail]);

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
          });
        }
        return next;
      });
    },
    [groupId],
  );

  const resetAfterTripDelete = useCallback(() => {
    loadGen.current += 1;
    tripActiveGen.current += 1;
    setTripActive(false);
    setGroupTripDetail(null);
    setTripPlanError(null);
    setIsShowingCached(false);
    setTripPlanLoading(false);
  }, []);

  return {
    tripActive,
    groupTripDetail,
    tripPlanLoading,
    tripPlanError,
    isOffline: !isOnline,
    isShowingCached,
    refreshTripItinerary: loadTripDetail,
    onItinerarySynced,
    resetAfterTripDelete,
  };
}
