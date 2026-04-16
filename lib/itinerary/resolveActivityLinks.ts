import mongoose from "mongoose";

import Activity from "@/models/Activity";
import type { ProposedEventInput } from "@/lib/itinerary/schemas";

export type ResolvedActivityLink = {
  linkedActivityId?: string;
  linkedPlaceId?: string;
  /** Preferred display address from destination-aware text search */
  linkedLocationHint?: string;
};

type MustHaveLike = {
  name: string;
  placeId?: string;
  address?: string;
};

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function titleMatchesMustHave(title: string, mustName: string): boolean {
  const t = norm(title);
  const n = norm(mustName);
  if (!t || !n) return false;
  if (t === n) return true;
  if (t.includes(n) || n.includes(t)) return true;
  const parts = n.split(" ").filter((w) => w.length > 3);
  return parts.some((w) => t.includes(w));
}

/**
 * Resolves optional deep links for calendar rows: prefer stored Activity by
 * Google place id from approved must-haves, then exact/near name match in Activity.
 */
export async function resolveActivityLinksForProposals(
  events: ProposedEventInput[],
  mustHaves: MustHaveLike[],
): Promise<ResolvedActivityLink[]> {
  const placeIds = [
    ...new Set(
      mustHaves
        .map((m) => (typeof m.placeId === "string" ? m.placeId.trim() : ""))
        .filter(Boolean),
    ),
  ];

  const placeIdToActivityId = new Map<string, string>();
  if (placeIds.length > 0) {
    const rows = await Activity.find({ placeId: { $in: placeIds } })
      .select({ _id: 1, placeId: 1 })
      .lean();
    for (const row of rows) {
      const pid = (row as { placeId?: string }).placeId;
      if (pid) placeIdToActivityId.set(pid, String((row as { _id: unknown })._id));
    }
  }

  const titlesNeedingLookup = new Set<string>();
  for (const ev of events) {
    const matched = mustHaves.some((m) => titleMatchesMustHave(ev.title, m.name));
    if (!matched) {
      const k = norm(ev.title);
      if (k) titlesNeedingLookup.add(k);
    }
  }

  const titleToActivityId = new Map<string, string>();
  const or = [...titlesNeedingLookup].map((t) => ({
    name: new RegExp(`^${escapeRegex(t)}$`, "i"),
  }));
  if (or.length > 0) {
    const found = await Activity.find({ $or: or }).select({ _id: 1, name: 1 }).lean();
    for (const row of found) {
      const nm = norm(String((row as { name?: string }).name ?? ""));
      if (nm) titleToActivityId.set(nm, String((row as { _id: unknown })._id));
    }
  }

  return events.map((ev) => {
    const tKey = norm(ev.title);
    for (const mh of mustHaves) {
      if (!titleMatchesMustHave(ev.title, mh.name)) continue;
      const pid = mh.placeId?.trim();
      if (pid) {
        const actId = placeIdToActivityId.get(pid);
        if (actId && mongoose.Types.ObjectId.isValid(actId)) {
          return { linkedActivityId: actId, linkedPlaceId: pid };
        }
        return { linkedPlaceId: pid };
      }
    }
    const byTitle = titleToActivityId.get(tKey);
    if (byTitle && mongoose.Types.ObjectId.isValid(byTitle)) {
      return { linkedActivityId: byTitle };
    }
    return {};
  });
}
