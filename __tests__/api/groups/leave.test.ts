import { jest } from "@jest/globals";
import mongoose from "mongoose";

let POST: any;
let User: any, TravelGroup: any, dbConnect: any, bcrypt: any;
let mockGetServerSession: jest.MockedFunction<any>;

let leaderId: string, memberId: string, outsiderId: string;

await jest.unstable_mockModule("next-auth", () => ({
  getServerSession: jest.fn(),
}));

await jest.unstable_mockModule("@/lib/auth", () => ({
  authOptions: {},
}));

beforeAll(async () => {
  jest.resetModules();

  const nextAuth = await import("next-auth");
  mockGetServerSession = nextAuth.getServerSession as any;

  ({ default: bcrypt } = await import("bcryptjs"));
  ({ default: dbConnect } = await import("@/lib/dbConnect"));
  ({ default: User } = await import("@/models/User"));
  ({ default: TravelGroup } = await import("@/models/TravelGroup"));

  await dbConnect();
  await TravelGroup.deleteMany({});
  await User.deleteMany({});

  const hash = await bcrypt.hash("pass", 10);

  const leader = await User.create({
    username: "leave_leader",
    email: "leave_leader@test.com",
    passwordHash: hash,
    school: "Purdue",
  });
  const member = await User.create({
    username: "leave_member",
    email: "leave_member@test.com",
    passwordHash: hash,
    school: "Purdue",
  });
  const outsider = await User.create({
    username: "leave_outsider",
    email: "leave_outsider@test.com",
    passwordHash: hash,
    school: "Purdue",
  });

  leaderId = leader.userId.toString();
  memberId = member.userId.toString();
  outsiderId = outsider.userId.toString();

  const route = await import("@/app/api/groups/[groupId]/leave/route");
  POST = route.POST;
});

afterAll(async () => {
  await TravelGroup?.deleteMany({});
  await User?.deleteMany({});
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if ((global as any).mongoose) {
    (global as any).mongoose.conn = null;
    (global as any).mongoose.promise = null;
  }
  jest.clearAllMocks();
});

beforeEach(() => jest.clearAllMocks());

async function freshGroup(extraMembers: { userId: string; role: string }[] = []) {
  const group = await TravelGroup.create({
    groupName: "Leave Test Group",
    leaderID: leaderId,
    membersList: [
      { userId: leaderId, role: "Leader" },
      ...extraMembers,
    ],
  });
  return group.groupID.toString();
}

function makeReq(gId: string) {
  return new Request(`http://localhost/api/groups/${gId}/leave`, {
    method: "POST",
  });
}

const ctx = (gId: string) => ({
  params: Promise.resolve({ groupId: gId }),
});

describe("POST /api/groups/:groupId/leave", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const gId = await freshGroup();
    const res = await POST(makeReq(gId), ctx(gId));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not a group member", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: outsiderId },
      expires: "9999",
    });
    const gId = await freshGroup();
    const res = await POST(makeReq(gId), ctx(gId));
    expect(res.status).toBe(403);
  });

  it("regular member leaves and is removed from membersList", async () => {
    const gId = await freshGroup([{ userId: memberId, role: "Viewer" }]);

    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const res = await POST(makeReq(gId), ctx(gId));
    expect(res.status).toBe(200);
    const data = await res.json();
    const stillInGroup = data.group.membersList.some(
      (m: any) => m.userId === memberId,
    );
    expect(stillInGroup).toBe(false);
  });

  it("sole leader leaving deletes the group entirely", async () => {
    const gId = await freshGroup(); // only the leader

    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await POST(makeReq(gId), ctx(gId));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toMatch(/deleted/i);

    const gone = await TravelGroup.findOne({ groupID: gId });
    expect(gone).toBeNull();
  });

  it("leader leaving with other members transfers leadership", async () => {
    const gId = await freshGroup([{ userId: memberId, role: "Viewer" }]);

    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await POST(makeReq(gId), ctx(gId));
    expect(res.status).toBe(200);
    const data = await res.json();

    // old leader no longer in group
    const leaderStillIn = data.group.membersList.some(
      (m: any) => m.userId === leaderId,
    );
    expect(leaderStillIn).toBe(false);

    // successor is now leader
    const newLeader = data.group.membersList.find(
      (m: any) => m.role === "Leader",
    );
    expect(newLeader).toBeDefined();
  });
});
