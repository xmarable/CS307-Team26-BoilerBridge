import { randomUUID } from "crypto";

import type { ProposedEventInput } from "@/lib/itinerary/schemas";
import { isTravelLikeEvent } from "@/lib/itinerary/travelHeuristics";
import { zonedDayKey } from "@/lib/itinerary/zonedWallClock";

function participates(ev: ProposedEventInput): boolean {
  return !isTravelLikeEvent(ev);
}

class UnionFind {
  private p: number[];
  constructor(n: number) {
    this.p = Array.from({ length: n }, (_, i) => i);
  }
  find(i: number): number {
    if (this.p[i] !== i) this.p[i] = this.find(this.p[i]);
    return this.p[i];
  }
  union(a: number, b: number) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.p[ra] = rb;
  }
}

function overlaps(
  a: ProposedEventInput,
  b: ProposedEventInput,
): boolean {
  return a.startTime < b.endTime && a.endTime > b.startTime;
}

/**
 * Assigns one UUID per cluster of overlapping, same-day (in event TZ) non-travel
 * activities. Travel/transit blocks get no group id (empty string).
 */
export function assignOptionGroupIds(events: ProposedEventInput[]): string[] {
  const n = events.length;
  const uf = new UnionFind(n);
  const tzFor = (i: number) => events[i]!.timezone?.trim() || "UTC";

  for (let i = 0; i < n; i++) {
    if (!participates(events[i]!)) continue;
    const dayI = zonedDayKey(events[i]!.startTime, tzFor(i));
    for (let j = i + 1; j < n; j++) {
      if (!participates(events[j]!)) continue;
      const dayJ = zonedDayKey(events[j]!.startTime, tzFor(j));
      if (dayI !== dayJ) continue;
      if (overlaps(events[i]!, events[j]!)) {
        uf.union(i, j);
      }
    }
  }

  const rootToId = new Map<number, string>();
  const out: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (!participates(events[i]!)) {
      out[i] = "";
      continue;
    }
    const r = uf.find(i);
    let gid = rootToId.get(r);
    if (!gid) {
      gid = randomUUID();
      rootToId.set(r, gid);
    }
    out[i] = gid;
  }
  return out;
}
