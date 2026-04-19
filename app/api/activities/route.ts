import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import Activity from "@/models/Activity";
import { resolvePlaceFieldsForCreate } from "@/lib/travel/googlePlaces";

const ReferenceLinkSchema = z.object({
  title: z.string().min(1).trim(),
  url: z.string().trim().min(1),
});

const CreateActivitySchema = z.object({
  /** Free-text: e.g. "Kayaking in Chicago" — server resolves Google Place ID when configured */
  name: z.string().min(1, "Name is required").trim(),
  /** Optional disambiguation hint; combined with name for Places text search */
  address: z.string().trim().optional(),
  description: z.string().trim().optional(),
  infoUrl: z.string().trim().optional(),
  referenceLinks: z.array(ReferenceLinkSchema).optional(),
  /** Specific vendor / ticket URL only — otherwise US16 uses destination hotel search */
  bookingUrl: z.string().trim().optional(),
  estimatedCost: z.coerce.number().optional(),
});

function safeUrlString(s: string | undefined): string | undefined {
  if (!s?.trim()) return undefined;
  try {
    const u = new URL(s.trim());
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
  } catch {
    /* ignore */
  }
  return undefined;
}

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
          const doc = a as { activityId: string; placeId?: string; name: string; address?: string; rating?: number; reviewCount?: number };
          return {
            activityId: doc.activityId,
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
      const d = doc as { activityId: string; placeId?: string; name: string; address?: string; rating?: number; reviewCount?: number };
      return NextResponse.json({
        activity: {
          activityId: d.activityId,
          placeId: d.placeId,
          name: d.name,
          address: d.address,
          rating: d.rating,
          reviewCount: d.reviewCount ?? 0,
        },
      });
    }

    const doc = activity as { activityId: string; placeId?: string; name: string; address?: string; rating?: number; reviewCount?: number };
    return NextResponse.json({
      activity: {
        activityId: doc.activityId,
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

    const {
      name,
      address,
      description,
      infoUrl,
      referenceLinks,
      bookingUrl,
      estimatedCost,
    } = parsed.data;

    await dbConnect();

    const resolved = await resolvePlaceFieldsForCreate(process.env.GOOGLE_MAPS_API_KEY, {
      name,
      address,
    });

    const mergedAddress = address?.trim() || resolved.address?.trim() || undefined;
    const mergedDescription =
      description?.trim() || resolved.description?.trim() || undefined;
    const mergedInfoUrl =
      safeUrlString(infoUrl) || safeUrlString(resolved.infoUrl) || undefined;
    const mergedPlaceId = resolved.placeId?.trim() || undefined;

    const links: { title: string; url: string }[] =
      referenceLinks
        ?.map((l) => {
          const url = safeUrlString(l.url);
          if (!url) return null;
          return { title: l.title, url };
        })
        .filter((x): x is { title: string; url: string } => x != null) ?? [];

    if (
      resolved.googleMapsUri &&
      !links.some((l) => l.url === resolved.googleMapsUri)
    ) {
      links.push({ title: "Google Maps", url: resolved.googleMapsUri });
    }

    const created = await Activity.create({
      name,
      address: mergedAddress,
      placeId: mergedPlaceId,
      description: mergedDescription,
      infoUrl: mergedInfoUrl,
      referenceLinks: links.length ? links : undefined,
      bookingUrl: safeUrlString(bookingUrl),
      googleMapsUri: safeUrlString(resolved.googleMapsUri),
      googleTypes:
        resolved.googleTypes?.length ? resolved.googleTypes : undefined,
      priceLevel:
        resolved.priceLevel != null ? resolved.priceLevel : undefined,
      phoneNumber: resolved.phoneNumber?.trim() || undefined,
      openingHoursSummary: resolved.openingHoursSummary?.trim() || undefined,
      googlePhotoReference: resolved.googlePhotoReference?.trim() || undefined,
      googlePhotoMediaResource:
        resolved.googlePhotoMediaResource?.trim() || undefined,
      estimatedCost: estimatedCost != null ? estimatedCost : undefined,
      reviewCount: 0,
      reviews: [],
    });

    const doc = created.toObject ? created.toObject() : created;
    const d = doc as { activityId: string; placeId?: string; name: string; address?: string; rating?: number; reviewCount?: number };

    return NextResponse.json(
      {
        activity: {
          activityId: d.activityId,
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
