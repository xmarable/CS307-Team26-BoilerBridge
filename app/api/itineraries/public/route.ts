import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import PublicItinerary from "@/models/PublicItinerary";
import User from "@/models/User";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  sort: z.enum(["latest", "popular"]).default("latest"),
});

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid query" },
        { status: 400 },
      );
    }

    const { page, limit, sort } = parsed.data;
    const skip = (page - 1) * limit;
    const sortKey: Record<string, 1 | -1> =
      sort === "popular"
        ? { views: -1, publishedAt: -1 }
        : { publishedAt: -1 };

    const filter = { isPublic: true };

    const [total, docs] = await Promise.all([
      PublicItinerary.countDocuments(filter),
      PublicItinerary.find(filter)
        .sort(sortKey)
        .skip(skip)
        .limit(limit)
        .select(
          "ownerId title subtitle views publishedAt sourceType sourceId likes",
        )
        .lean(),
    ]);

    const ownerIds = [...new Set(docs.map((d) => String(d.ownerId)))];
    const users = await User.find({ userId: { $in: ownerIds } as never })
      .select("userId username name")
      .lean();
    const nameByUserId = new Map(
      users.map((u) => [
        String(u.userId),
        (u as { name?: string; username?: string }).name ||
          (u as { username?: string }).username ||
          "Traveler",
      ]),
    );

    const items = docs.map((d) => ({
      publicItineraryId: d._id.toString(),
      title: d.title,
      subtitle: d.subtitle ?? "",
      views: d.views ?? 0,
      likes: d.likes ?? 0,
      publishedAt: d.publishedAt,
      sourceType: d.sourceType,
      sourceId: d.sourceId,
      ownerUsername: nameByUserId.get(String(d.ownerId)) ?? "Traveler",
    }));

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      hasMore: skip + items.length < total,
    });
  } catch (err: unknown) {
    console.error("GET /api/itineraries/public:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
