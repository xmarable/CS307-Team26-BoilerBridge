import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import PublicItinerary from "@/models/PublicItinerary";
import User from "@/models/User";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ publicId: string }> },
) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { publicId } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(publicId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const doc = await PublicItinerary.findById(publicId).lean();
    if (!doc || !doc.isPublic) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const viewerId = String(session.user.userId);
    const owner = await User.findOne({ userId: doc.ownerId })
      .select("username name userId")
      .lean();
    const ownerUsername =
      (owner as { name?: string; username?: string } | null)?.name ||
      (owner as { username?: string } | null)?.username ||
      "Traveler";

    const d = doc as Record<string, unknown>;
    return NextResponse.json({
      publicItineraryId: (d._id as mongoose.Types.ObjectId).toString(),
      title: d.title,
      subtitle: d.subtitle ?? "",
      views: d.views ?? 0,
      likes: d.likes ?? 0,
      publishedAt: d.publishedAt,
      sourceType: d.sourceType,
      sourceId: d.sourceId,
      snapshot: d.snapshot,
      ownerId: String(d.ownerId),
      ownerUsername,
      isOwner: String(d.ownerId) === viewerId,
    });
  } catch (err: unknown) {
    console.error("GET /api/itineraries/public/[publicId]:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
