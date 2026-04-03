import { NextRequest, NextResponse } from "next/server";
import Trip from "@/models/Trip";
import dbConnect from "@/lib/dbConnect";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { getMemberPermissions } from "@/lib/roles";
import { generateRainyDayPlan } from "@/lib/rainyDayEngine";

const createInitialItinerary = (fromDate: Date, toDate: Date) => {
  const MOCK_ACTIVITIES = [
    { name: "Morning Park Walk", category: "Nature", isOutdoor: true },
    { name: "Downtown Sightseeing", category: "Tourism", isOutdoor: true },
    { name: "Visit Local Museum", category: "Culture", isOutdoor: false },
    { name: "Beach Hangout", category: "Leisure", isOutdoor: true },
  ];

  const days =
    Math.ceil(
      (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24),
    ) || 1;

  const primary = Array.from({ length: days }).map((_, i) => {
    const activity = MOCK_ACTIVITIES[i % MOCK_ACTIVITIES.length];
    const date = new Date(fromDate);
    date.setDate(date.getDate() + i);

    return {
      ...activity,
      activityId: `mock-${i}`,
      startTime: new Date(date.setHours(10, 0)),
      endTime: new Date(date.setHours(12, 0)),
    };
  });

  const rainyDay = generateRainyDayPlan(primary);
  return { primary, rainyDay };
};

const tripSchema = z.object({
  // changed to accept groupId from frontend while keeping UUID validation
  groupId: z.string().uuid().optional(),
  groupID: z.string().uuid().optional(),
  fromCity: z.string().min(1),
  toCity: z.string().min(1),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  mode: z.enum(["flight", "train", "bus", "taxi"]),
  budget: z.coerce.number().positive("Budget must be a positive number."),
  tripConfirmed: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    const userId = session?.user?.userId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const result = tripSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "Invalid input data" },
        { status: 400 },
      );
    }

    // logic: Normalize the ID from either groupId or groupID to match the model
    const groupID = result.data.groupID || result.data.groupId;

    if (!groupID) {
      return NextResponse.json(
        { error: "Group ID is required" },
        { status: 400 },
      );
    }

    const fromCity = result.data.fromCity;
    const toCity = result.data.toCity;
    const fromDate = result.data.fromDate;
    const toDate = result.data.toDate;
    const mode = result.data.mode;
    const budget = result.data.budget;
    const tripConfirmed = result.data.tripConfirmed;

    const permissionResult = (await getMemberPermissions(
      groupID,
      userId,
    )) as any;

    if (permissionResult.error) {
      return NextResponse.json(
        { error: permissionResult.error },
        { status: permissionResult.status },
      );
    }

    if (!permissionResult.canEdit) {
      return NextResponse.json(
        { error: "Forbidden: Viewers cannot add to the itinerary" },
        { status: 403 },
      );
    }

    const { primary, rainyDay } = createInitialItinerary(
      new Date(fromDate),
      new Date(toDate),
    );

    const trip = await Trip.create({
      userId,
      groupID,
      fromCity,
      toCity,
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
      mode,
      budget: Number(budget),
      tripConfirmed: tripConfirmed ?? false,
      primaryItinerary: primary,
      rainyDayItinerary: rainyDay,
    });

    return NextResponse.json(
      {
        tripID: trip._id.toString(),
        userId: trip.userId.toString(),
        groupID: trip.groupID.toString(),
        fromCity: trip.fromCity,
        toCity: trip.toCity,
        fromDate: trip.fromDate,
        toDate: trip.toDate,
        mode: trip.mode,
        budget: trip.budget,
        tripConfirmed: trip.tripConfirmed,
        primaryItinerary: trip.primaryItinerary,
        rainyDayItinerary: trip.rainyDayItinerary,
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error("POST /api/trip error:", err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    const userId = session?.user?.userId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trips = await Trip.find({ userId }).sort({ createdAt: -1 }).lean();

    const payload = trips.map((t: any) => ({
      tripID: t._id.toString(),
      userId: t.userId.toString(),
      groupID: t.groupID?.toString(),
      fromCity: t.fromCity,
      toCity: t.toCity,
      fromDate: t.fromDate,
      toDate: t.toDate,
      mode: t.mode,
      budget: t.budget,
      tripConfirmed: t.tripConfirmed,
      primaryItinerary: t.primaryItinerary,
      rainyDayItinerary: t.rainyDayItinerary,
    }));

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/trip error:", err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 },
    );
  }
}
