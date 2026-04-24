import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";
import { getMemberPermissions } from "@/lib/roles";
import {
  fetchCalendarEventsForExport,
  parseExportQueryParams,
} from "@/lib/calendarExport";
import {
  buildVCalendar,
  slugifyGroupFilename,
  type IcsEventInput,
} from "@/lib/icalendar";
import type { ICalendarEvent } from "@/models/CalendarEvent";

/**
 * iCalendar (.ics) export for group timeline events.
 * Auth: session (group member) OR ?token= matching TravelGroup.calendarExportToken
 *
 * Query: from, to (ISO), includeManual, includeItinerary (default true; use false to exclude)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await params;
    if (!groupId) {
      return NextResponse.json({ error: "Group ID required" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    const parsed = parseExportQueryParams(searchParams);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error },
        { status: parsed.status },
      );
    }

    await dbConnect();

    let group: Awaited<ReturnType<typeof TravelGroup.findOne>>;

    if (token) {
      group = await TravelGroup.findOne({
        groupID: groupId,
        calendarExportToken: token,
      });
      if (!group) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      const session = await getServerSession(authOptions);
      const userId = (session?.user as { userId?: string })?.userId;
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const perm = await getMemberPermissions(groupId, userId);
      if (perm.status !== 200) {
        return NextResponse.json(
          { error: perm.error },
          { status: perm.status },
        );
      }
      group = perm.group;
    }

    const raw = await fetchCalendarEventsForExport(groupId, parsed.data);

    const inputs: IcsEventInput[] = raw.map((doc: ICalendarEvent) => ({
      uid: `${String(doc.eventID)}@boilerbridge.local`,
      startTime: new Date(doc.startTime),
      endTime: new Date(doc.endTime),
      summary: String(doc.title ?? "Event"),
      description:
        doc.description != null ? String(doc.description) : undefined,
      location: doc.location != null ? String(doc.location) : undefined,
    }));

    const ics = buildVCalendar(inputs);
    const safeName = slugifyGroupFilename(
      String(group.groupName ?? "group"),
    );
    const filename = `boilerbridge-${safeName}.ics`;

    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (e) {
    console.error("GET export ics:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
