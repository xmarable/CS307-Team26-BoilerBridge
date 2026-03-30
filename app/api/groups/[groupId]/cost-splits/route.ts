import { NextRequest, NextResponse } from "next/server";
import CostSplit from "@/models/CostSplit";
import dbConnect from "@/lib/dbConnect";

/*
GET /api/groups/:groupId/cost-splits
Fetch cost splits for a group
Supports optional filters:
?tripId=
?expenseId=
*/

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    await dbConnect();

    const { groupId } = await context.params;
    const { searchParams } = new URL(req.url);

    const tripId = searchParams.get("tripId");
    const expenseId = searchParams.get("expenseId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {
      groupId: groupId,
    };

    if (tripId) query.tripId = tripId;
    if (expenseId) query.expenseId = expenseId;

    const splits = await CostSplit.find(query).sort({ createdAt: -1 });

    return NextResponse.json({ costSplits: splits }, { status: 200 });
  } catch (error) {
    console.error("GET cost-splits error:", error);

    return NextResponse.json(
      { error: "Failed to fetch cost splits" },
      { status: 500 },
    );
  }
}

/*
POST /api/groups/:groupId/cost-splits
Create a cost split for an expense
*/

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    await dbConnect();

    const { groupId } = await context.params;
    const body = await req.json();

    const {
      tripId,
      expenseId,
      participants,
      splitType,
      totalAmount,
      createdBy,
    } = body;

    if (!expenseId) {
      return NextResponse.json(
        { error: "expenseId is required" },
        { status: 400 },
      );
    }

    if (!participants || participants.length === 0) {
      return NextResponse.json(
        { error: "participants are required" },
        { status: 400 },
      );
    }

    if (!splitType) {
      return NextResponse.json(
        { error: "splitType is required" },
        { status: 400 },
      );
    }

    if (!totalAmount || totalAmount <= 0) {
      return NextResponse.json(
        { error: "totalAmount must be greater than 0" },
        { status: 400 },
      );
    }

    const newSplit = await CostSplit.create({
      groupId: groupId,
      tripId,
      expenseId,
      participants,
      splitType,
      totalAmount,
      createdBy,
    });

    return NextResponse.json({ costSplit: newSplit }, { status: 201 });
  } catch (error) {
    console.error("POST cost-split error:", error);

    return NextResponse.json(
      { error: "Failed to create cost split" },
      { status: 500 },
    );
  }
}
