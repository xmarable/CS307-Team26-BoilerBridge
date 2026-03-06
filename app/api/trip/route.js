import { NextResponse } from "next/server";
import Trip from "@/models/Trip";
import dbConnect from "../../../lib/dbConnect";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const mustHaveSchema = z.object({
  name: z.string().min(1).trim(),
  address: z.string().trim().optional(),
});

const tripSchema = z.object({
    fromCity: z.string().min(1),
    toCity: z.string().min(1),
    fromDate: z.coerce.date(),
    toDate: z.coerce.date(),
    mode: z.enum(["flight", "train", "bus", "taxi"]),
    budget: z.coerce.number(),
    tripConfirmed: z.boolean(),
    mustHaves: z.array(mustHaveSchema).optional().default([]),
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
      const { fromCity, toCity, fromDate, toDate, mode, budget, tripConfirmed, mustHaves } = result.data;

    const trip = await Trip.create({
      userId,
      fromCity,
      toCity,
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
      mode,
      budget: Number(budget),
      tripConfirmed: tripConfirmed ?? false,
      mustHaves: Array.isArray(mustHaves) ? mustHaves : [],
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
