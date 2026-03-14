import { NextResponse } from "next/server";
import Trip from "@/models/Trip";
import dbConnect from "../../../lib/dbConnect";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const tripSchema = z.object({
  fromCity: z.string().min(1),
  toCity: z.string().min(1),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  mode: z.enum(["flight", "train", "bus", "taxi"]),
  budget: z.coerce.number().positive("Budget must be a positive number."),
  tripConfirmed: z.boolean().optional(),
});

export async function POST(req) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    const userId = session?.user?.userId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Validate using zod;
    const result = tripSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "Invalid input data" },
        { status: 400 },
      );
    } else {
      const {
        fromCity,
        toCity,
        fromDate,
        toDate,
        mode,
        budget,
        tripConfirmed,
      } = result.data;

      const trip = await Trip.create({
        userId, // Mongoose handles string to Binary UUID conversion
        fromCity,
        toCity,
        fromDate: new Date(fromDate),
        toDate: new Date(toDate),
        mode,
        budget: Number(budget),
        tripConfirmed: tripConfirmed ?? false,
      });

      return NextResponse.json(
        {
          tripID: trip.tripID.toString(),
          userId: trip.userId.toString(),
          fromCity: trip.fromCity,
          toCity: trip.toCity,
          fromDate: trip.fromDate,
          toDate: trip.toDate,
          mode: trip.mode,
          budget: trip.budget,
          tripConfirmed: trip.tripConfirmed,
        },
        { status: 201 },
      );
    }
  } catch (err) {
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

    // Query using the userId string
    const trips = await Trip.find({ userId }).sort({ createdAt: -1 }).lean();

    const payload = trips.map((t) => ({
      tripID: t.tripID.toString(),
      userId: t.userId.toString(),
      fromCity: t.fromCity,
      toCity: t.toCity,
      fromDate: t.fromDate,
      toDate: t.toDate,
      mode: t.mode,
      budget: t.budget,
      tripConfirmed: t.tripConfirmed,
    }));

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("GET /api/trip error:", err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 },
    );
  }
}
