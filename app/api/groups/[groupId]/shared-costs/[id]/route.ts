import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import SharedCost from "@/models/SharedCost";
import TravelGroup from "@/models/TravelGroup";
import dbConnect from "@/lib/dbConnect";
// Change this import if your auth config file uses a different path
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

function isCreator(sharedCost: any, userIds: string[]) {
  return userIds.includes(sharedCost?.createdBy);
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

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ groupId: string; id: string }> }
) {
  try {
    await dbConnect();
    const { groupId, id } = await context.params;

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

    const existingSharedCost = await SharedCost.findOne({
      _id: id,
      groupId: groupId,
    });

    if (!existingSharedCost) {
      return NextResponse.json({ error: "Shared cost not found" }, { status: 404 });
    }

    if (!isCreator(existingSharedCost, userIds) && !isGroupLeader(group, userIds)) {
      return NextResponse.json(
        { error: "Only the creator or group admin can edit this shared cost" },
        { status: 403 }
      );
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

    if (title !== undefined && !title?.trim()) {
      return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
    }

    if (amount !== undefined && (typeof amount !== "number" || amount <= 0)) {
      return NextResponse.json(
        { error: "amount must be a positive number" },
        { status: 400 }
      );
    }

    if (currency !== undefined && !currency?.trim()) {
      return NextResponse.json({ error: "currency cannot be empty" }, { status: 400 });
    }

    if (paidBy !== undefined) {
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
    }

    if (participants !== undefined) {
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

      if (!allParticipantsValid(participantIds, group, userIds)) {
        return NextResponse.json(
          { error: "one or more participants are not valid group members" },
          { status: 400 }
        );
      }
    }

    if (splitType !== undefined) {
      const validSplitTypes = ["equal", "custom-amount", "custom-percentage"];
      if (!validSplitTypes.includes(splitType)) {
        return NextResponse.json(
          { error: "invalid splitType" },
          { status: 400 }
        );
      }
    }

    const updatedSharedCost = await SharedCost.findByIdAndUpdate(
      id,
      {
        ...(tripId !== undefined ? { tripId } : {}),
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(description !== undefined
          ? { description: description?.trim() || undefined }
          : {}),
        ...(amount !== undefined ? { amount } : {}),
        ...(currency !== undefined ? { currency: currency.trim().toUpperCase() } : {}),
        ...(category !== undefined ? { category: category?.trim() || undefined } : {}),
        ...(paidBy !== undefined ? { paidBy: paidBy.trim() } : {}),
        ...(participants !== undefined ? { participants } : {}),
        ...(splitType !== undefined ? { splitType } : {}),
        ...(date !== undefined ? { date: new Date(date) } : {}),
        ...(notes !== undefined ? { notes: notes?.trim() || undefined } : {}),
      },
      { new: true, runValidators: true }
    );

    return NextResponse.json({ sharedCost: updatedSharedCost }, { status: 200 });
  } catch (error) {
    console.error("PUT shared-cost error:", error);
    return NextResponse.json(
      { error: "Failed to update shared cost" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ groupId: string; id: string }> }
) {
  try {
    await dbConnect();
    const { groupId, id } = await context.params;

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

    const existingSharedCost = await SharedCost.findOne({
      _id: id,
      groupId: groupId,
    });

    if (!existingSharedCost) {
      return NextResponse.json({ error: "Shared cost not found" }, { status: 404 });
    }

    if (!isCreator(existingSharedCost, userIds) && !isGroupLeader(group, userIds)) {
      return NextResponse.json(
        { error: "Only the creator or group admin can delete this shared cost" },
        { status: 403 }
      );
    }

    await SharedCost.findByIdAndDelete(id);

    return NextResponse.json(
      { message: "Shared cost deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE shared-cost error:", error);
    return NextResponse.json(
      { error: "Failed to delete shared cost" },
      { status: 500 }
    );
  }
}