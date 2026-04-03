import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import Activity from "@/models/Activity";

function serializeId(id: unknown): string {
  if (id && typeof (id as { toString: () => string }).toString === "function") {
    return (id as { toString: () => string }).toString();
  }
  return String(id);
}

/**
 * GET /api/activities/[activityId]
 * US15: Full activity details for the Activity Information page.
 * US16: Includes bookingUrl when present.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ activityId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const rawId =
      session?.user && "id" in session.user
        ? (session.user as { id: string }).id
        : undefined;
    const userId = typeof rawId === "string" ? rawId : undefined;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { activityId } = await params;
    if (!activityId || !mongoose.Types.ObjectId.isValid(activityId)) {
      return NextResponse.json({ error: "Invalid activity ID" }, { status: 400 });
    }

    await dbConnect();

    const activity = await Activity.findById(activityId).lean();
    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const a = activity as {
      _id: unknown;
      placeId?: string;
      name: string;
      address?: string;
      rating?: number;
      reviewCount?: number;
      estimatedCost?: number;
      infoUrl?: string;
      description?: string;
      referenceLinks?: { title: string; url: string }[];
      bookingUrl?: string;
    };

    return NextResponse.json({
      activity: {
        _id: serializeId(a._id),
        placeId: a.placeId,
        name: a.name,
        address: a.address,
        rating: a.rating ?? null,
        reviewCount: a.reviewCount ?? 0,
        estimatedCost: a.estimatedCost,
        infoUrl: a.infoUrl,
        description: a.description,
        referenceLinks: Array.isArray(a.referenceLinks) ? a.referenceLinks : [],
        bookingUrl: a.bookingUrl,
      },
    });
  } catch (err: unknown) {
    console.error("GET /api/activities/[activityId] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
