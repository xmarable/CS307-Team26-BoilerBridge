import { jest } from "@jest/globals";
import mongoose from "mongoose";

let GET: any, POST: any;
let User: any, TravelGroup: any, dbConnect: any, bcrypt: any;
let mockGetServerSession: jest.MockedFunction<any>;

let userId: string, otherUserId: string;

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

  const hash = await bcrypt.hash("password123", 10);

  const u1 = await User.create({
    username: "groups_user1",
    email: "groups_user1@test.com",
    passwordHash: hash,
    school: "Purdue",
  });
  const u2 = await User.create({
    username: "groups_user2",
    email: "groups_user2@test.com",
    passwordHash: hash,
    school: "Purdue",
  });

  userId = u1.userId.toString();
  otherUserId = u2.userId.toString();

  const route = await import("@/app/api/groups/route");
  GET = route.GET;
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

function makeGet() {
  return new Request("http://localhost/api/groups");
}

function makePost(body: object) {
  return new Request("http://localhost/api/groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/groups", () => {
  it("returns 401 when not logged in", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it("returns an empty list when user has no groups", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: otherUserId },
      expires: "9999",
    });
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.groups)).toBe(true);
    expect(data.groups.length).toBe(0);
  });

  it("returns only groups the user belongs to", async () => {
    // create a group for userId
    await TravelGroup.create({
      groupName: "My Group",
      leaderID: userId,
      membersList: [{ userId, role: "Leader" }],
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId },
      expires: "9999",
    });
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.groups.length).toBeGreaterThanOrEqual(1);
    expect(data.groups.every((g: any) => g.groupName)).toBe(true);
  });
});

describe("POST /api/groups", () => {
  it("returns 401 when not logged in", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(makePost({ groupName: "Test" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when groupName is missing", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId },
      expires: "9999",
    });
    const res = await POST(makePost({}));
    expect(res.status).toBe(400);
  });

  it("creates a group and returns 201 with group data", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId },
      expires: "9999",
    });
    const res = await POST(
      makePost({ groupName: "Road Trip", description: "cross country" }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.group.groupName).toBe("Road Trip");
    expect(data.group.description).toBe("cross country");
    expect(data.group.membersList.length).toBe(1);
  });

  it("creator is automatically added as Leader", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId },
      expires: "9999",
    });
    const res = await POST(makePost({ groupName: "Solo Group" }));
    expect(res.status).toBe(201);
    const data = await res.json();
    const leader = data.group.membersList[0];
    expect(leader.role).toBe("Leader");
  });
});
