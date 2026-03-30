import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import CostSplit from "@/models/CostSplit";
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

function isCreator(split: any, userIds: string[]) {
  return userIds.includes(split?.createdBy);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { groupId: string; id: string } }
) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userIds = getSessionUserIds(session);
    if (userIds.length === 0) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const group = await TravelGroup.findById(params.groupId);
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (!isGroupMember(group, userIds) && !isGroupLeader(group, userIds)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existingSplit = await CostSplit.findOne({
      _id: params.id,
      groupId: params.groupId,
    });

    if (!existingSplit) {
      return NextResponse.json({ error: "Cost split not found" }, { status: 404 });
    }

    if (!isCreator(existingSplit, userIds) && !isGroupLeader(group, userIds)) {
      return NextResponse.json(
        { error: "Only the creator or group admin can edit this cost split" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      tripId,
      expenseId,
      participants,
      splitType,
      totalAmount,
    } = body;

    if (expenseId !== undefined && !expenseId) {
      return NextResponse.json(
        { error: "expenseId cannot be empty" },
        { status: 400 }
      );
    }

    if (participants !== undefined) {
      if (!Array.isArray(participants) || participants.length === 0) {
        return NextResponse.json(
          { error: "participants must be a non-empty array" },
          { status: 400 }
        );
      }
    }

    if (splitType !== undefined) {
      const validTypes = ["equal", "custom-amount", "custom-percentage"];
      if (!validTypes.includes(splitType)) {
        return NextResponse.json(
          { error: "Invalid splitType" },
          { status: 400 }
        );
      }
    }

    if (totalAmount !== undefined) {
      if (typeof totalAmount !== "number" || totalAmount <= 0) {
        return NextResponse.json(
          { error: "totalAmount must be greater than 0" },
          { status: 400 }
        );
      }
    }

    const updatedSplit = await CostSplit.findByIdAndUpdate(
      params.id,
      {
        ...(tripId !== undefined ? { tripId } : {}),
        ...(expenseId !== undefined ? { expenseId } : {}),
        ...(participants !== undefined ? { participants } : {}),
        ...(splitType !== undefined ? { splitType } : {}),
        ...(totalAmount !== undefined ? { totalAmount } : {}),
      },
      { new: true, runValidators: true }
    );

    return NextResponse.json({ costSplit: updatedSplit }, { status: 200 });
  } catch (error) {
    console.error("PUT cost-split error:", error);
    return NextResponse.json(
      { error: "Failed to update cost split" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { groupId: string; id: string } }
) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userIds = getSessionUserIds(session);
    if (userIds.length === 0) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const group = await TravelGroup.findById(params.groupId);
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (!isGroupMember(group, userIds) && !isGroupLeader(group, userIds)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existingSplit = await CostSplit.findOne({
      _id: params.id,
      groupId: params.groupId,
    });

    if (!existingSplit) {
      return NextResponse.json({ error: "Cost split not found" }, { status: 404 });
    }

    if (!isCreator(existingSplit, userIds) && !isGroupLeader(group, userIds)) {
      return NextResponse.json(
        { error: "Only the creator or group admin can delete this cost split" },
        { status: 403 }
      );
    }

    await CostSplit.findByIdAndDelete(params.id);

    return NextResponse.json(
      { message: "Cost split deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE cost-split error:", error);
    return NextResponse.json(
      { error: "Failed to delete cost split" },
      { status: 500 }
    );
  }
}