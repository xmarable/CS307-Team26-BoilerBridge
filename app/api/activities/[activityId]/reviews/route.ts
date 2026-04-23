import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { z } from "zod";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import Activity from "@/models/Activity";
import { randomUUID } from "crypto";

const PostReviewSchema = z.object({
  text: z.string().min(1, "Review text is required").trim().max(2000),
  rating: z.number().int().min(1).max(5),
});


export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ activityId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any).userId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { activityId } = await params;
    await dbConnect();

    const activity = await Activity.findOne({ activityId: activityId });
    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const reviews = activity.reviews ?? [];
    const rating = activity.rating ?? null;
    const reviewCount = activity.reviewCount ?? 0;
    const name = activity.name ?? "Unknown Place";

    return NextResponse.json({
      reviews,
      rating,
      reviewCount,
      name,
    });
  } catch (err: unknown) {
    console.error("GET activities reviews error:", err);
    return NextResponse.json(
      {
        error: "Server error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ activityId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any).userId;
    const displayName =
      (session?.user as { name?: string; username?: string })?.name ||
      (session?.user as { username?: string })?.username ||
      "Anonymous";

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { activityId } = await params;
    const body = await req.json();
    const parsed = PostReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await dbConnect();

    const activity = await Activity.findOne({ activityId: activityId });
    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const { text, rating } = parsed.data;
    const newReview = {
      reviewId: randomUUID(),
      authorId: userId,
      author: displayName,
      text,
      rating,
      time: new Date(),
    };

    activity.reviews = activity.reviews ?? [];
    activity.reviews.push(newReview);
    activity.reviewCount = activity.reviews.length;
    const sum = activity.reviews.reduce((a, r) => a + r.rating, 0);
    activity.rating = sum / activity.reviews.length;
    activity.summaryCachedAt = undefined;
    activity.sentimentSummary = undefined;
    activity.highlights = undefined;
    activity.pros = undefined;
    activity.cons = undefined;
    await activity.save();

    return NextResponse.json(
      { review: newReview, rating: activity.rating, reviewCount: activity.reviewCount },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("POST activities reviews error:", err);
    return NextResponse.json(
      {
        error: "Server error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

const ReviewDeleteSchema = z.object({
  reviewId: z.string().min(1)
})

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ activityId: string }>}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauathorized" }, { status: 401 });
  }

  const userId = session.user.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauathorized" }, { status: 401 });
  }

  const { activityId } = await params;
  const activity = await Activity.findOne({ activityId: activityId });
  if (!activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 400 });
  }

  const body = await req.json();
  const request = ReviewDeleteSchema.safeParse(body);
  if (!request.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  activity.reviews = activity.reviews.filter((i) => i.reviewId != request.data.reviewId);
  await activity.save();

  return NextResponse.json({ message: "Success" }, { status: 200 });
}