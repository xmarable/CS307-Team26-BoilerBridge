import { NextResponse } from "next/server";
import Trip from "@/models/Trip";
import dbConnect from "@/lib/dbConnect";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const mustHaveSchema = z.object({
  name: z.string().min(1).trim(),
  address: z.string().trim().optional(),
});

const updateTripSchema = z.object({
  fromCity: z.string().min(1).optional(),
  toCity: z.string().min(1).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  mode: z.enum(["flight", "train", "bus", "taxi"]).optional(),
  budget: z.coerce.number().optional(),
  tripConfirmed: z.boolean().optional(),
  mustHaves: z.array(mustHaveSchema).optional(),
});

export async function GET(_req, { params }) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tripId } = await params;
    const trip = await Trip.findById(tripId).lean();
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }
    if (trip.userId?.toString() !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const fromDate = trip.fromDate;
    const toDate = trip.toDate;
    return NextResponse.json({
      ...trip,
      _id: trip._id.toString(),
      fromDate: fromDate ? new Date(fromDate).toISOString().slice(0, 10) : null,
      toDate: toDate ? new Date(toDate).toISOString().slice(0, 10) : null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req, { params }) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tripId } = await params;
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }
    if (trip.userId?.toString() !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const result = updateTripSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid input data", details: result.error.flatten() }, { status: 400 });
    }

    const data = result.data;
    if (data.fromCity != null) trip.fromCity = data.fromCity;
    if (data.toCity != null) trip.toCity = data.toCity;
    if (data.fromDate != null) trip.fromDate = new Date(data.fromDate);
    if (data.toDate != null) trip.toDate = new Date(data.toDate);
    if (data.mode != null) trip.mode = data.mode;
    if (data.budget != null) trip.budget = Number(data.budget);
    if (data.tripConfirmed !== undefined) trip.tripConfirmed = data.tripConfirmed;
    if (data.mustHaves !== undefined) trip.mustHaves = data.mustHaves;

    await trip.save();

    return NextResponse.json(trip);
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
