import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import Activity from "@/models/Activity";

const CreateActivitySchema = z.object({
  name: z.string().min(1, "Name is required").trim(),
  address: z.string().trim().optional(),
  placeId: z.string().trim().optional(),
});

function serializeId(id: unknown): string {
  if (id && typeof (id as { toString: () => string }).toString === "function") {
    return (id as { toString: () => string }).toString();
  }
  return String(id);
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const rawId = session?.user && "id" in session.user ? (session.user as { id: string }).id : undefined;
    const userId = typeof rawId === "string" ? rawId : undefined;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const placeId = searchParams.get("placeId");
    const name = searchParams.get("name");

    await dbConnect();

    // When placeId is not provided, return list of activities (browse)
    if (!placeId || placeId.trim() === "") {
      const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 100);
      const activities = await Activity.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      return NextResponse.json({
        activities: activities.map((a) => {
          const doc = a as { _id: unknown; placeId?: string; name: string; address?: string; rating?: number; reviewCount?: number };
          return {
            _id: serializeId(doc._id),
            placeId: doc.placeId,
            name: doc.name,
            address: doc.address,
            rating: doc.rating,
            reviewCount: doc.reviewCount ?? 0,
          };
        }),
      });
    }

    const activity = await Activity.findOne({ placeId: placeId.trim() }).lean();

    if (!activity) {
      const created = await Activity.create({
        placeId: placeId.trim(),
        name: (name && name.trim()) || "Unknown Place",
        reviewCount: 0,
        reviews: [],
      });
      const doc = created.toObject ? created.toObject() : created;
      const d = doc as { _id: unknown; placeId?: string; name: string; address?: string; rating?: number; reviewCount?: number };
      return NextResponse.json({
        activity: {
          _id: serializeId(d._id),
          placeId: d.placeId,
          name: d.name,
          address: d.address,
          rating: d.rating,
          reviewCount: d.reviewCount ?? 0,
        },
      });
    }

    const doc = activity as { _id: unknown; placeId?: string; name: string; address?: string; rating?: number; reviewCount?: number };
    return NextResponse.json({
      activity: {
        _id: serializeId(doc._id),
        placeId: doc.placeId,
        name: doc.name,
        address: doc.address,
        rating: doc.rating,
        reviewCount: doc.reviewCount ?? 0,
      },
    });
  } catch (err: unknown) {
    console.error("GET activities error:", err);
    return NextResponse.json(
      {
        error: "Server error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const rawId = session?.user && "id" in session.user ? (session.user as { id: string }).id : undefined;
    const userId = typeof rawId === "string" ? rawId : undefined;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CreateActivitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, address, placeId } = parsed.data;

    await dbConnect();

    const created = await Activity.create({
      name,
      address: address || undefined,
      placeId: placeId || undefined,
      reviewCount: 0,
      reviews: [],
    });

    const doc = created.toObject ? created.toObject() : created;
    const d = doc as { _id: unknown; placeId?: string; name: string; address?: string; rating?: number; reviewCount?: number };

    return NextResponse.json(
      {
        activity: {
          _id: serializeId(d._id),
          placeId: d.placeId,
          name: d.name,
          address: d.address,
          rating: d.rating,
          reviewCount: d.reviewCount ?? 0,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("POST activities error:", err);
    return NextResponse.json(
      {
        error: "Server error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
