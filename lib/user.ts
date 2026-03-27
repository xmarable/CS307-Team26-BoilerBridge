import { getServerSession, Session } from "next-auth";
import { authOptions } from "./auth";
import dbConnect from "./dbConnect";
import TravelGroup from "@/models/TravelGroup";

export async function getUserGroups() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user)?.userId;
  if (!userId) {
    return null;
  }

  await dbConnect();

  const groups = await TravelGroup.find(
    { "membersList.userId": userId },
    { groupID: 1, groupName: 1, leaderID: 1, membersList: 1 },
  ).lean();

  return groups.map((g) => ({
    groupID: g.groupID,
    groupName: g.groupName,
    members: g.membersList,
  }));
}
