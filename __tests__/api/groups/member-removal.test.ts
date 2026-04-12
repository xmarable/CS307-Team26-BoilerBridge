/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests for User Story #2 — Member Removal
 *
 * Acceptance criteria verified here:
 *  AC1: Given I am the group leader, when I remove a member, they are kicked immediately.
 *  AC2: Given I am a regular Admin or Viewer, the remove endpoint is forbidden (403).
 *  AC3: Given a user is removed, when they try to access the group link, they get 403.
 */

import { jest } from "@jest/globals";
import mongoose from "mongoose";

await jest.unstable_mockModule("next-auth", () => ({
  getServerSession: jest.fn(),
}));

await jest.unstable_mockModule("@/lib/auth", () => ({
  authOptions: {},
}));

function params(p: { groupId: string; memberId?: string }) {
  return Promise.resolve(p);
}

const CONNECTION_CLEANUP_DELAY_MS = 500;

let GETGroup: any;
let DELETEMember: any;
let User: any;
let TravelGroup: any;
let dbConnect: any;
let bcrypt: any;
let mockGetServerSession: jest.MockedFunction<any>;

beforeAll(async () => {
  jest.resetModules();

  const nextAuth = await import("next-auth");
  mockGetServerSession = nextAuth.getServerSession as any;

  ({ default: bcrypt } = await import("bcryptjs"));
  ({ default: dbConnect } = await import("@/lib/dbConnect"));
  ({ default: User } = await import("@/models/User"));
  ({ default: TravelGroup } = await import("@/models/TravelGroup"));

  await dbConnect();

  const groupIdRoute = await import("@/app/api/groups/[groupId]/route");
  GETGroup = groupIdRoute.GET as any;

  const memberIdRoute =
    await import("@/app/api/groups/[groupId]/members/[memberId]/route");
  DELETEMember = memberIdRoute.DELETE as any;
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

// ─── AC1: Leader can remove a member immediately ───────────────────────────

describe("AC1 — leader removes a member", () => {
  it("returns 200 and member is absent from the updated membersList", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const leader = await User.create({
      username: "ac1_leader",
      email: "ac1_leader@test.com",
      passwordHash,
      school: "Purdue",
    });
    const member = await User.create({
      username: "ac1_member",
      email: "ac1_member@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "AC1 Group",
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
      params: params({
        groupId: group.groupID.toString(),
        memberId: member.userId.toString(),
      }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);

    // response body should not contain the removed member
    const returnedIds = data.group.membersList.map((m: any) =>
      m.userId.toString(),
    );
    expect(returnedIds).not.toContain(member.userId.toString());

    // database should reflect the removal immediately
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
});

// ─── AC2: Admin / Viewer cannot trigger member removal ─────────────────────

describe("AC2 — non-leader cannot remove members", () => {
  it("returns 403 when an Admin attempts to remove a Viewer", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const leader = await User.create({
      username: "ac2_leader",
      email: "ac2_leader@test.com",
      passwordHash,
      school: "Purdue",
    });
    const admin = await User.create({
      username: "ac2_admin",
      email: "ac2_admin@test.com",
      passwordHash,
      school: "Purdue",
    });
    const viewer = await User.create({
      username: "ac2_viewer",
      email: "ac2_viewer@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "AC2 Group",
      leaderID: leader.userId,
      membersList: [
        { userId: leader.userId, role: "Leader" },
        { userId: admin.userId, role: "Admin" },
        { userId: viewer.userId, role: "Viewer" },
      ],
    });

    // admin tries to remove the viewer — should be rejected
    mockGetServerSession.mockResolvedValue({
      user: { userId: admin.userId.toString() },
      expires: "",
    });

    const res = await DELETEMember(new Request("http://localhost"), {
      params: params({
        groupId: group.groupID.toString(),
        memberId: viewer.userId.toString(),
      }),
    });

    expect(res.status).toBe(403);

    // viewer must still be in the group
    const unchanged = await TravelGroup.findOne({
      groupID: group.groupID.toString(),
    });
    const dbIds = unchanged!.membersList.map((m: any) => m.userId.toString());
    expect(dbIds).toContain(viewer.userId.toString());
    expect(unchanged!.membersList).toHaveLength(3);

    await TravelGroup.deleteOne({ groupID: group.groupID.toString() });
    await User.deleteMany({
      userId: {
        $in: [
          leader.userId.toString(),
          admin.userId.toString(),
          viewer.userId.toString(),
        ],
      },
    });
  });

  it("returns 403 when a Viewer attempts to remove another member", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const leader = await User.create({
      username: "ac2v_leader",
      email: "ac2v_leader@test.com",
      passwordHash,
      school: "Purdue",
    });
    const viewer = await User.create({
      username: "ac2v_viewer",
      email: "ac2v_viewer@test.com",
      passwordHash,
      school: "Purdue",
    });
    const target = await User.create({
      username: "ac2v_target",
      email: "ac2v_target@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "AC2V Group",
      leaderID: leader.userId,
      membersList: [
        { userId: leader.userId, role: "Leader" },
        { userId: viewer.userId, role: "Viewer" },
        { userId: target.userId, role: "Viewer" },
      ],
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId: viewer.userId.toString() },
      expires: "",
    });

    const res = await DELETEMember(new Request("http://localhost"), {
      params: params({
        groupId: group.groupID.toString(),
        memberId: target.userId.toString(),
      }),
    });

    expect(res.status).toBe(403);

    const unchanged = await TravelGroup.findOne({
      groupID: group.groupID.toString(),
    });
    expect(unchanged!.membersList).toHaveLength(3);

    await TravelGroup.deleteOne({ groupID: group.groupID.toString() });
    await User.deleteMany({
      userId: {
        $in: [
          leader.userId.toString(),
          viewer.userId.toString(),
          target.userId.toString(),
        ],
      },
    });
  });
});

// ─── AC3: Removed user loses access to the group immediately ───────────────

describe("AC3 — removed user cannot access group", () => {
  it("returns 403 on GET /api/groups/[groupId] after removal", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const leader = await User.create({
      username: "ac3_leader",
      email: "ac3_leader@test.com",
      passwordHash,
      school: "Purdue",
    });
    const member = await User.create({
      username: "ac3_member",
      email: "ac3_member@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "AC3 Group",
      leaderID: leader.userId,
      membersList: [
        { userId: leader.userId, role: "Leader" },
        { userId: member.userId, role: "Viewer" },
      ],
    });

    // step 1: leader removes the member
    mockGetServerSession.mockResolvedValue({
      user: { userId: leader.userId.toString() },
      expires: "",
    });

    const removeRes = await DELETEMember(new Request("http://localhost"), {
      params: params({
        groupId: group.groupID.toString(),
        memberId: member.userId.toString(),
      }),
    });
    expect(removeRes.status).toBe(200);

    // step 2: removed member tries to access the group — must get 403
    mockGetServerSession.mockResolvedValue({
      user: { userId: member.userId.toString() },
      expires: "",
    });

    const accessRes = await GETGroup(new Request("http://localhost"), {
      params: params({ groupId: group.groupID.toString() }),
    });
    const accessData = await accessRes.json();

    expect(accessRes.status).toBe(403);
    expect(accessData.error).toMatch(/do not have access/i);

    await TravelGroup.deleteOne({ groupID: group.groupID.toString() });
    await User.deleteMany({
      userId: { $in: [leader.userId.toString(), member.userId.toString()] },
    });
  });

  it("unauthenticated request returns 401 (not a bypass)", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const leader = await User.create({
      username: "ac3u_leader",
      email: "ac3u_leader@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "AC3U Group",
      leaderID: leader.userId,
      membersList: [{ userId: leader.userId, role: "Leader" }],
    });

    mockGetServerSession.mockResolvedValue(null);

    const res = await GETGroup(new Request("http://localhost"), {
      params: params({ groupId: group.groupID.toString() }),
    });

    expect(res.status).toBe(401);

    await TravelGroup.deleteOne({ groupID: group.groupID.toString() });
    await User.deleteOne({ userId: leader.userId.toString() });
  });
});
