import { jest } from "@jest/globals";
import mongoose from "mongoose";

// declare vars here so they are in scope for the tests
let POST: any;
let User: any, TravelGroup: any, dbConnect: any, bcrypt: any;
let mockGetServerSession: any;

await jest.unstable_mockModule("next-auth", () => ({
  getServerSession: jest.fn(),
}));

await jest.unstable_mockModule("@/lib/auth", () => ({
  authOptions: {},
}));

const CONNECTION_CLEANUP_DELAY_MS = 500;

beforeAll(async () => {
  // 1. wipe module cache
  jest.resetModules();

  // 2. dynamic imports inside beforeAll so they see TEST_MONGODB_URI
  const nextAuth = (await import("next-auth")) as any;
  mockGetServerSession = nextAuth.getServerSession as any;

  ({ default: bcrypt } = await import("bcryptjs"));
  ({ default: dbConnect } = await import("@/lib/dbConnect"));
  ({ default: User } = await import("@/models/User"));
  ({ default: TravelGroup } = await import("@/models/TravelGroup"));

  // 3. connect
  await dbConnect();

  await TravelGroup.deleteMany({});
  await User.deleteMany({});

  // sync indexes to manage race conditions
  await User.syncIndexes();
  await TravelGroup.syncIndexes();

  try {
    const db = mongoose.connection.db;
    if (db) {
      await db.collection("travelgroups").dropIndex("chatLogs.messageID_1");
    }
  } catch (error) {
    // index might not exist
  }

  const createRoute = await import("@/app/api/groups/create/route");
  POST = createRoute.POST;
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

  jest.resetModules();
  jest.clearAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── TESTS ────────────────────────────────────────────────────────────────────

describe("POST /api/groups/create", () => {
  it("rejects unauthenticated requests with 401", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const req = new Request("http://localhost/api/groups/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupName: "My Group" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toMatch(/logged in/i);
  });

  it("creates a group with creator as leader and in membersList", async () => {
    const passwordHash = await bcrypt.hash("password123", 10);
    const user = await User.create({
      username: "groupleader",
      email: "leader@test.com",
      passwordHash,
      school: "Purdue",
    });
    const userId = user.userId.toString();

    mockGetServerSession.mockResolvedValue({
      user: { userId: userId, email: "leader@test.com", name: "groupleader" },
      expires: "9999-12-31T23:59:59.999Z",
    });

    const req = new Request("http://localhost/api/groups/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupName: "Test Travel Group" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.group).toBeDefined();
    expect(data.group.leaderID).toBe(userId);

    const memberIds = data.group.membersList.map((m: any) => m.userId);
    expect(memberIds).toContain(userId);
    expect(data.group.groupName).toBe("Test Travel Group");

    const saved = await TravelGroup.findOne({ groupID: data.group.groupID });
    expect(saved).not.toBeNull();
    expect(saved!.leaderID.toString()).toBe(userId);
    expect(saved!.membersList.map((m: any) => m.userId.toString())).toContain(
      userId,
    );

    await User.deleteOne({ userId: user.userId });
    await TravelGroup.deleteOne({ groupID: data.group.groupID });
  });

  it("allows duplicate group names and assigns unique groupID", async () => {
    const passwordHash = await bcrypt.hash("password456", 10);
    const user = await User.create({
      username: "duplicateuser",
      email: "dup@test.com",
      passwordHash,
      school: "Purdue",
    });
    const userId = user.userId.toString();

    mockGetServerSession.mockResolvedValue({
      user: { userId: userId, email: "dup@test.com", name: "duplicateuser" },
      expires: "9999-12-31T23:59:59.999Z",
    });

    const body = JSON.stringify({ groupName: "Same Name Group" });
    const req1 = new Request("http://localhost/api/groups/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const req2 = new Request("http://localhost/api/groups/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    const res1 = await POST(req1);
    const res2 = await POST(req2);
    const data1 = await res1.json();
    const data2 = await res2.json();

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(data1.group.groupID).toBeDefined();
    expect(data2.group.groupID).toBeDefined();
    expect(data1.group.groupID).not.toBe(data2.group.groupID);

    await User.deleteOne({ userId: user.userId });
    await TravelGroup.deleteMany({ groupName: "Same Name Group" });
  });
});
