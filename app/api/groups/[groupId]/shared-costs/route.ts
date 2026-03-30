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
  { params }: { params: { groupId: string } }
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

    const { searchParams } = new URL(req.url);

    const tripId = searchParams.get("tripId");
    const category = searchParams.get("category");
    const paidBy = searchParams.get("paidBy");
    const date = searchParams.get("date");

    const query: any = {
      groupId: params.groupId,
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
