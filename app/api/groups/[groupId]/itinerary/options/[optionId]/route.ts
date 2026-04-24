import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { z } from "zod";

import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import { getMemberPermissions } from "@/lib/roles";
import CalendarEvent from "@/models/CalendarEvent";
import ItineraryOptionVote from "@/models/ItineraryOptionVote";
import Trip from "@/models/Trip";

const PatchBodySchema = z
  .object({
    action: z.literal("dismiss"),
  })
  .optional();

function exclusionStringsFromEvent(ev: {
  title: string;
  location?: string;
  linkedPlaceId?: string;
}): string[] {
  const out: string[] = [];
  const t = ev.title.trim();
  if (t) out.push(t);
  if (ev.linkedPlaceId?.trim()) {
    out.push(ev.linkedPlaceId.trim());
  }
  return out;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; optionId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { userId?: string })?.userId;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId, optionId } = await params;

    if (!mongoose.Types.ObjectId.isValid(optionId)) {
      return NextResponse.json({ error: "Invalid option id" }, { status: 400 });
    }

    await dbConnect();

    const permissionResult = await getMemberPermissions(groupId, userId);
    if ("error" in permissionResult && permissionResult.error) {
      return NextResponse.json(
        { error: permissionResult.error },
        { status: permissionResult.status },
      );
    }
    if (!permissionResult.canEdit) {
      return NextResponse.json(
        { error: "Forbidden: insufficient permissions to dismiss itinerary options" },
        { status: 403 },
      );
    }

    PatchBodySchema.safeParse(await req.json().catch(() => ({})));

    const ev = await CalendarEvent.findOne({
      _id: optionId,
      groupId,
    });

    if (!ev) {
      return NextResponse.json({ error: "Option not found" }, { status: 404 });
    }

    const src = (ev as { source?: string }).source;
    const status = (ev as { itineraryOptionStatus?: string }).itineraryOptionStatus;

    if (src !== "itinerary") {
      return NextResponse.json(
        { error: "Only generator itinerary options can be dismissed via this action." },
        { status: 400 },
      );
    }

    if (status === "final") {
      return NextResponse.json(
        {
          error:
            "This activity is finalized on the calendar and cannot be dismissed as a candidate option.",
        },
        { status: 400 },
      );
    }

    if (status === "removed") {
      return NextResponse.json(
        { error: "This option is already dismissed." },
        { status: 400 },
      );
    }

    const title = String((ev as { title: string }).title);
    const location = (ev as { location?: string }).location;
    const linkedPlaceId = (ev as { linkedPlaceId?: string }).linkedPlaceId;
    const exclusions = exclusionStringsFromEvent({ title, location, linkedPlaceId });

    (ev as { itineraryOptionStatus: string }).itineraryOptionStatus = "removed";
    await ev.save();

    await ItineraryOptionVote.deleteMany({
      groupId,
      optionId,
    } as never);

    if (exclusions.length > 0) {
      const latestTrip = await Trip.findOne({ groupID: groupId as never })
        .sort({ createdAt: -1 })
        .select("_id");
      if (latestTrip) {
        await Trip.updateOne(
          { _id: latestTrip._id },
          { $addToSet: { avoidActivities: { $each: exclusions } } },
        );
      }
    }

    return NextResponse.json({
      ok: true,
      event: {
        _id: String(ev._id),
        itineraryOptionStatus: "removed",
      },
    });
  } catch (err: unknown) {
    console.error("PATCH itinerary option:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Server error", details: message },
      { status: 500 },
    );
  }
}
