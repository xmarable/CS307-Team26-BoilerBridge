import { jest } from "@jest/globals";
import mongoose from "mongoose";

let POST: any, GET: any;
let User: any, TravelGroup: any, dbConnect: any, bcrypt: any;
let mockGetServerSession: jest.Mock<any>;

let groupUUID: string;
let memberId: string, memberEmail: string;
let outsiderId: string;

await jest.unstable_mockModule("next-auth", () => ({
  getServerSession: jest.fn(),
}));

await jest.unstable_mockModule("@/lib/auth", () => ({
  authOptions: {},
}));

beforeAll(async () => {
  jest.resetModules();

  const nextAuth = (await import("next-auth")) as any;
  mockGetServerSession = nextAuth.getServerSession as any;

  ({ default: bcrypt } = await import("bcryptjs"));
  ({ default: dbConnect } = await import("@/lib/dbConnect"));
  ({ default: User } = await import("@/models/User"));
  ({ default: TravelGroup } = await import("@/models/TravelGroup"));

  await dbConnect();
  await TravelGroup.deleteMany({});
  await User.deleteMany({});

  const hash = await bcrypt.hash("pass", 10);

  const member = await User.create({
    username: "chat_member",
    email: "chat_member@test.com",
    passwordHash: hash,
    school: "Purdue",
  });
  const outsider = await User.create({
    username: "chat_outsider",
    email: "chat_outsider@test.com",
    passwordHash: hash,
    school: "Purdue",
  });

  memberId = member.userId.toString();
  memberEmail = member.email;
  outsiderId = outsider.userId.toString();

  const group = await TravelGroup.create({
    groupName: "Messages Test Group",
    leaderID: memberId,
    membersList: [{ userId: memberId, role: "Leader" }],
  });

  groupUUID = group.groupID.toString();

  const route = await import("@/app/api/groups/[groupId]/messages/route");
  POST = route.POST;
  GET = route.GET;
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

function makePostReq(gId: string, body: object) {
  return new Request(`http://localhost/api/groups/${gId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetReq(gId: string, query = "") {
  return new Request(`http://localhost/api/groups/${gId}/messages${query}`);
}

const ctx = (gId: string) => ({
  params: Promise.resolve({ groupId: gId }),
});

describe("POST /api/groups/:groupId/messages", () => {
  it("returns 401 when the session is missing", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(
      makePostReq(groupUUID, { content: "hello" }),
      ctx(groupUUID),
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when the user is not a group member", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: outsiderId },
      expires: "9999",
    });
    const res = await POST(
      makePostReq(groupUUID, { content: "sneaking in" }),
      ctx(groupUUID),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when content is empty", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const res = await POST(
      makePostReq(groupUUID, { content: "" }),
      ctx(groupUUID),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when content exceeds 2000 characters", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const res = await POST(
      makePostReq(groupUUID, { content: "x".repeat(2001) }),
      ctx(groupUUID),
    );
    expect(res.status).toBe(400);
  });

  it("member can send a message and gets 201", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const res = await POST(
      makePostReq(groupUUID, { content: "Leaving at 8am!" }),
      ctx(groupUUID),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.message.content).toBe("Leaving at 8am!");
    expect(data.message.senderID).toBe(memberId);
  });
});

describe("GET /api/groups/:groupId/messages", () => {
  it("returns 401 for non-members", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: outsiderId },
      expires: "9999",
    });
    const res = await GET(makeGetReq(groupUUID), ctx(groupUUID));
    expect(res.status).toBe(401);
  });

  it("returns messages array with pagination fields", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const res = await GET(makeGetReq(groupUUID), ctx(groupUUID));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.messages)).toBe(true);
    expect(typeof data.hasMore).toBe("boolean");
  });

  it("messages are returned in ascending timestamp order", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });

    // send two more messages to give us something to check order on
    await POST(makePostReq(groupUUID, { content: "msg A" }), ctx(groupUUID));
    await POST(makePostReq(groupUUID, { content: "msg B" }), ctx(groupUUID));

    const res = await GET(makeGetReq(groupUUID), ctx(groupUUID));
    const data = await res.json();
    const msgs = data.messages;
    if (msgs.length > 1) {
      const ascending = msgs.every((m: any, i: number) => {
        if (i === 0) return true;
        return (
          new Date(m.timestamp).getTime() >=
          new Date(msgs[i - 1].timestamp).getTime()
        );
      });
      expect(ascending).toBe(true);
    }
  });
});
