import { NextRequest, NextResponse } from "next/server";
import Trip from "@/models/Trip";
import MustHave from "@/models/MustHave";
import dbConnect from "@/lib/dbConnect";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { getMemberPermissions } from "@/lib/roles";
import { generateRainyDayPlan } from "@/lib/rainyDayEngine";

type ItineraryActivityInput = {
  activityId: string;
  name: string;
  startTime: Date;
  endTime: Date;
  isOutdoor?: boolean;
  category?: string;
  location?: string;
};

const createInitialItinerary = async (
  fromDate: Date,
  toDate: Date,
  rainyDayItinerary?: ItineraryActivityInput[],
) => {
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

  const rainyDay =
    rainyDayItinerary && rainyDayItinerary.length > 0
      ? rainyDayItinerary
      : await generateRainyDayPlan(primary);
  return { primary, rainyDay };
};

const itineraryActivitySchema = z.object({
  activityId: z.string().min(1),
  name: z.string().min(1),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  isOutdoor: z.boolean().optional(),
  category: z.string().optional(),
  location: z.string().optional(),
});

const rainyDayItinerarySchema = z
  .array(itineraryActivitySchema.partial())
  .optional();

function sanitizeRainyDayItinerary(
  rainyDayItinerary?: Array<Partial<ItineraryActivityInput>>,
): ItineraryActivityInput[] {
  if (!Array.isArray(rainyDayItinerary)) return [];
  return rainyDayItinerary
    .map((item) => itineraryActivitySchema.safeParse(item))
    .filter((parsed) => parsed.success)
    .map((parsed) => parsed.data);
}

const tripSchema = z.object({
  groupId: z.string().uuid().optional(),
  groupID: z.string().uuid().optional(),
  fromCity: z.string().min(1),
  toCity: z.string().min(1),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  mode: z.enum(["flight", "train", "bus", "taxi"]),
  budget: z.coerce.number().positive("Budget must be a positive number."),
  tripConfirmed: z.boolean().optional(),
  avoidActivities: z.array(z.string()).optional(),
  avoidLocations: z.array(z.string()).optional(),
  budgetMin: z.coerce.number().optional(),
  budgetMax: z.coerce.number().optional(),
  mustHaves: z
    .array(
      z.object({
        name: z.string().min(1),
        address: z.string().optional(),
      }),
    )
    .optional(),
  rainyDayItinerary: rainyDayItinerarySchema,
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

    const groupID = result.data.groupID || result.data.groupId;

    if (!groupID) {
      return NextResponse.json(
        { error: "Group ID is required" },
        { status: 400 },
      );
    }

    const {
      fromCity,
      toCity,
      fromDate,
      toDate,
      mode,
      budget,
      tripConfirmed,
      avoidActivities,
      avoidLocations,
      budgetMin,
      budgetMax,
      mustHaves,
      rainyDayItinerary,
    } = result.data;

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

    const sanitizedRainyDayItinerary =
      sanitizeRainyDayItinerary(rainyDayItinerary);
    const { primary, rainyDay } = await createInitialItinerary(
      new Date(fromDate),
      new Date(toDate),
      sanitizedRainyDayItinerary,
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
      ...(avoidActivities != null && { avoidActivities }),
      ...(avoidLocations != null && { avoidLocations }),
      ...(budgetMin != null && { budgetMin }),
      ...(budgetMax != null && { budgetMax }),
    });

    const sanitizedMustHaves =
      mustHaves
        ?.map((item) => ({
          name: item.name.trim(),
          address: item.address?.trim() || undefined,
        }))
        .filter((item) => item.name.length > 0) ?? [];

    if (sanitizedMustHaves.length > 0) {
      await MustHave.insertMany(
        sanitizedMustHaves.map((item) => ({
          groupId: groupID,
          name: item.name,
          address: item.address,
          addedBy: userId,
          status: "approved" as const,
          priority: 3,
        })),
      );
    }

    const t = trip as Record<string, unknown>;
    return NextResponse.json(
      {
        tripID: t._id?.toString(),
        userId: t.userId?.toString(),
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
        avoidActivities: t.avoidActivities ?? [],
        avoidLocations: t.avoidLocations ?? [],
        budgetMin: t.budgetMin,
        budgetMax: t.budgetMax,
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

    const payload = trips.map((t: Record<string, unknown>) => ({
      tripID: t._id?.toString(),
      userId: t.userId?.toString(),
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
      avoidActivities: t.avoidActivities ?? [],
      avoidLocations: t.avoidLocations ?? [],
      budgetMin: t.budgetMin,
      budgetMax: t.budgetMax,
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
