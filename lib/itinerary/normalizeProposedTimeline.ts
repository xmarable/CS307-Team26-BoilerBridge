import type { TripContext } from "@/lib/itinerary/generatePartial";
import {
  finalizeItineraryProposedEvents,
  repairItinerarySlice,
} from "@/lib/itinerary/finalizeItineraryProposedEvents";
import type { ProposedEventInput } from "@/lib/itinerary/schemas";

const MIN_DURATION_MS = 30 * 60 * 1000;
const DEFAULT_DURATION_MS = 90 * 60 * 1000;
/** When the model returns absurdly long blocks, cap repaired duration for realism. */
const MAX_DURATION_MS = 12 * 60 * 60 * 1000;

function clampDurationMs(ms: number): number {
  if (!Number.isFinite(ms) || ms < MIN_DURATION_MS) return DEFAULT_DURATION_MS;
  return Math.min(ms, MAX_DURATION_MS);
}

/**
 * Legacy: sorts proposed events by start time and removes overlaps by shifting
 * each later event to start when the previous one ends, preserving clamped duration.
 */
export function legacyNormalizeProposedTimeline(
  events: ProposedEventInput[],
): ProposedEventInput[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime(),
  );

  const out: ProposedEventInput[] = [];
  let prevEndMs = 0;

  for (let i = 0; i < sorted.length; i++) {
    const raw = sorted[i]!;
    let start = new Date(raw.startTime);
    let end = new Date(raw.endTime);

    if (Number.isNaN(start.getTime())) {
      start = new Date(prevEndMs || Date.now());
    }
    if (Number.isNaN(end.getTime())) {
      end = new Date(start.getTime() + DEFAULT_DURATION_MS);
    }

    let durationMs = end.getTime() - start.getTime();
    durationMs = clampDurationMs(durationMs);

    if (i > 0 && start.getTime() < prevEndMs) {
      start = new Date(prevEndMs);
    }

    end = new Date(start.getTime() + durationMs);
    if (end.getTime() <= start.getTime()) {
      end = new Date(start.getTime() + MIN_DURATION_MS);
    }

    prevEndMs = end.getTime();
    out.push({
      ...raw,
      startTime: start,
      endTime: end,
    });
  }

  return out;
}

export type NormalizeTimelineOptions = {
  trip?: TripContext;
  /** When true with `trip`, skips inserting intercity travel rows (partial regenerate). */
  slice?: boolean;
};

/**
 * When `trip` is provided, applies transport-aware repair (travel blocks,
 * intra-city buffers, duration caps). Otherwise uses the legacy overlap fixer.
 */
export function normalizeProposedTimeline(
  events: ProposedEventInput[],
  opts?: NormalizeTimelineOptions,
): ProposedEventInput[] {
  if (opts?.trip) {
    if (opts.slice) {
      return repairItinerarySlice(events, opts.trip);
    }
    return finalizeItineraryProposedEvents(events, opts.trip);
  }
  return legacyNormalizeProposedTimeline(events);
}
