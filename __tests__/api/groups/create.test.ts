/** @jest-environment node */
import { jest } from "@jest/globals";
import bcrypt from "bcryptjs";
import type { Types } from "mongoose";

jest.unstable_mockModule("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.unstable_mockModule("@/lib/auth", () => ({
  authOptions: {},
}));

const { default: mongoose } = await import("mongoose");
const { default: dbConnect } = await import("@/lib/dbConnect");
const { default: User } = await import("@/models/User");
const { default: TravelGroup } = await import("@/models/TravelGroup");
const { getServerSession } = await import("next-auth");
const { POST } = await import("@/app/api/groups/create/route");

const mockGetServerSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;

const CONNECTION_CLEANUP_DELAY_MS = 500;

beforeAll(async () => {
  await dbConnect();

  try {
    await mongoose.connection
      .collection("travelgroups")
      .dropIndex("chatLogs.messageID_1");
  } catch (error) {}
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await TravelGroup.deleteMany({});
    await User.deleteMany({});

    await mongoose.connection.close(true);
  }
  await mongoose.disconnect();

  if ((global as any).mongoose) {
    (global as any).mongoose.conn = null;
    (global as any).mongoose.promise = null;
  }

  await new Promise((resolve) => {
    const timer = setTimeout(resolve, CONNECTION_CLEANUP_DELAY_MS);
    timer.unref();
  });
});

beforeEach(() => {
  jest.clearAllMocks();
});

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
    const userId = user._id.toString();

    mockGetServerSession.mockResolvedValue({
      user: { id: userId },
      expires: "",
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
    expect(data.group.membersList).toContain(userId);
    expect(data.group.groupName).toBe("Test Travel Group");

    const saved = await TravelGroup.findById(data.group._id);
    expect(saved).not.toBeNull();
    expect(saved!.leaderID.toString()).toBe(userId);
    expect(
      saved!.membersList.map((id: Types.ObjectId) => id.toString()),
    ).toContain(userId);

    await User.deleteOne({ _id: user._id });
    await TravelGroup.deleteOne({ _id: data.group._id });
  });

  it("allows duplicate group names and assigns unique groupID", async () => {
    const passwordHash = await bcrypt.hash("password456", 10);
    const user = await User.create({
      username: "duplicateuser",
      email: "dup@test.com",
      passwordHash,
      school: "Purdue",
    });
    const userId = user._id.toString();

    mockGetServerSession.mockResolvedValue({
      user: { id: userId },
      expires: "",
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

    await User.deleteOne({ _id: user._id });
    await TravelGroup.deleteMany({ groupName: "Same Name Group" });
  });
});
