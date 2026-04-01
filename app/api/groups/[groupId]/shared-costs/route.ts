import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import SharedCost from "@/models/SharedCost";
import TravelGroup from "@/models/TravelGroup";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";

function getSessionUserIds(session: any): string[] {
  return [session?.user?.userId, session?.user?.id].filter(Boolean);
}

function isGroupLeader(group: any, userIds: string[]) {
  return userIds.includes(group?.leaderID);
}

function isGroupMember(group: any, userIds: string[]) {
  if (!Array.isArray(group?.membersList)) return false;
  return group.membersList.some((memberId: string) => userIds.includes(memberId));
}

function allParticipantsValid(
  participantIds: string[],
  group: any,
  userIds: string[]
) {
  const validIds = new Set<string>([
    ...(Array.isArray(group?.membersList) ? group.membersList : []),
    group?.leaderID,
    ...userIds,
  ].filter(Boolean));

  return participantIds.every((id) => validIds.has(id));
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> }
) {
  try {
    await dbConnect();
    const { groupId } = await context.params;

    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userIds = getSessionUserIds(session);
    if (userIds.length === 0) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const group = await TravelGroup.findById(groupId);
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (!isGroupMember(group, userIds) && !isGroupLeader(group, userIds)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);

    const tripId = searchParams.get("tripId");
    const category = searchParams.get("category");
    const paidBy = searchParams.get("paidBy");
    const date = searchParams.get("date");

    const query: any = {
      groupId: groupId,
    };

    if (tripId) query.tripId = tripId;
    if (category) query.category = category;
    if (paidBy) query.paidBy = paidBy;

    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);

      query.date = {
        $gte: start,
        $lt: end,
      };
    }

    const sharedCosts = await SharedCost.find(query).sort({ date: -1, createdAt: -1 });

    return NextResponse.json({ sharedCosts }, { status: 200 });
  } catch (error) {
    console.error("GET shared-costs error:", error);
    return NextResponse.json(
      { error: "Failed to fetch shared costs" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> }
) {
  try {
    await dbConnect();
    const { groupId } = await context.params;

    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userIds = getSessionUserIds(session);
    if (userIds.length === 0) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const group = await TravelGroup.findById(groupId);
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (!isGroupMember(group, userIds) && !isGroupLeader(group, userIds)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    const {
      tripId,
      title,
      description,
      amount,
      currency,
      category,
      paidBy,
      participants,
      splitType,
      date,
      notes,
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "amount must be a positive number" },
        { status: 400 }
      );
    }

    if (!currency?.trim()) {
      return NextResponse.json({ error: "currency is required" }, { status: 400 });
    }

    if (!paidBy?.trim()) {
      return NextResponse.json({ error: "paidBy is required" }, { status: 400 });
    }

    if (!Array.isArray(participants) || participants.length === 0) {
      return NextResponse.json(
        { error: "participants must be a non-empty array" },
        { status: 400 }
      );
    }

    const participantIds = participants.map((p: any) => p?.userId).filter(Boolean);

    if (participantIds.length !== participants.length) {
      return NextResponse.json(
        { error: "each participant must include a userId" },
        { status: 400 }
      );
    }

    const validSplitTypes = ["equal", "custom-amount", "custom-percentage"];
    if (!validSplitTypes.includes(splitType)) {
      return NextResponse.json(
        { error: "invalid splitType" },
        { status: 400 }
      );
    }

    if (!allParticipantsValid(participantIds, group, userIds)) {
      return NextResponse.json(
        { error: "one or more participants are not valid group members" },
        { status: 400 }
      );
    }

    const validPayers = new Set<string>([
      ...(Array.isArray(group?.membersList) ? group.membersList : []),
      group?.leaderID,
      ...userIds,
    ].filter(Boolean));

    if (!validPayers.has(paidBy)) {
      return NextResponse.json(
        { error: "paidBy must be a valid group member" },
        { status: 400 }
      );
    }

    const sharedCost = await SharedCost.create({
      groupId: groupId,
      tripId: tripId || undefined,
      title: title.trim(),
      description: description?.trim() || undefined,
      amount,
      currency: currency.trim().toUpperCase(),
      category: category?.trim() || undefined,
      paidBy: paidBy.trim(),
      participants,
      splitType,
      date: date ? new Date(date) : new Date(),
      notes: notes?.trim() || undefined,
      createdBy: session.user.userId ?? session.user.id,
    });
    
    try {
      await TravelGroup.findByIdAndUpdate(groupId, {
        $push: {
          ledger: {
            payerID: paidBy.trim(),
            amount,
            description: title.trim(),
            debtors: Object.fromEntries(
              participants.map((p: any) => [
                p.userId,
                amount / participants.length,
              ]),
            ),
            isSettled: false,
          },
        },
      });
    } catch (err) {
      console.warn("Ledger sync failed:", err);
    }
    
    return NextResponse.json({ sharedCost }, { status: 201 });
  } catch (error) {
    console.error("POST shared-costs error:", error);
    return NextResponse.json(
      { error: "Failed to create shared cost" },
      { status: 500 }
    );
  }
}