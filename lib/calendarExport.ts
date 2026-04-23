import CalendarEvent from "@/models/CalendarEvent";

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
