/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";

import TravelGroup from "@/models/TravelGroup";
import MustHave from "@/models/MustHave";

function isMemberOrLeader(group: any, userId: string) {
  const leader = group?.leaderID?.toString() === userId;
  const member =
    Array.isArray(group?.membersList) &&
    group.membersList.some((m: any) => m.userId?.toString() === userId);
  return leader || member;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const CreateMustHaveSchema = z.object({
  tripId: z.string().optional(),
  placeId: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  category: z.string().optional(),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  notes: z.string().optional(),
  priority: z.number().int().min(1).max(5).optional(),
  status: z.enum(["proposed", "approved", "rejected"]).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId } = await params;
    if (!groupId) {
      return NextResponse.json({ error: "Invalid group ID" }, { status: 400 });
    }

    await dbConnect();

    const group: any = await TravelGroup.findOne({ groupID: groupId }).lean();
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    if (!isMemberOrLeader(group, userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = CreateMustHaveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;

    const dedupOr: any[] = [];

    if (data.placeId) {
      dedupOr.push({ placeId: data.placeId });
    }

    if (data.name && data.address) {
      const nameRe = new RegExp(`^${escapeRegex(data.name.trim())}$`, "i");
      const addressRe = new RegExp(
        `^${escapeRegex(data.address.trim())}$`,
        "i",
      );
      dedupOr.push({ name: nameRe, address: addressRe });
    }

    if (dedupOr.length > 0) {
      // Cast the entire filter object to any to bypass the UUID type check
      const filter: any = {
        groupId: groupId,
        $or: dedupOr,
      };

      const existing = await MustHave.findOne(filter).lean();

      if (existing) {
        return NextResponse.json(
          { error: "Duplicate must-have", duplicateOf: existing },
          { status: 409 },
        );
      }
    }

    // Cast the creation object to any to satisfy the Mongoose create overload
    const newMustHaveData: any = {
      groupId: groupId,
      tripId: data.tripId,
      placeId: data.placeId,
      name: data.name,
      category: data.category,
      address: data.address,
      lat: data.lat,
      lng: data.lng,
      notes: data.notes,
      priority: data.priority ?? 3,
      addedBy: userId,
      status: data.status ?? "proposed",
    };

    const created = await MustHave.create(newMustHaveData);

    // Cast to any before calling toObject to resolve 'never' type error
    const createdObj = (created as any).toObject();

    return NextResponse.json(
      {
        mustHave: {
          ...createdObj,
          id: createdObj.id?.toString(),
          groupId: createdObj.groupId?.toString(),
          tripId: createdObj.tripId?.toString(),
          addedBy: createdObj.addedBy?.toString(),
        },
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error("POST must-haves error:", err);
    return NextResponse.json(
      { error: "Server error", details: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId } = await params;
    if (!groupId) {
      return NextResponse.json({ error: "Invalid group ID" }, { status: 400 });
    }

    await dbConnect();

    const group: any = await TravelGroup.findOne({ groupID: groupId }).lean();
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    if (!isMemberOrLeader(group, userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const priority = searchParams.get("priority");
    const tripId = searchParams.get("tripId");

    // Use any cast for query object
    const query: any = { groupId: groupId };

    if (tripId) query.tripId = tripId;

    if (status && ["proposed", "approved", "rejected"].includes(status)) {
      query.status = status;
    }
    if (category) query.category = category;
    if (priority && !Number.isNaN(Number(priority))) {
      query.priority = Number(priority);
    }

    const items = await MustHave.find(query).sort({ createdAt: -1 }).lean();

    const payload = items.map((item: any) => ({
      ...item,
      id: item.id?.toString(),
      groupId: item.groupId?.toString(),
      tripId: item.tripId?.toString(),
      addedBy: item.addedBy?.toString(),
    }));

    return NextResponse.json({ mustHaves: payload }, { status: 200 });
  } catch (err: any) {
    console.error("GET must-haves error:", err);
    return NextResponse.json(
      { error: "Server error", details: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
