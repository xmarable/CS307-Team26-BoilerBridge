import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import PublicItinerary from "@/models/PublicItinerary";

/** Increments view count when a logged-in user opens the public detail experience. */
export async function POST(
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

    const updated = await PublicItinerary.findOneAndUpdate(
      { _id: publicId, isPublic: true },
      { $inc: { views: 1 } },
      { new: true },
    )
      .select("views")
      .lean();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ views: (updated as { views?: number }).views ?? 0 });
  } catch (err: unknown) {
    console.error("POST /api/itineraries/public/[publicId]/view:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
