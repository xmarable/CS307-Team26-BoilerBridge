import TravelGroup from "@/models/TravelGroup";

/**
 * EXACT LOGIC: Validates user role and returns specific permissions.
 */
export async function getMemberPermissions(groupId: string, userId: string) {
  const group = await TravelGroup.findOne({ groupID: groupId });
  if (!group) return { error: "Group not found", status: 404 };

  const member = group.membersList.find(
    (m: any) => String(m.userId) === String(userId),
  );
  if (!member) return { error: "Access denied: Not a member", status: 403 };

  return {
    group,
    role: member.role,
    isLeader: member.role === "Leader",
    canEdit: ["Leader", "Admin"].includes(member.role), // Logic: Viewers cannot edit
    status: 200,
  };
}
