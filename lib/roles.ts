import TravelGroup from "@/models/TravelGroup";

/**
 * EXACT LOGIC: Validates user role and returns specific permissions.
 */
export async function getMemberPermissions(groupId: string, userId: string) {
  const group = await TravelGroup.findOne({ groupID: groupId });
  if (!group) return { error: "Group not found", status: 404 };

  const isLeader = String(group.leaderID) === String(userId);

  const member = group.membersList.find(
    (m: any) => String(m.userId) === String(userId),
  );

  if (!isLeader && !member)
    return { error: "Access denied: Not a member", status: 403 };

  const role = isLeader ? "Leader" : member.role;

  return {
    group,
    role,
    isLeader,
    canEdit: ["Leader", "Admin"].includes(role),
    status: 200,
  };
}
