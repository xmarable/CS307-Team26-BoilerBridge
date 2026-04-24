import mongoose from "mongoose";

import Activity from "@/models/Activity";
import CalendarEvent from "@/models/CalendarEvent";
import { geocodeCityCenter } from "@/lib/travel/geocodeCityCenter";
import {
  fetchGooglePlaceEnrichment,
  type PlacesTextSearchBias,
} from "@/lib/travel/googlePlaces";

export type ExportQueryParsed = {
  from: Date;
  to: Date;
  includeManual: boolean;
  includeItinerary: boolean;
};

/**
 * Parse export query params. Defaults match calendar events GET: from=now, to=now+30d.
 */
export function parseExportQueryParams(searchParams: URLSearchParams): {
  ok: true;
  data: ExportQueryParsed;
} | { ok: false; error: string; status: number } {
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const now = new Date();

  const from = fromStr ? new Date(fromStr) : now;
  const to = toStr
    ? new Date(toStr)
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return {
      ok: false,
      error: "Invalid date params. Use ISO strings for from/to.",
      status: 400,
    };
  }
  if (to <= from) {
    return {
      ok: false,
      error: "Invalid date range: to must be after from",
      status: 400,
    };
  }

  const includeManual = searchParams.get("includeManual") !== "false";
  const includeItinerary = searchParams.get("includeItinerary") !== "false";

  return {
    ok: true,
    data: { from, to, includeManual, includeItinerary },
  };
}

export async function fetchCalendarEventsForExport(
  groupId: string,
  q: ExportQueryParsed,
) {
  const sources: ("manual" | "itinerary")[] = [];
  if (q.includeManual) sources.push("manual");
  if (q.includeItinerary) sources.push("itinerary");

  if (sources.length === 0) {
    return [];
  }

  return CalendarEvent.find({
    groupId,
    startTime: { $lt: q.to },
    endTime: { $gt: q.from },
    source: { $in: sources },
  })
    .sort({ startTime: 1 })
    .lean();
}

/** Subset of Activity fields surfaced on calendar rows for accessibility UI. */
export type VenueAccessibilityInfo = {
  wheelchairAccessible?: boolean;
  stepFree?: boolean;
  accessibleRestroom?: boolean;
  hearingAssistance?: boolean;
  visualAssistance?: boolean;
};

/** Max distinct Google Place IDs to resolve per calendar GET when live enrich is on. */
const MAX_LIVE_ENRICH_PLACES = 15;

/** Max Places text-search + detail round-trips for rows without a stored place id. */
const MAX_LIVE_ENRICH_TEXT_QUERIES = 8;

export type AttachVenueAccessibilityOptions = {
  /**
   * When true, calls Google Place Details for linked place ids (capped), fills in
   * mobility-related booleans that were unknown on the linked Activity, merges
   * them into `venueAccessibility`, and persists newly discovered values on Activity.
   */
  liveEnrich?: boolean;
};

function mergeVenueAccessibilityWithGoogle(
  db: VenueAccessibilityInfo | null,
  google: VenueAccessibilityInfo | undefined,
): VenueAccessibilityInfo | null {
  if (!google) return db;
  const hasGoogle = (
    ["wheelchairAccessible", "stepFree", "accessibleRestroom"] as const
  ).some((k) => typeof google[k] === "boolean");
  if (!hasGoogle) return db;
  const base: VenueAccessibilityInfo = { ...(db ?? {}) };
  for (const k of ["wheelchairAccessible", "stepFree", "accessibleRestroom"] as const) {
    if (base[k] === undefined && typeof google[k] === "boolean") {
      base[k] = google[k];
    }
  }
  const hasAny = (
    Object.keys(base) as (keyof VenueAccessibilityInfo)[]
  ).some((k) => typeof base[k] === "boolean");
  return hasAny ? base : db;
}

function googleEnrichmentToVenueSlice(g: {
  wheelchairAccessible?: boolean;
  stepFree?: boolean;
  accessibleRestroom?: boolean;
}): VenueAccessibilityInfo {
  const slice: VenueAccessibilityInfo = {};
  if (typeof g.wheelchairAccessible === "boolean") {
    slice.wheelchairAccessible = g.wheelchairAccessible;
  }
  if (typeof g.stepFree === "boolean") {
    slice.stepFree = g.stepFree;
  }
  if (typeof g.accessibleRestroom === "boolean") {
    slice.accessibleRestroom = g.accessibleRestroom;
  }
  return slice;
}

async function fetchGoogleVenueAccessibilityByPlaceId(
  placeIds: string[],
): Promise<Map<string, VenueAccessibilityInfo>> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  const out = new Map<string, VenueAccessibilityInfo>();
  if (!apiKey || placeIds.length === 0) return out;
  const unique = [...new Set(placeIds.map((p) => p.trim()).filter(Boolean))].slice(
    0,
    MAX_LIVE_ENRICH_PLACES,
  );
  await Promise.all(
    unique.map(async (pid) => {
      const g = await fetchGooglePlaceEnrichment(apiKey, { placeId: pid });
      if (!g) return;
      const slice = googleEnrichmentToVenueSlice(g);
      if (
        Object.keys(slice).length > 0 &&
        (typeof slice.wheelchairAccessible === "boolean" ||
          typeof slice.stepFree === "boolean" ||
          typeof slice.accessibleRestroom === "boolean")
      ) {
        out.set(pid, slice);
      }
    }),
  );
  return out;
}

type CalendarEventVenueTextFields = {
  linkedActivityId?: string;
  linkedPlaceId?: string;
  title?: string;
  location?: string;
  itineraryDestinationCity?: string;
  _id?: unknown;
};

function buildVenueTextSearchQuery(ev: CalendarEventVenueTextFields): string | null {
  const title = typeof ev.title === "string" ? ev.title.trim() : "";
  if (title.length < 2) return null;
  const loc = typeof ev.location === "string" ? ev.location.trim() : "";
  const dest =
    typeof ev.itineraryDestinationCity === "string"
      ? ev.itineraryDestinationCity.trim()
      : "";
  const parts: string[] = [title];
  if (loc) parts.push(loc);
  if (dest) {
    const dl = dest.toLowerCase();
    if (
      !title.toLowerCase().includes(dl) &&
      !loc.toLowerCase().includes(dl)
    ) {
      parts.push(dest);
    }
  }
  const q = parts.join(" ").replace(/\s+/g, " ").trim();
  return q.length >= 3 ? q : null;
}

function shouldUseTextSearchForVenueEnrichment(
  ev: CalendarEventVenueTextFields,
  actIdToPlaceId: Map<string, string>,
): boolean {
  const lp = ev.linkedPlaceId?.trim();
  if (lp) return false;
  const aid = ev.linkedActivityId?.trim();
  if (aid && mongoose.Types.ObjectId.isValid(aid) && actIdToPlaceId.has(aid)) {
    return false;
  }
  return buildVenueTextSearchQuery(ev) != null;
}

/**
 * For calendar rows with no Google place id, run the same text-search → details
 * path as itinerary link augmentation so mobility fields can still populate.
 */
async function applyLiveTextSearchVenueEnrichment<
  T extends CalendarEventVenueTextFields,
>(
  events: T[],
  rows: Array<T & { venueAccessibility: VenueAccessibilityInfo | null }>,
  actIdToPlaceId: Map<string, string>,
): Promise<Array<T & { venueAccessibility: VenueAccessibilityInfo | null }>> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey || events.length === 0) return rows;

  const out = rows.map((r) => ({ ...r }));
  const destBiasCache = new Map<string, PlacesTextSearchBias | null>();
  const queryCache = new Map<
    string,
    { slice: VenueAccessibilityInfo; placeId?: string } | null
  >();
  let fetchCount = 0;
  let rowsMergedFromText = 0;
  let calendarRowsLinkedPlaceId = 0;
  let skippedCap = 0;

  for (let i = 0; i < events.length; i++) {
    if (!shouldUseTextSearchForVenueEnrichment(events[i]!, actIdToPlaceId)) {
      continue;
    }
    const q = buildVenueTextSearchQuery(events[i]!);
    if (!q) continue;

    let cached = queryCache.get(q);
    if (cached === undefined) {
      if (fetchCount >= MAX_LIVE_ENRICH_TEXT_QUERIES) {
        skippedCap += 1;
        continue;
      }
      const dest = events[i]!.itineraryDestinationCity?.trim() ?? "";
      let textSearchBias: PlacesTextSearchBias | null = null;
      if (dest) {
        if (!destBiasCache.has(dest)) {
          const c = await geocodeCityCenter(apiKey, dest);
          destBiasCache.set(
            dest,
            c ? { ...c, radiusMeters: 50000 } : null,
          );
        }
        textSearchBias = destBiasCache.get(dest) ?? null;
      }
      const g = await fetchGooglePlaceEnrichment(apiKey, {
        placeId: null,
        fallbackTextQuery: q,
        textSearchBias,
      });
      fetchCount += 1;
      if (!g) {
        queryCache.set(q, null);
        cached = null;
      } else {
        const slice = googleEnrichmentToVenueSlice(g);
        const placeId = g.placeId?.trim();
        const entry =
          Object.keys(slice).length > 0
            ? { slice, ...(placeId ? { placeId } : {}) }
            : null;
        queryCache.set(q, entry);
        cached = entry;
      }
    }

    if (!cached) continue;
    out[i] = {
      ...out[i]!,
      venueAccessibility: mergeVenueAccessibilityWithGoogle(
        out[i]!.venueAccessibility,
        cached.slice,
      ),
    };
    rowsMergedFromText += 1;

    const ev = events[i]!;
    const priorPid = ev.linkedPlaceId?.trim();
    const evId = ev._id;
    if (evId != null && !priorPid && cached.placeId?.trim()) {
      const pid = cached.placeId.trim();
      await CalendarEvent.updateOne({ _id: evId as never }, { $set: { linkedPlaceId: pid } });
      (out[i] as T & { linkedPlaceId?: string }).linkedPlaceId = pid;
      calendarRowsLinkedPlaceId += 1;
    }
  }

  if (fetchCount > 0 || rowsMergedFromText > 0 || skippedCap > 0) {
    console.info("[venue-accessibility]", "text-search path", {
      googleTextPlusDetailCalls: fetchCount,
      uniqueQueriesCached: queryCache.size,
      calendarRowsWithMergedMobilityFromText: rowsMergedFromText,
      calendarEventsUpdatedWithLinkedPlaceId: calendarRowsLinkedPlaceId,
      rowsSkippedTextCap: skippedCap,
    });
  }

  return out;
}

async function persistActivityAccessibilityPatches(
  docs: Record<string, unknown>[],
  overlays: Map<string, VenueAccessibilityInfo>,
): Promise<number> {
  let updated = 0;
  for (const raw of docs) {
    const d = raw as Record<string, unknown>;
    const pid = typeof d.placeId === "string" ? d.placeId.trim() : "";
    if (!pid) continue;
    const slice = overlays.get(pid);
    if (!slice) continue;
    const patch: Record<string, boolean> = {};
    for (const k of ["wheelchairAccessible", "stepFree", "accessibleRestroom"] as const) {
      if (d[k] === undefined && typeof slice[k] === "boolean") {
        patch[k] = slice[k];
      }
    }
    if (Object.keys(patch).length === 0) continue;
    await Activity.updateOne({ _id: d._id }, { $set: patch });
    updated += 1;
  }
  return updated;
}

function activityDocToVenueA11y(
  doc: Record<string, unknown>,
): VenueAccessibilityInfo {
  return {
    wheelchairAccessible:
      typeof doc.wheelchairAccessible === "boolean"
        ? doc.wheelchairAccessible
        : undefined,
    stepFree: typeof doc.stepFree === "boolean" ? doc.stepFree : undefined,
    accessibleRestroom:
      typeof doc.accessibleRestroom === "boolean"
        ? doc.accessibleRestroom
        : undefined,
    hearingAssistance:
      typeof doc.hearingAssistance === "boolean"
        ? doc.hearingAssistance
        : undefined,
    visualAssistance:
      typeof doc.visualAssistance === "boolean"
        ? doc.visualAssistance
        : undefined,
  };
}

/**
 * Adds `venueAccessibility` from linked Activity docs (by Mongo _id or placeId)
 * so the client can show per-requirement met / not met / unknown.
 */
export async function attachVenueAccessibilityToCalendarEvents<
  T extends CalendarEventVenueTextFields,
>(
  events: T[],
  options?: AttachVenueAccessibilityOptions,
): Promise<Array<T & { venueAccessibility: VenueAccessibilityInfo | null }>> {
  const mongoIds = new Set<string>();
  const placeIds = new Set<string>();
  for (const ev of events) {
    const aid = ev.linkedActivityId?.trim();
    if (aid && mongoose.Types.ObjectId.isValid(aid)) mongoIds.add(aid);
    const pid = ev.linkedPlaceId?.trim();
    if (pid) placeIds.add(pid);
  }

  const byId = new Map<string, VenueAccessibilityInfo>();
  const byPlaceId = new Map<string, VenueAccessibilityInfo>();
  const actIdToPlaceId = new Map<string, string>();
  let docs: Record<string, unknown>[] = [];

  if (mongoIds.size > 0 || placeIds.size > 0) {
    const or: Record<string, unknown>[] = [];
    if (mongoIds.size > 0) {
      or.push({
        _id: {
          $in: [...mongoIds].map((id) => new mongoose.Types.ObjectId(id)),
        },
      });
    }
    if (placeIds.size > 0) {
      or.push({ placeId: { $in: [...placeIds] } });
    }
    docs = (await Activity.find({ $or: or })
      .select({
        _id: 1,
        placeId: 1,
        wheelchairAccessible: 1,
        stepFree: 1,
        accessibleRestroom: 1,
        hearingAssistance: 1,
        visualAssistance: 1,
      })
      .lean()) as Record<string, unknown>[];

    for (const raw of docs) {
      const d = raw as Record<string, unknown>;
      const slice = activityDocToVenueA11y(d);
      byId.set(String(d._id), slice);
      const pid = typeof d.placeId === "string" ? d.placeId.trim() : "";
      if (pid) {
        byPlaceId.set(pid, slice);
        actIdToPlaceId.set(String(d._id), pid);
      }
    }
  }

  const baseRows = events.map((ev) => {
    let venue: VenueAccessibilityInfo | null = null;
    const aid = ev.linkedActivityId?.trim();
    if (aid && mongoose.Types.ObjectId.isValid(aid)) {
      venue = byId.get(aid) ?? null;
    }
    if (!venue) {
      const pid = ev.linkedPlaceId?.trim();
      if (pid) venue = byPlaceId.get(pid) ?? null;
    }
    return { ...ev, venueAccessibility: venue };
  });

  if (!options?.liveEnrich) {
    return baseRows;
  }

  const hasGoogleKey = Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());
  const rowsWithLinkedActivity = events.filter(
    (e) =>
      e.linkedActivityId?.trim() &&
      mongoose.Types.ObjectId.isValid(e.linkedActivityId.trim()),
  ).length;
  const rowsWithLinkedPlace = events.filter((e) => e.linkedPlaceId?.trim()).length;

  console.info("[venue-accessibility]", "live enrich requested", {
    calendarRows: events.length,
    rowsWithLinkedActivityId: rowsWithLinkedActivity,
    rowsWithLinkedPlaceId: rowsWithLinkedPlace,
    googleMapsApiKeyConfigured: hasGoogleKey,
    activityCatalogDocsLoaded: docs.length,
  });

  if (!hasGoogleKey) {
    console.warn(
      "[venue-accessibility]",
      "GOOGLE_MAPS_API_KEY missing or empty in this server process; skipping Google mobility lookups",
    );
    return baseRows;
  }

  const epids: string[] = [];
  for (const ev of events) {
    const lp = ev.linkedPlaceId?.trim();
    if (lp) {
      epids.push(lp);
      continue;
    }
    const aid = ev.linkedActivityId?.trim();
    if (aid && mongoose.Types.ObjectId.isValid(aid)) {
      const p = actIdToPlaceId.get(aid);
      if (p) epids.push(p);
    }
  }

  const uniquePlaceIdCount = new Set(epids.map((p) => p.trim()).filter(Boolean)).size;
  const overlays = await fetchGoogleVenueAccessibilityByPlaceId(epids);
  let activityDocsPatched = 0;
  if (overlays.size > 0) {
    activityDocsPatched = await persistActivityAccessibilityPatches(docs, overlays);
  }

  console.info("[venue-accessibility]", "place-details path", {
    distinctPlaceIdsOnCalendarRows: uniquePlaceIdCount,
    cappedAt: MAX_LIVE_ENRICH_PLACES,
    placeOverlaysWithMobilityFields: overlays.size,
    activityDocumentsPatchedFromGoogle: activityDocsPatched,
  });

  const afterPlaceMerge = baseRows.map((row) => {
    const ev = row as T;
    const lp = ev.linkedPlaceId?.trim();
    let epid: string | null = null;
    if (lp) {
      epid = lp;
    } else {
      const aid = ev.linkedActivityId?.trim();
      if (aid && mongoose.Types.ObjectId.isValid(aid)) {
        epid = actIdToPlaceId.get(aid) ?? null;
      }
    }
    const overlay = epid ? overlays.get(epid) : undefined;
    const merged = mergeVenueAccessibilityWithGoogle(row.venueAccessibility, overlay);
    return { ...row, venueAccessibility: merged };
  });

  return applyLiveTextSearchVenueEnrichment(events, afterPlaceMerge, actIdToPlaceId);
}
