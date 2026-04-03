/*
import { jest } from "@jest/globals";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { randomUUID } from "crypto";

let GETGroups: any,
  GETGroup: any,
  PATCHGroup: any,
  POSTMember: any,
  DELETEMember: any,
  PATCHLeader: any,
  POSTLeave: any;
let User: any, TravelGroup: any, dbConnect: any, bcrypt: any;
let mockGetServerSession: jest.MockedFunction<any>;

await jest.unstable_mockModule("next-auth", () => ({
  getServerSession: jest.fn(),
}));

await jest.unstable_mockModule("@/lib/auth", () => ({
  authOptions: {},
}));

function paramsManage(p: { groupId: string; memberId?: string }) {
  return Promise.resolve(p);
}

const CONNECTION_CLEANUP_DELAY_MS = 500;

beforeAll(async () => {
  jest.resetModules();

  const nextAuth = await import("next-auth");
  mockGetServerSession = nextAuth.getServerSession as any;

  ({ default: bcrypt } = await import("bcryptjs"));
  ({ default: dbConnect } = await import("@/lib/dbConnect"));
  ({ default: User } = await import("@/models/User"));
  ({ default: TravelGroup } = await import("@/models/TravelGroup"));

  await dbConnect();

  const groupsRoute = await import("@/app/api/groups/route");
  GETGroups = groupsRoute.GET;

  const groupIdRoute = await import("@/app/api/groups/[groupId]/route");
  GETGroup = groupIdRoute.GET as any;
  PATCHGroup = groupIdRoute.PATCH as any;

  const membersRoute = await import("@/app/api/groups/[groupId]/members/route");
  POSTMember = membersRoute.POST as any;

  const memberIdRoute =
    await import("@/app/api/groups/[groupId]/members/[memberId]/route");
  DELETEMember = memberIdRoute.DELETE as any;

  const leaderRoute = await import("@/app/api/groups/[groupId]/leader/route");
  PATCHLeader = leaderRoute.PATCH as any;
  const leaveRoute = await import("@/app/api/groups/[groupId]/leave/route");
  POSTLeave = leaveRoute.POST as any;
});

afterAll(async () => {
  if (TravelGroup && User) {
    await TravelGroup.deleteMany({});
    await User.deleteMany({});
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if ((global as any).mongoose) {
    (global as any).mongoose.conn = null;
    (global as any).mongoose.promise = null;
  }

  await new Promise((resolve) =>
    setTimeout(resolve, CONNECTION_CLEANUP_DELAY_MS),
  );

  jest.clearAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── TESTS ────────────────────────────────────────────────────────────────────

describe("GET /api/groups", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GETGroups();
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toMatch(/logged in|unauthorized/i);
  });

  it("returns only groups where current user is a member", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const userA = await User.create({
      username: "usera_list",
      email: "usera_list@test.com",
      passwordHash,
      school: "Purdue",
    });
    const userB = await User.create({
      username: "userb_list",
      email: "userb_list@test.com",
      passwordHash,
      school: "Purdue",
    });
    const groupA = await TravelGroup.create({
      groupName: "Group A",
      leaderID: userA.userId,
      membersList: [{ userId: userA.userId, role: "Leader" }],
    });
    const groupB = await TravelGroup.create({
      groupName: "Group B",
      leaderID: userB.userId,
      membersList: [{ userId: userB.userId, role: "Leader" }],
    });
    const groupBoth = await TravelGroup.create({
      groupName: "Group Both",
      leaderID: userA.userId,
      membersList: [
        { userId: userA.userId, role: "Leader" },
        { userId: userB.userId, role: "Viewer" },
      ],
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId: userA.userId },
      expires: "",
    });
    const res = await GETGroups();
    const data = await res.json();
    expect(res.status).toBe(200);
    const ids = (data.groups as any[]).map((g) => g.groupID.toString());
    expect(ids).toContain(groupA.groupID.toString());
    expect(ids).toContain(groupBoth.groupID.toString());
    expect(ids).not.toContain(groupB.groupID.toString());

    await TravelGroup.deleteMany({
      groupID: { $in: [groupA.groupID, groupB.groupID, groupBoth.groupID] },
    });
    await User.deleteMany({
      userId: { $in: [userA.userId, userB.userId] },
    });
  });
});

describe("GET /api/groups/[groupId]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const passwordHash = await bcrypt.hash("pw", 10);
    const user = await User.create({
      username: "get_unauth",
      email: "get_unauth@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "G",
      leaderID: user.userId,
      membersList: [{ userId: user.userId, role: "Leader" }],
    });
    const res = await GETGroup(new Request("http://localhost"), {
      params: paramsManage({ groupId: group.groupID }),
    });

    expect(res.status).toBe(401);
    await TravelGroup.deleteOne({ groupID: group.groupID });
    await User.deleteOne({ userId: user.userId });
  });

  it("returns 403 when user is not a member", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const leader = await User.create({
      username: "leader_get",
      email: "leader_get@test.com",
      passwordHash,
      school: "Purdue",
    });
    const outsider = await User.create({
      username: "outsider_get",
      email: "outsider_get@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "Only Leader",
      leaderID: leader.userId,
      membersList: [{ userId: leader.userId, role: "Leader" }],
    });
    mockGetServerSession.mockResolvedValue({
      user: { userId: outsider.userId },
      expires: "",
    });
    const res = await GETGroup(new Request("http://localhost"), {
      params: paramsManage({ groupId: group.groupID }),
    });
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error).toMatch(/do not have access/i);
    await TravelGroup.deleteOne({ groupID: group.groupID });
    await User.deleteMany({
      userId: { $in: [leader.userId, outsider.userId] },
    });
  });

  it("returns 200 with isLeader and members when user is member", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const leader = await User.create({
      username: "leader_member",
      email: "leader_member@test.com",
      passwordHash,
      school: "Purdue",
    });
    const member = await User.create({
      username: "member_member",
      email: "member_member@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "Two People",
      leaderID: leader.userId,
      membersList: [
        { userId: leader.userId, role: "Leader" },
        { userId: member.userId, role: "Viewer" },
      ],
    });
    mockGetServerSession.mockResolvedValue({
      user: { userId: leader.userId.toString() },
      expires: "",
    });
    const res = await GETGroup(new Request("http://localhost"), {
      params: paramsManage({ groupId: group.groupID.toString() }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.group.isLeader).toBe(true);
    expect(data.group.members.length).toBe(2);

    mockGetServerSession.mockResolvedValue({
      user: { userId: member.userId.toString() },
      expires: "",
    });
    const resMember = await GETGroup(new Request("http://localhost"), {
      params: paramsManage({ groupId: group.groupID.toString() }),
    });
    const dataMember = await resMember.json();
    expect(resMember.status).toBe(200);
    expect(dataMember.group.isLeader).toBe(false);
  });
});

describe("PATCH /api/groups/[groupId]", () => {
  it("returns 403 when requester is member but not leader", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const leader = await User.create({
      username: "patch_leader",
      email: "patch_leader@test.com",
      passwordHash,
      school: "Purdue",
    });
    const member = await User.create({
      username: "patch_member",
      email: "patch_member@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "Original Name",
      leaderID: leader.userId,
      membersList: [
        { userId: leader.userId, role: "Leader" },
        { userId: member.userId, role: "Viewer" },
      ],
    });
    mockGetServerSession.mockResolvedValue({
      user: { userId: member.userId.toString() },
      expires: "",
    });
    const res = await PATCHGroup(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupName: "Hacked" }),
      }),
      { params: paramsManage({ groupId: group.groupID.toString() }) },
    );
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error).toMatch(/leader/i);
    const unchanged = await TravelGroup.findOne({
      groupID: group.groupID.toString(),
    });
    expect(unchanged!.groupName).toBe("Original Name");
    await TravelGroup.deleteOne({ groupID: group.groupID.toString() });
    await User.deleteMany({ userId: { $in: [leader.userId, member.userId] } });
  });

  it("returns 200 and updates group name when leader", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const leader = await User.create({
      username: "patch_ok_leader",
      email: "patch_ok_leader@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "Before",
      leaderID: leader.userId,
      membersList: [{ userId: leader.userId, role: "Leader" }],
    });
    mockGetServerSession.mockResolvedValue({
      user: { userId: leader.userId.toString() },
      expires: "",
    });
    const res = await PATCHGroup(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupName: "After" }),
      }),
      { params: paramsManage({ groupId: group.groupID.toString() }) },
    );
    const data = await res.json();
    expect(res.status).toBe(200);

    expect(data.group.groupName).toBe("After");
    const updated = await TravelGroup.findOne({
      groupID: group.groupID.toString(),
    });
    expect(updated!.groupName).toBe("After");
    await TravelGroup.deleteOne({ groupID: group.groupID.toString() });
    await User.deleteOne({ userId: leader.userId.toString() });
  });
});

describe("POST /api/groups/[groupId]/members", () => {
  it("returns 403 when not leader", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const leader = await User.create({
      username: "post_leader",
      email: "post_leader@test.com",
      passwordHash,
      school: "Purdue",
    });
    const member = await User.create({
      username: "post_member",
      email: "post_member@test.com",
      passwordHash,
      school: "Purdue",
    });
    const newUser = await User.create({
      username: "newuser",
      email: "newuser@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "G",
      leaderID: leader.userId,
      membersList: [
        { userId: leader.userId, role: "Leader" },
        { userId: member.userId, role: "Viewer" },
      ],
    });
    mockGetServerSession.mockResolvedValue({
      user: { userId: member.userId.toString() },
      expires: "",
    });
    const res = await POSTMember(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newUser.email }),
      }),
      { params: paramsManage({ groupId: group.groupID.toString() }) },
    );
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error).toMatch(/leader/i);
    const unchanged = await TravelGroup.findOne({
      groupID: group.groupID.toString(),
    });
    expect(unchanged!.membersList).toHaveLength(2);
    await TravelGroup.deleteOne({ groupID: group.groupID.toString() });
    await User.deleteMany({
      userId: {
        $in: [
          leader.userId.toString(),
          member.userId.toString(),
          newUser.userId.toString(),
        ],
      },
    });
  });

  it("returns 400 when user already in group", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const leader = await User.create({
      username: "post_dup_leader",
      email: "post_dup_leader@test.com",
      passwordHash,
      school: "Purdue",
    });
    const member = await User.create({
      username: "post_dup_member",
      email: "post_dup_member@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "G",
      leaderID: leader.userId,
      membersList: [
        { userId: leader.userId, role: "Leader" },
        { userId: member.userId, role: "Viewer" },
      ],
    });
    mockGetServerSession.mockResolvedValue({
      user: { userId: leader.userId.toString() },
      expires: "",
    });
    const res = await POSTMember(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: member.email }),
      }),
      { params: paramsManage({ groupId: group.groupID.toString() }) },
    );
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/already in the group/i);
    await TravelGroup.deleteOne({ groupID: group.groupID.toString() });
    await User.deleteMany({
      userId: { $in: [leader.userId.toString(), member.userId.toString()] },
    });
  });

  it("returns 201 and adds member when leader", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const leader = await User.create({
      username: "post_ok_leader",
      email: "post_ok_leader@test.com",
      passwordHash,
      school: "Purdue",
    });
    const newUser = await User.create({
      username: "newuser_ok",
      email: "newuser_ok@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "G",
      leaderID: leader.userId,
      membersList: [{ userId: leader.userId, role: "Leader" }],
    });
    mockGetServerSession.mockResolvedValue({
      user: { userId: leader.userId.toString() },
      expires: "",
    });
    const res = await POSTMember(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newUser.email }),
      }),
      { params: paramsManage({ groupId: group.groupID.toString() }) },
    );
    const data = await res.json();
    expect(res.status).toBe(201);
    const pendingEmails = data.group.pendingRequests.map((r: any) => r.email);
    expect(pendingEmails).toContain(newUser.email.toLowerCase());
    const updated = await TravelGroup.findOne({
      groupID: group.groupID.toString(),
    });
    const updatedIds = updated!.membersList.map((m: any) =>
      m.userId.toString(),
    );
    expect(updatedIds).toContain(newUser.userId.toString());
    await TravelGroup.deleteOne({ groupID: group.groupID.toString() });
    await User.deleteMany({
      userId: { $in: [leader.userId.toString(), newUser.userId.toString()] },
    });
  });
});

describe("DELETE /api/groups/[groupId]/members/[memberId]", () => {
  it("returns 403 when not leader", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const leader = await User.create({
      username: "del_leader",
      email: "del_leader@test.com",
      passwordHash,
      school: "Purdue",
    });
    const member = await User.create({
      username: "del_member",
      email: "del_member@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "G",
      leaderID: leader.userId,
      membersList: [
        { userId: leader.userId, role: "Leader" },
        { userId: member.userId, role: "Viewer" },
      ],
    });
    mockGetServerSession.mockResolvedValue({
      user: { userId: member.userId },
      expires: "",
    });
    const res = await DELETEMember(new Request("http://localhost"), {
      params: paramsManage({
        groupId: group.groupID,
        memberId: leader.userId,
      }),
    });

    expect(res.status).toBe(403);
    await TravelGroup.deleteOne({ groupID: group.groupID });
    await User.deleteMany({ userId: { $in: [leader.userId, member.userId] } });
  });

  it("returns 400 when removing the leader", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const leader = await User.create({
      username: "del_lead_leader",
      email: "del_lead_leader@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "G",
      leaderID: leader.userId,
      membersList: [{ userId: leader.userId, role: "Leader" }],
    });
    mockGetServerSession.mockResolvedValue({
      user: { userId: leader.userId.toString() },
      expires: "",
    });
    const res = await DELETEMember(new Request("http://localhost"), {
      params: paramsManage({
        groupId: group.groupID.toString(),
        memberId: leader.userId.toString(),
      }),
    });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/cannot remove.*leader/i);
    await TravelGroup.deleteOne({ groupID: group.groupID.toString() });
    await User.deleteOne({ userId: leader.userId.toString() });
  });

  it("returns 200 and removes member when leader", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const leader = await User.create({
      username: "del_ok_leader",
      email: "del_ok_leader@test.com",
      passwordHash,
      school: "Purdue",
    });
    const member = await User.create({
      username: "del_ok_member",
      email: "del_ok_member@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "G",
      leaderID: leader.userId,
      membersList: [
        { userId: leader.userId, role: "Leader" },
        { userId: member.userId, role: "Viewer" },
      ],
    });
    mockGetServerSession.mockResolvedValue({
      user: { userId: leader.userId.toString() },
      expires: "",
    });
    const res = await DELETEMember(new Request("http://localhost"), {
      params: paramsManage({
        groupId: group.groupID.toString(),
        memberId: member.userId.toString(),
      }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    const memberIds = data.group.membersList.map((m: any) =>
      m.userId.toString(),
    );
    expect(memberIds).not.toContain(member.userId.toString());
    const updated = await TravelGroup.findOne({
      groupID: group.groupID.toString(),
    });
    const updatedIds = updated!.membersList.map((m: any) =>
      m.userId.toString(),
    );
    expect(updatedIds).not.toContain(member.userId.toString());
    expect(updated!.membersList).toHaveLength(1);
    await TravelGroup.deleteOne({ groupID: group.groupID.toString() });
    await User.deleteMany({
      userId: { $in: [leader.userId.toString(), member.userId.toString()] },
    });
  });
});

describe("PATCH /api/groups/[groupId]/leader", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const gId = randomUUID();
    const nLId = randomUUID();

    const res = await PATCHLeader(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ newLeaderId: nLId }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: paramsManage({ groupId: gId }) },
    );
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toMatch(/logged in|unauthorized/i);
  });

  it("returns 403 when not the leader", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const leader = await User.create({
      username: "tl_leader",
      email: "tl_leader@test.com",
      passwordHash,
      school: "Purdue",
    });
    const member = await User.create({
      username: "tl_member",
      email: "tl_member@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "G",
      leaderID: leader.userId,
      membersList: [
        { userId: leader.userId, role: "Leader" },
        { userId: member.userId, role: "Viewer" },
      ],
    });
    mockGetServerSession.mockResolvedValue({
      user: { userId: member.userId.toString() },
      expires: "",
    });
    const res = await PATCHLeader(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ newLeaderId: leader.userId.toString() }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: paramsManage({ groupId: group.groupID.toString() }) },
    );
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error).toMatch(/only the group leader/i);
    const unchanged = await TravelGroup.findOne({
      groupID: group.groupID.toString(),
    });
    expect(unchanged!.leaderID.toString()).toBe(leader.userId.toString());
    await TravelGroup.deleteOne({ groupID: group.groupID.toString() });
    await User.deleteMany({
      userId: { $in: [leader.userId.toString(), member.userId.toString()] },
    });
  });

  it("returns 400 when transferring to self", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const leader = await User.create({
      username: "tl_self_leader",
      email: "tl_self_leader@test.com",
      passwordHash,
      school: "Purdue",
    });
    const member = await User.create({
      username: "tl_self_member",
      email: "tl_self_member@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "G",
      leaderID: leader.userId,
      membersList: [
        { userId: leader.userId, role: "Leader" },
        { userId: member.userId, role: "Viewer" },
      ],
    });
    mockGetServerSession.mockResolvedValue({
      user: { userId: leader.userId.toString() },
      expires: "",
    });
    const res = await PATCHLeader(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ newLeaderId: leader.userId.toString() }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: paramsManage({ groupId: group.groupID.toString() }) },
    );
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/yourself/i);
    const unchanged = await TravelGroup.findOne({
      groupID: group.groupID.toString(),
    });
    expect(unchanged!.leaderID.toString()).toBe(leader.userId.toString());
    await TravelGroup.deleteOne({ groupID: group.groupID.toString() });
    await User.deleteMany({
      userId: { $in: [leader.userId.toString(), member.userId.toString()] },
    });
  });

  it("returns 400 when new leader is not in membersList", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const leader = await User.create({
      username: "tl_nm_leader",
      email: "tl_nm_leader@test.com",
      passwordHash,
      school: "Purdue",
    });
    const member = await User.create({
      username: "tl_nm_member",
      email: "tl_nm_member@test.com",
      passwordHash,
      school: "Purdue",
    });
    const outsider = await User.create({
      username: "tl_nm_outside",
      email: "tl_nm_outside@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "G",
      leaderID: leader.userId,
      membersList: [
        { userId: leader.userId, role: "Leader" },
        { userId: member.userId, role: "Viewer" },
      ],
    });
    mockGetServerSession.mockResolvedValue({
      user: { userId: leader.userId.toString() },
      expires: "",
    });
    const res = await PATCHLeader(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ newLeaderId: outsider.userId.toString() }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: paramsManage({ groupId: group.groupID.toString() }) },
    );
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/not a member/i);
    const unchanged = await TravelGroup.findOne({
      groupID: group.groupID.toString(),
    });
    expect(unchanged!.leaderID.toString()).toBe(leader.userId.toString());
    await TravelGroup.deleteOne({ groupID: group.groupID.toString() });
    await User.deleteMany({
      userId: {
        $in: [
          leader.userId.toString(),
          member.userId.toString(),
          outsider.userId.toString(),
        ],
      },
    });
  });

  it("returns 200 and updates leaderID when leader transfers to another member", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const leader = await User.create({
      username: "tl_ok_leader",
      email: "tl_ok_leader@test.com",
      passwordHash,
      school: "Purdue",
    });
    const member = await User.create({
      username: "tl_ok_member",
      email: "tl_ok_member@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "G",
      leaderID: leader.userId,
      membersList: [
        { userId: leader.userId, role: "Leader" },
        { userId: member.userId, role: "Viewer" },
      ],
    });
    mockGetServerSession.mockResolvedValue({
      user: { userId: leader.userId.toString() },
      expires: "",
    });
    const res = await PATCHLeader(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ newLeaderId: member.userId.toString() }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: paramsManage({ groupId: group.groupID.toString() }) },
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.group).toBeDefined();
    expect(data.group.leaderID.toString()).toBe(member.userId.toString());
    const updated = await TravelGroup.findOne({
      groupID: group.groupID.toString(),
    });
    expect(updated!.leaderID.toString()).toBe(member.userId.toString());
    await TravelGroup.deleteOne({ groupID: group.groupID.toString() });
    await User.deleteMany({
      userId: { $in: [leader.userId.toString(), member.userId.toString()] },
    });
  });
});

describe("POST /api/groups/[groupId]/leave", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POSTLeave(
      new Request("http://localhost", { method: "POST" }),
      {
        params: paramsManage({ groupId: randomUUID() }),
      },
    );
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toMatch(/logged in|unauthorized/i);
  });

  it("returns 200 and removes member when non-leader leaves", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const leader = await User.create({
      username: "leave_leader",
      email: "leave_leader@test.com",
      passwordHash,
      school: "Purdue",
    });
    const member = await User.create({
      username: "leave_member",
      email: "leave_member@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "G",
      leaderID: leader.userId,
      membersList: [
        { userId: leader.userId, role: "Leader" },
        { userId: member.userId, role: "Viewer" },
      ],
    });
    mockGetServerSession.mockResolvedValue({
      user: { userId: member.userId.toString() },
      expires: "",
    });
    const res = await POSTLeave(
      new Request("http://localhost", { method: "POST" }),
      {
        params: paramsManage({ groupId: group.groupID.toString() }),
      },
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.group).toBeDefined();
    const updatedIds = data.group.membersList.map((m: any) =>
      m.userId.toString(),
    );
    expect(updatedIds).not.toContain(member.userId.toString());
    const updated = await TravelGroup.findOne({
      groupID: group.groupID.toString(),
    });
    const dbIds = updated!.membersList.map((m: any) => m.userId.toString());
    expect(dbIds).not.toContain(member.userId.toString());
    expect(updated!.membersList).toHaveLength(1);
    await TravelGroup.deleteOne({ groupID: group.groupID.toString() });
    await User.deleteMany({
      userId: { $in: [leader.userId.toString(), member.userId.toString()] },
    });
  });

  it("returns 200 and transfers leadership if leader leaves and members exist", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const leader = await User.create({
      username: "leave_lead_leader",
      email: "leave_lead_leader@test.com",
      passwordHash,
      school: "Purdue",
    });
    const member = await User.create({
      username: "leave_lead_member",
      email: "leave_lead_member@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "G",
      leaderID: leader.userId,
      membersList: [
        { userId: leader.userId, role: "Leader" },
        { userId: member.userId, role: "Viewer" },
      ],
    });
    mockGetServerSession.mockResolvedValue({
      user: { userId: leader.userId.toString() },
      expires: "",
    });
    const res = await POSTLeave(
      new Request("http://localhost", { method: "POST" }),
      {
        params: paramsManage({ groupId: group.groupID.toString() }),
      },
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.group).toBeDefined();
    expect(data.group.leaderID.toString()).toBe(member.userId.toString());
    const updated = await TravelGroup.findOne({
      groupID: group.groupID.toString(),
    });
    expect(updated!.leaderID.toString()).toBe(member.userId.toString());
    const dbIds = updated!.membersList.map((m: any) => m.userId.toString());
    expect(dbIds).not.toContain(leader.userId.toString());
    await TravelGroup.deleteOne({ groupID: group.groupID.toString() });
    await User.deleteMany({
      userId: { $in: [leader.userId.toString(), member.userId.toString()] },
    });
  });

  it("returns 200 and deletes group when sole member (leader) leaves", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const leader = await User.create({
      username: "leave_sole",
      email: "leave_sole@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "G",
      leaderID: leader.userId,
      membersList: [{ userId: leader.userId, role: "Leader" }],
    });
    mockGetServerSession.mockResolvedValue({
      user: { userId: leader.userId.toString() },
      expires: "",
    });
    const res = await POSTLeave(
      new Request("http://localhost", { method: "POST" }),
      {
        params: paramsManage({ groupId: group.groupID.toString() }),
      },
    );
    expect(res.status).toBe(200);
    const deleted = await TravelGroup.findOne({
      groupID: group.groupID.toString(),
    });
    expect(deleted).toBeNull();
    await User.deleteOne({ userId: leader.userId.toString() });
  });

  it("returns 403 when user who left tries to access group or leave again", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const leader = await User.create({
      username: "leave_403_leader",
      email: "leave_403_leader@test.com",
      passwordHash,
      school: "Purdue",
    });
    const member = await User.create({
      username: "leave_403_member",
      email: "leave_403_member@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "G",
      leaderID: leader.userId,
      membersList: [
        { userId: leader.userId, role: "Leader" },
        { userId: member.userId, role: "Viewer" },
      ],
    });
    mockGetServerSession.mockResolvedValue({
      user: { userId: member.userId.toString() },
      expires: "",
    });
    const leaveRes = await POSTLeave(
      new Request("http://localhost", { method: "POST" }),
      {
        params: paramsManage({ groupId: group.groupID.toString() }),
      },
    );
    expect(leaveRes.status).toBe(200);
    const getRes = await GETGroup(new Request("http://localhost"), {
      params: paramsManage({ groupId: group.groupID.toString() }),
    });
    expect(getRes.status).toBe(403);
    const leaveAgainRes = await POSTLeave(
      new Request("http://localhost", { method: "POST" }),
      {
        params: paramsManage({ groupId: group.groupID.toString() }),
      },
    );
    expect(leaveAgainRes.status).toBe(403);
    await TravelGroup.deleteOne({ groupID: group.groupID.toString() });
    await User.deleteMany({
      userId: { $in: [leader.userId.toString(), member.userId.toString()] },
    });
  });
});

*/
