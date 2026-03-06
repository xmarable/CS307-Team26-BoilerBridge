import { jest } from "@jest/globals";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

await jest.unstable_mockModule("next-auth", () => ({
  getServerSession: jest.fn(),
}));

await jest.unstable_mockModule("@/lib/auth", () => ({
  authOptions: {},
}));

const nextAuth = await import("next-auth");
const { default: bcrypt } = await import("bcryptjs");
const { default: dbConnect } = await import("@/lib/dbConnect");
const { default: User } = await import("@/models/User");
const { default: TravelGroup } = await import("@/models/TravelGroup");

const mockGetServerSession = nextAuth.getServerSession as jest.MockedFunction<
  typeof nextAuth.getServerSession
>;

let GETGroups: () => Promise<Response>;
let GETGroup: (
  req: Request,
  ctx: { params: Promise<{ groupId: string }> },
) => Promise<Response>;
let PATCHGroup: (
  req: Request,
  ctx: { params: Promise<{ groupId: string }> },
) => Promise<Response>;
let POSTMember: (
  req: Request,
  ctx: { params: Promise<{ groupId: string }> },
) => Promise<Response>;
let DELETEMember: (
  req: Request,
  ctx: { params: Promise<{ groupId: string; memberId: string }> },
) => Promise<Response>;
let PATCHLeader: (
  req: Request,
  ctx: { params: Promise<{ groupId: string }> },
) => Promise<Response>;
let POSTLeave: (
  req: Request,
  ctx: { params: Promise<{ groupId: string }> }
) => Promise<Response>;

const CONNECTION_CLEANUP_DELAY_MS = 500;

beforeAll(async () => {
  await dbConnect();
  const groupsRoute = await import("@/app/api/groups/route");
  GETGroups = groupsRoute.GET;
  const groupIdRoute = await import("@/app/api/groups/[groupId]/route");
  GETGroup = groupIdRoute.GET;
  PATCHGroup = groupIdRoute.PATCH;
  const membersRoute = await import("@/app/api/groups/[groupId]/members/route");
  POSTMember = membersRoute.POST;
  const memberIdRoute =
    await import("@/app/api/groups/[groupId]/members/[memberId]/route");
  DELETEMember = memberIdRoute.DELETE;
  const leaderRoute = await import("@/app/api/groups/[groupId]/leader/route");
  PATCHLeader = leaderRoute.PATCH;
  const leaveRoute = await import("@/app/api/groups/[groupId]/leave/route");
  POSTLeave = leaveRoute.POST;
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await TravelGroup.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();
  }
  await new Promise((resolve) =>
    setTimeout(resolve, CONNECTION_CLEANUP_DELAY_MS),
  );
});

beforeEach(() => {
  jest.clearAllMocks();
});

function paramsManage(p: { groupId: string; memberId?: string }) {
  return Promise.resolve(p as { groupId: string; memberId: string });
}

describe("GET /api/groups", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GETGroups();
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toMatch(/logged in/i);
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
      leaderID: userA._id,
      membersList: [userA._id],
    });
    const groupB = await TravelGroup.create({
      groupName: "Group B",
      leaderID: userB._id,
      membersList: [userB._id],
    });
    const groupBoth = await TravelGroup.create({
      groupName: "Group Both",
      leaderID: userA._id,
      membersList: [userA._id, userB._id],
    });

    mockGetServerSession.mockResolvedValue({
      user: { id: userA._id.toString() },
      expires: "",
    });
    const res = await GETGroups();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.groups).toBeDefined();
    const ids = (data.groups as { _id: string }[]).map((g) => g._id);
    expect(ids).toContain(groupA._id.toString());
    expect(ids).toContain(groupBoth._id.toString());
    expect(ids).not.toContain(groupB._id.toString());

    await TravelGroup.deleteMany({
      _id: { $in: [groupA._id, groupB._id, groupBoth._id] },
    });
    await User.deleteMany({
      _id: { $in: [userA._id, userB._id] },
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
      leaderID: user._id,
      membersList: [user._id],
    });
    const res = await GETGroup(new Request("http://localhost"), {
      params: paramsManage({ groupId: group._id.toString() }),
    });
    const data = await res.json();
    expect(res.status).toBe(401);
    await TravelGroup.deleteOne({ _id: group._id });
    await User.deleteOne({ _id: user._id });
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
      leaderID: leader._id,
      membersList: [leader._id],
    });
    mockGetServerSession.mockResolvedValue({
      user: { id: outsider._id.toString() },
      expires: "",
    });
    const res = await GETGroup(new Request("http://localhost"), {
      params: paramsManage({ groupId: group._id.toString() }),
    });
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error).toMatch(/do not have access/i);
    await TravelGroup.deleteOne({ _id: group._id });
    await User.deleteMany({ _id: { $in: [leader._id, outsider._id] } });
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
      leaderID: leader._id,
      membersList: [leader._id, member._id],
    });
    mockGetServerSession.mockResolvedValue({
      user: { id: leader._id.toString() },
      expires: "",
    });
    const res = await GETGroup(new Request("http://localhost"), {
      params: paramsManage({ groupId: group._id.toString() }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.group).toBeDefined();
    expect(data.group.isLeader).toBe(true);
    expect(data.group.members).toBeDefined();
    expect(Array.isArray(data.group.members)).toBe(true);
    expect(data.group.members.length).toBe(2);
    mockGetServerSession.mockResolvedValue({
      user: { id: member._id.toString() },
      expires: "",
    });
    const resMember = await GETGroup(new Request("http://localhost"), {
      params: paramsManage({ groupId: group._id.toString() }),
    });
    const dataMember = await resMember.json();
    expect(resMember.status).toBe(200);
    expect(dataMember.group.isLeader).toBe(false);
    await TravelGroup.deleteOne({ _id: group._id });
    await User.deleteMany({ _id: { $in: [leader._id, member._id] } });
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
      leaderID: leader._id,
      membersList: [leader._id, member._id],
    });
    mockGetServerSession.mockResolvedValue({
      user: { id: member._id.toString() },
      expires: "",
    });
    const res = await PATCHGroup(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupName: "Hacked" }),
      }),
      { params: paramsManage({ groupId: group._id.toString() }) },
    );
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error).toMatch(/leader/i);
    const unchanged = await TravelGroup.findById(group._id);
    expect(unchanged!.groupName).toBe("Original Name");
    await TravelGroup.deleteOne({ _id: group._id });
    await User.deleteMany({ _id: { $in: [leader._id, member._id] } });
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
      leaderID: leader._id,
      membersList: [leader._id],
    });
    mockGetServerSession.mockResolvedValue({
      user: { id: leader._id.toString() },
      expires: "",
    });
    const res = await PATCHGroup(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupName: "After" }),
      }),
      { params: paramsManage({ groupId: group._id.toString() }) },
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.group.groupName).toBe("After");
    const updated = await TravelGroup.findById(group._id);
    expect(updated!.groupName).toBe("After");
    await TravelGroup.deleteOne({ _id: group._id });
    await User.deleteOne({ _id: leader._id });
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
      leaderID: leader._id,
      membersList: [leader._id, member._id],
    });
    mockGetServerSession.mockResolvedValue({
      user: { id: member._id.toString() },
      expires: "",
    });
    const res = await POSTMember(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newUser.email }),
      }),
      { params: paramsManage({ groupId: group._id.toString() }) },
    );
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error).toMatch(/leader/i);
    const unchanged = await TravelGroup.findById(group._id);
    expect(
      unchanged!.membersList.map((id: mongoose.Types.ObjectId) =>
        id.toString(),
      ),
    ).toHaveLength(2);
    await TravelGroup.deleteOne({ _id: group._id });
    await User.deleteMany({
      _id: { $in: [leader._id, member._id, newUser._id] },
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
      leaderID: leader._id,
      membersList: [leader._id, member._id],
    });
    mockGetServerSession.mockResolvedValue({
      user: { id: leader._id.toString() },
      expires: "",
    });
    const res = await POSTMember(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: member.email }),
      }),
      { params: paramsManage({ groupId: group._id.toString() }) },
    );
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/already in the group/i);
    await TravelGroup.deleteOne({ _id: group._id });
    await User.deleteMany({ _id: { $in: [leader._id, member._id] } });
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
      leaderID: leader._id,
      membersList: [leader._id],
    });
    mockGetServerSession.mockResolvedValue({
      user: { id: leader._id.toString() },
      expires: "",
    });
    const res = await POSTMember(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newUser.email }),
      }),
      { params: paramsManage({ groupId: group._id.toString() }) },
    );
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.group.membersList).toContain(newUser._id.toString());
    const updated = await TravelGroup.findById(group._id);
    expect(
      updated!.membersList.map((id: mongoose.Types.ObjectId) => id.toString()),
    ).toContain(newUser._id.toString());
    await TravelGroup.deleteOne({ _id: group._id });
    await User.deleteMany({ _id: { $in: [leader._id, newUser._id] } });
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
      leaderID: leader._id,
      membersList: [leader._id, member._id],
    });
    mockGetServerSession.mockResolvedValue({
      user: { id: member._id.toString() },
      expires: "",
    });
    const res = await DELETEMember(new Request("http://localhost"), {
      params: paramsManage({
        groupId: group._id.toString(),
        memberId: leader._id.toString(),
      }),
    });
    const data = await res.json();
    expect(res.status).toBe(403);
    await TravelGroup.deleteOne({ _id: group._id });
    await User.deleteMany({ _id: { $in: [leader._id, member._id] } });
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
      leaderID: leader._id,
      membersList: [leader._id],
    });
    mockGetServerSession.mockResolvedValue({
      user: { id: leader._id.toString() },
      expires: "",
    });
    const res = await DELETEMember(new Request("http://localhost"), {
      params: paramsManage({
        groupId: group._id.toString(),
        memberId: leader._id.toString(),
      }),
    });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/cannot remove.*leader/i);
    await TravelGroup.deleteOne({ _id: group._id });
    await User.deleteOne({ _id: leader._id });
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
      leaderID: leader._id,
      membersList: [leader._id, member._id],
    });
    mockGetServerSession.mockResolvedValue({
      user: { id: leader._id.toString() },
      expires: "",
    });
    const res = await DELETEMember(new Request("http://localhost"), {
      params: paramsManage({
        groupId: group._id.toString(),
        memberId: member._id.toString(),
      }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.group.membersList).not.toContain(member._id.toString());
    const updated = await TravelGroup.findById(group._id);
    expect(
      updated!.membersList.map((id: mongoose.Types.ObjectId) => id.toString()),
    ).not.toContain(member._id.toString());
    expect(updated!.membersList).toHaveLength(1);
    await TravelGroup.deleteOne({ _id: group._id });
    await User.deleteMany({ _id: { $in: [leader._id, member._id] } });
  });
});

describe("PATCH /api/groups/[groupId]/leader", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await PATCHLeader(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ newLeaderId: "507f1f77bcf86cd799439011" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: paramsManage({ groupId: "507f1f77bcf86cd799439011" }) },
    );
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toMatch(/logged in/i);
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
      leaderID: leader._id,
      membersList: [leader._id, member._id],
    });
    mockGetServerSession.mockResolvedValue({
      user: { id: member._id.toString() },
      expires: "",
    });
    const res = await PATCHLeader(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ newLeaderId: leader._id.toString() }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: paramsManage({ groupId: group._id.toString() }) },
    );
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error).toMatch(/only the group leader/i);
    const unchanged = await TravelGroup.findById(group._id);
    expect((unchanged!.leaderID as mongoose.Types.ObjectId).toString()).toBe(
      leader._id.toString(),
    );
    await TravelGroup.deleteOne({ _id: group._id });
    await User.deleteMany({ _id: { $in: [leader._id, member._id] } });
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
      leaderID: leader._id,
      membersList: [leader._id, member._id],
    });
    mockGetServerSession.mockResolvedValue({
      user: { id: leader._id.toString() },
      expires: "",
    });
    const res = await PATCHLeader(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ newLeaderId: leader._id.toString() }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: paramsManage({ groupId: group._id.toString() }) },
    );
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/yourself/i);
    const unchanged = await TravelGroup.findById(group._id);
    expect((unchanged!.leaderID as mongoose.Types.ObjectId).toString()).toBe(
      leader._id.toString(),
    );
    await TravelGroup.deleteOne({ _id: group._id });
    await User.deleteMany({ _id: { $in: [leader._id, member._id] } });
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
      leaderID: leader._id,
      membersList: [leader._id, member._id],
    });
    mockGetServerSession.mockResolvedValue({
      user: { id: leader._id.toString() },
      expires: "",
    });
    const res = await PATCHLeader(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ newLeaderId: outsider._id.toString() }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: paramsManage({ groupId: group._id.toString() }) },
    );
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/not a member/i);
    const unchanged = await TravelGroup.findById(group._id);
    expect((unchanged!.leaderID as mongoose.Types.ObjectId).toString()).toBe(
      leader._id.toString(),
    );
    await TravelGroup.deleteOne({ _id: group._id });
    await User.deleteMany({
      _id: { $in: [leader._id, member._id, outsider._id] },
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
      leaderID: leader._id,
      membersList: [leader._id, member._id],
    });
    mockGetServerSession.mockResolvedValue({
      user: { id: leader._id.toString() },
      expires: "",
    });
    const res = await PATCHLeader(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ newLeaderId: member._id.toString() }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: paramsManage({ groupId: group._id.toString() }) },
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.group).toBeDefined();
    expect(data.group.leaderID).toBe(member._id.toString());
    const updated = await TravelGroup.findById(group._id);
    expect((updated!.leaderID as mongoose.Types.ObjectId).toString()).toBe(
      member._id.toString(),
    );
    await TravelGroup.deleteOne({ _id: group._id });
    await User.deleteMany({ _id: { $in: [leader._id, member._id] } });
  });
});

describe("POST /api/groups/[groupId]/leave", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POSTLeave(new Request("http://localhost", { method: "POST" }), {
      params: params({ groupId: "507f1f77bcf86cd799439011" }),
    });
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toMatch(/logged in/i);
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
      leaderID: leader._id,
      membersList: [leader._id, member._id],
    });
    mockGetServerSession.mockResolvedValue({
      user: { id: member._id.toString() },
      expires: "",
    });
    const res = await POSTLeave(new Request("http://localhost", { method: "POST" }), {
      params: params({ groupId: group._id.toString() }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.group).toBeDefined();
    expect(data.group.membersList).not.toContain(member._id.toString());
    const updated = await TravelGroup.findById(group._id);
    expect(updated!.membersList.map((id: mongoose.Types.ObjectId) => id.toString())).not.toContain(
      member._id.toString()
    );
    expect(updated!.membersList).toHaveLength(1);
    await TravelGroup.deleteOne({ _id: group._id });
    await User.deleteMany({ _id: { $in: [leader._id, member._id] } });
  });

  it("returns 400 when leader tries to leave and other members exist", async () => {
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
      leaderID: leader._id,
      membersList: [leader._id, member._id],
    });
    mockGetServerSession.mockResolvedValue({
      user: { id: leader._id.toString() },
      expires: "",
    });
    const res = await POSTLeave(new Request("http://localhost", { method: "POST" }), {
      params: params({ groupId: group._id.toString() }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.group).toBeDefined();
    expect(data.group.leaderID).toBe(member._id.toString());
    const updated = await TravelGroup.findById(group._id);
    expect((updated!.leaderID as mongoose.Types.ObjectId).toString()).toBe(
      member._id.toString()
    );
    expect(updated!.membersList.map((id: mongoose.Types.ObjectId) => id.toString())).not.toContain(
      leader._id.toString()
    );
    await TravelGroup.deleteOne({ _id: group._id });
    await User.deleteMany({ _id: { $in: [leader._id, member._id] } });
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
      leaderID: leader._id,
      membersList: [leader._id],
    });
    mockGetServerSession.mockResolvedValue({
      user: { id: leader._id.toString() },
      expires: "",
    });
    const res = await POSTLeave(new Request("http://localhost", { method: "POST" }), {
      params: params({ groupId: group._id.toString() }),
    });
    expect(res.status).toBe(200);
    const deleted = await TravelGroup.findById(group._id);
    expect(deleted).toBeNull();
    await User.deleteOne({ _id: leader._id });
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
      leaderID: leader._id,
      membersList: [leader._id, member._id],
    });
    mockGetServerSession.mockResolvedValue({
      user: { id: member._id.toString() },
      expires: "",
    });
    const leaveRes = await POSTLeave(new Request("http://localhost", { method: "POST" }), {
      params: params({ groupId: group._id.toString() }),
    });
    expect(leaveRes.status).toBe(200);
    const getRes = await GETGroup(new Request("http://localhost"), {
      params: params({ groupId: group._id.toString() }),
    });
    expect(getRes.status).toBe(403);
    const leaveAgainRes = await POSTLeave(new Request("http://localhost", { method: "POST" }), {
      params: params({ groupId: group._id.toString() }),
    });
    expect(leaveAgainRes.status).toBe(403);
    await TravelGroup.deleteOne({ _id: group._id });
    await User.deleteMany({ _id: { $in: [leader._id, member._id] } });
  });
});
