import {
  getFullTripItineraryCache,
  putFullTripItineraryCache,
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

export async function fetchTripItineraryWithCache(
  tripId: string,
  groupId: string,
): Promise<TripItineraryFetchResult> {
  const tryCacheOnly = async (): Promise<TripItineraryFetchResult> => {
    const cached = await getFullTripItineraryCache(tripId);
    if (cached?.payload && hasValidItineraryShape(cached.payload)) {
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
  };

  if (!isOnlineClient()) {
    return tryCacheOnly();
  }

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
        await putFullTripItineraryCache(tripId, groupId, data);
        return {
          data,
          source: "network",
          isStale: false,
          error: "none",
        };
      }
    }

    const fallback = await getFullTripItineraryCache(tripId);
    if (fallback?.payload && hasValidItineraryShape(fallback.payload)) {
      return {
        data: fallback.payload,
        source: "cache",
        isStale: true,
        error: "none",
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
    const fallback = await getFullTripItineraryCache(tripId);
    if (fallback?.payload && hasValidItineraryShape(fallback.payload)) {
      return {
        data: fallback.payload,
        source: "cache",
        isStale: true,
        error: "none",
      };
    }
    if (!isOnlineClient()) {
      return {
        data: null,
        source: "none",
        isStale: false,
        error: "offline_unavailable",
      };
    }
    return { data: null, source: "none", isStale: false, error: "network" };
  }
}
