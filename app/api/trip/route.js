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
    budget: z.coerce.number(),
    tripConfirmed: z.boolean()
});

export async function POST(req) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await req.json();

    // Validate using zod;
    const result = tripSchema.safeParse(body);

    if(!result.success){
      return NextResponse.json({ error: "Invalid input data" }, { status: 400 });
    }
    else{
      const { fromCity, toCity, fromDate, toDate, mode, budget, tripConfirmed } = result.data;

    const trip = await Trip.create({
      userId,
      fromCity,
      toCity,
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
      mode,
      budget: Number(budget),
      tripConfirmed: tripConfirmed ?? false,
    });

    return NextResponse.json(trip, { status: 201 });
    }

  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const trips = await Trip.find({ userId }).sort({ createdAt: -1 });
    return NextResponse.json(trips, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}