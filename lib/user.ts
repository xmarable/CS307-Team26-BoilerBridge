import { getServerSession, Session } from "next-auth";
import { authOptions } from "./auth";
import dbConnect from "./dbConnect";
import TravelGroup from "@/models/TravelGroup";
import { group } from "console";

export async function getUserGroups() {
    const session = await getServerSession(authOptions);
    const rawId = session?.user && "id" in session.user ? session.user.id : undefined;
    const userId = typeof rawId === "string" ? rawId : undefined;
    if (!userId) {
      return null;
    }

    await dbConnect();

    const groups = await TravelGroup.find(
        { membersList: userId },
        { groupID: 1, groupName: 1, leaderID: 1}
    ).lean();

    return groups.map((g) => ({
        groupID: g.groupID,
        groupName: g.groupName,
        leaderID: g.leaderID,
        members: g.membersList
    }));
}