/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import CostSplit from "@/models/CostSplit";
import TravelGroup from "@/models/TravelGroup";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import {
  calculateEqualSplit,
  applyPercentageSplit,
  validateCustomAmountSplit,
  validateCustomPercentageSplit,
} from "@/lib/splitCalculator";

function getSessionUserIds(session: any): string[] {
  return [session?.user?.userId, session?.user?.id].filter(Boolean);
}

function isGroupLeaderOrAdmin(group: any, userIds: string[]) {
  if (userIds.includes(group?.leaderID?.toString())) return true;
  return (
    Array.isArray(group?.membersList) &&
    group.membersList.some(
      (m: any) => userIds.includes(m.userId?.toString()) && m.role === "Admin",
    )
  );
}

function isGroupMember(group: any, userIds: string[]) {
  if (!Array.isArray(group?.membersList)) return false;
  return group.membersList.some((m: any) =>
    userIds.includes(m.userId?.toString()),
  );
}

function allParticipantsValid(participantIds: string[], group: any) {
  const validIds = new Set<string>(
    [
      ...(Array.isArray(group?.membersList)
        ? group.membersList.map((m: any) => m.userId?.toString())
        : []),
      group?.leaderID?.toString(),
    ].filter(Boolean),
  );
  return participantIds.every((id) => validIds.has(id));
}

/*
  GET /api/groups/:groupId/cost-splits
  Fetch cost splits for a group. Supports ?tripId= and ?expenseId= filters.
*/
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    await dbConnect();
    const { groupId } = await context.params;

    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userIds = getSessionUserIds(session);
    if (userIds.length === 0)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const group = await TravelGroup.findOne({ groupID: groupId });
    if (!group)
      return NextResponse.json({ error: "Group not found" }, { status: 404 });

    if (!isGroupMember(group, userIds) && !isGroupLeaderOrAdmin(group, userIds))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const tripId = searchParams.get("tripId");
    const expenseId = searchParams.get("expenseId");

    const query: any = { groupId };
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
  Create a cost split for an expense with validation.
*/
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    await dbConnect();
    const { groupId } = await context.params;

    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userIds = getSessionUserIds(session);
    if (userIds.length === 0)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const group = await TravelGroup.findOne({ groupID: groupId });
    if (!group)
      return NextResponse.json({ error: "Group not found" }, { status: 404 });

    if (!isGroupMember(group, userIds) && !isGroupLeaderOrAdmin(group, userIds))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { tripId, expenseId, participants, splitType, totalAmount } = body;

    // Required field validation
    if (!expenseId)
      return NextResponse.json(
        { error: "expenseId is required" },
        { status: 400 },
      );

    if (!Array.isArray(participants) || participants.length === 0)
      return NextResponse.json(
        { error: "participants must be a non-empty array" },
        { status: 400 },
      );

    const validSplitTypes = ["equal", "custom-amount", "custom-percentage"];
    if (!splitType || !validSplitTypes.includes(splitType))
      return NextResponse.json(
        {
          error:
            "splitType must be one of: equal, custom-amount, custom-percentage",
        },
        { status: 400 },
      );

    if (!totalAmount || typeof totalAmount !== "number" || totalAmount <= 0)
      return NextResponse.json(
        { error: "totalAmount must be a positive number" },
        { status: 400 },
      );

    // Validate all participant userIds are present
    const participantIds = participants
      .map((p: any) => p?.userId?.toString())
      .filter(Boolean);
    if (participantIds.length !== participants.length)
      return NextResponse.json(
        { error: "each participant must include a userId" },
        { status: 400 },
      );

    // Validate all participants are group members
    if (!allParticipantsValid(participantIds, group))
      return NextResponse.json(
        { error: "one or more participants are not valid group members" },
        { status: 400 },
      );

    // Calculate/validate amounts based on split type
    let finalParticipants: { userId: string; amount: number; percentage?: number }[];

    if (splitType === "equal") {
      finalParticipants = calculateEqualSplit(totalAmount, participantIds);
    } else if (splitType === "custom-amount") {
      const validationError = validateCustomAmountSplit(
        totalAmount,
        participants,
      );
      if (validationError)
        return NextResponse.json({ error: validationError }, { status: 400 });
      finalParticipants = participants;
    } else {
      // custom-percentage
      const validationError = validateCustomPercentageSplit(participants);
      if (validationError)
        return NextResponse.json({ error: validationError }, { status: 400 });
      finalParticipants = applyPercentageSplit(
        totalAmount,
        participants.map((p: any) => ({
          userId: p.userId,
          percentage: p.percentage ?? 0,
        })),
      );
    }

    const createdBy = userIds[0];
    const newSplit = await CostSplit.create({
      groupId,
      tripId: tripId || undefined,
      expenseId,
      participants: finalParticipants,
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
