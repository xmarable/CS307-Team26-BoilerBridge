import { NextResponse } from "next/server";
import Trip from "@/models/Trip";
import dbConnect from "../../../lib/dbConnect";

export async function POST(req) {
  try {
    await dbConnect();

    // TEMP AUTH for Postman:
    // Send header: x-user-id: <Mongo ObjectId of an existing user>
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: missing x-user-id header" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { fromCity, toCity, fromDate, toDate, mode, budget, tripConfirmed } = body;

    // minimal validation
    if (!fromCity || !toCity || !fromDate || !toDate || !mode || budget == null) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const trip = await Trip.create({
      userId, // IMPORTANT: take from header, not from body
      fromCity,
      toCity,
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
      mode,
      budget: Number(budget),
      tripConfirmed: tripConfirmed ?? false,
    });

    return NextResponse.json(trip, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  try {
    await dbConnect();

    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: missing x-user-id header" },
        { status: 401 }
      );
    }

    const trips = await Trip.find({ userId }).sort({ createdAt: -1 });
    return NextResponse.json(trips, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}