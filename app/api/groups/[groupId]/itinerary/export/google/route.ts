import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import { getMemberPermissions } from "@/lib/roles";
import {
  fetchCalendarEventsForExport,
  parseExportQueryParams,
} from "@/lib/calendarExport";
import { buildGoogleCalendarTemplateUrl } from "@/lib/icalendar";
import type { ICalendarEvent } from "@/models/CalendarEvent";

/**
 * Returns a Google Calendar "template" URL for one event (bulk export: use .ics).
 * Query: same as export/ics plus eventIndex (default 0).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { userId?: string })?.userId;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId } = await params;
    if (!groupId) {
      return NextResponse.json({ error: "Group ID required" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const parsed = parseExportQueryParams(searchParams);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error },
        { status: parsed.status },
      );
    }

    const eventIndexRaw = searchParams.get("eventIndex");
    const eventIndex = Math.max(
      0,
      Number.parseInt(eventIndexRaw ?? "0", 10) || 0,
    );

    await dbConnect();

    const perm = await getMemberPermissions(groupId, userId);
    if (perm.status !== 200) {
      return NextResponse.json(
        { error: perm.error },
        { status: perm.status },
      );
    }

    const events = await fetchCalendarEventsForExport(groupId, parsed.data);
    if (events.length === 0) {
      return NextResponse.json(
        { error: "No events match the selected filters" },
        { status: 404 },
      );
    }
    if (eventIndex >= events.length) {
      return NextResponse.json(
        { error: "No event at this index for the selected filters" },
        { status: 404 },
      );
    }

    const doc = events[eventIndex] as ICalendarEvent;
    const url = buildGoogleCalendarTemplateUrl({
      title: String(doc.title ?? "Event"),
      startTime: new Date(doc.startTime),
      endTime: new Date(doc.endTime),
      description:
        doc.description != null ? String(doc.description) : undefined,
      location: doc.location != null ? String(doc.location) : undefined,
    });

    return NextResponse.json({ url });
  } catch (e) {
    console.error("GET export google:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
