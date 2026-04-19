import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import Activity from "@/models/Activity";
import { computeReviewSummary } from "@/lib/reviewSummary";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ activityId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const rawId = session?.user && "id" in session.user ? (session.user as { id: string }).id : undefined;
    const userId = typeof rawId === "string" ? rawId : undefined;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { activityId } = await params
    await dbConnect();

    const activity = await Activity.findOne({ activityId: activityId });
    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const reviews = activity.reviews ?? [];
    const cachedAt = activity.summaryCachedAt ? new Date(activity.summaryCachedAt).getTime() : 0;
    const now = Date.now();
    const cacheValid = cachedAt > 0 && now - cachedAt < CACHE_TTL_MS;

    if (
      cacheValid &&
      activity.sentimentSummary != null &&
      Array.isArray(activity.highlights)
    ) {
      return NextResponse.json({
        summary: {
          averageRating: activity.rating ?? 0,
          sentimentSummary: activity.sentimentSummary,
          highlights: activity.highlights ?? [],
          pros: activity.pros ?? [],
          cons: activity.cons ?? [],
        },
        cached: true,
      });
    }

    const computed = computeReviewSummary(reviews);
    if (!computed) {
      return NextResponse.json({
        summary: null,
        message: "No reviews to summarize.",
      });
    }

    activity.rating = computed.averageRating;
    activity.sentimentSummary = computed.sentimentSummary;
    activity.highlights = computed.highlights;
    activity.pros = computed.pros;
    activity.cons = computed.cons;
    activity.summaryCachedAt = new Date();
    await activity.save();

    return NextResponse.json({
      summary: computed,
      cached: false,
    });
  } catch (err: unknown) {
    console.error("GET review-summary error:", err);
    return NextResponse.json(
      {
        error: "Server error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
