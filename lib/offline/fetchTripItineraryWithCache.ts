import {
  getFullTripItineraryCache,
  syncUserSavedOfflinePayload,
} from "@/lib/offline/tripItineraryCache";

export type TripItineraryFetchResult = {
  data: Record<string, unknown> | null;
  source: "network" | "cache" | "none";
  isStale: boolean;
  error: "none" | "offline_unavailable" | "unauthorized" | "not_found" | "network";
  httpStatus?: number;
};

function isOnlineClient(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

function hasValidItineraryShape(d: Record<string, unknown>): boolean {
  return (
    d._id != null &&
    Array.isArray(d.primaryItinerary) &&
    Array.isArray(d.rainyDayItinerary)
  );
}

export async function readUserSavedOfflineTripItinerary(
  tripId: string,
): Promise<TripItineraryFetchResult> {
  const cached = await getFullTripItineraryCache(tripId);
  if (cached?.savedByUser === true && cached.payload && hasValidItineraryShape(cached.payload)) {
    return {
      data: cached.payload,
      source: "cache",
      isStale: true,
      error: "none",
    };
  }
  return {
    data: null,
    source: "none",
    isStale: false,
    error: "offline_unavailable",
  };
}

export async function fetchTripItineraryFromNetwork(
  tripId: string,
): Promise<TripItineraryFetchResult> {
  try {
    const res = await fetch(`/api/trip/${encodeURIComponent(tripId)}`, {
      credentials: "include",
    });

    if (res.status === 401) {
      return { data: null, source: "none", isStale: false, error: "unauthorized" };
    }

    if (res.status === 404) {
      return { data: null, source: "none", isStale: false, error: "not_found", httpStatus: 404 };
    }

    if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>;
      if (hasValidItineraryShape(data)) {
        return {
          data,
          source: "network",
          isStale: false,
          error: "none",
        };
      }
      return {
        data: null,
        source: "none",
        isStale: false,
        error: "network",
        httpStatus: res.status,
      };
    }

    return {
      data: null,
      source: "none",
      isStale: false,
      error: "network",
      httpStatus: res.status,
    };
  } catch {
    return { data: null, source: "none", isStale: false, error: "network" };
  }
}

export async function fetchTripItineraryWithCache(
  tripId: string,
  groupId: string,
): Promise<TripItineraryFetchResult> {
  if (!isOnlineClient()) {
    return readUserSavedOfflineTripItinerary(tripId);
  }

  const net = await fetchTripItineraryFromNetwork(tripId);

  if (net.error === "unauthorized") {
    return net;
  }

  if (net.error === "not_found") {
    return net;
  }

  if (net.data && net.error === "none") {
    await syncUserSavedOfflinePayload(tripId, groupId, net.data);
    return net;
  }

  const fallback = await readUserSavedOfflineTripItinerary(tripId);
  if (fallback.data) {
    return {
      ...fallback,
      isStale: true,
      httpStatus: net.httpStatus,
    };
  }

  if (net.error === "network") {
    return net;
  }

  return fallback;
}
