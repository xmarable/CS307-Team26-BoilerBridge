import { jest } from "@jest/globals";
import mongoose from "mongoose";

let POST: any, GET: any, DELETE: any;
let User: any, TravelGroup: any, dbConnect: any, bcrypt: any;

let mockGetServerSession: jest.Mock<any>;

let groupUUID: string;
let leaderId: string, leaderEmail: string;
let viewerId: string, viewerEmail: string;
let outsiderId: string, outsiderEmail: string;

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

  ({ default: bcrypt } = (await import("bcryptjs")) as any);
  ({ default: dbConnect } = (await import("@/lib/dbConnect")) as any);
  ({ default: User } = (await import("@/models/User")) as any);
  ({ default: TravelGroup } = (await import("@/models/TravelGroup")) as any);

  await dbConnect();
  await TravelGroup.deleteMany({});
  await User.deleteMany({});

  const hash = await bcrypt.hash("pass", 10);

  const leader = await User.create({
    username: "ann_leader",
    email: "ann_leader@test.com",
    passwordHash: hash,
    school: "Purdue",
  });
  const viewer = await User.create({
    username: "ann_viewer",
    email: "ann_viewer@test.com",
    passwordHash: hash,
    school: "Purdue",
  });
  const outsider = await User.create({
    username: "ann_outsider",
    email: "ann_outsider@test.com",
    passwordHash: hash,
    school: "Purdue",
  });

  leaderId = leader.userId.toString();
  leaderEmail = leader.email;
  viewerId = viewer.userId.toString();
  viewerEmail = viewer.email;
  outsiderId = outsider.userId.toString();
  outsiderEmail = outsider.email;

  const group = await TravelGroup.create({
    groupName: "Announcements Test Group",
    leaderID: leaderId,
    membersList: [
      { userId: leaderId, role: "Leader" },
      { userId: viewerId, role: "Viewer" },
    ],
  });

  groupUUID = group.groupID.toString();

  const route =
    (await import("@/app/api/groups/[groupId]/announcements/route")) as any;
  POST = route.POST;
  GET = route.GET;
  DELETE = route.DELETE;
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
  return new Request(`http://localhost/api/groups/${gId}/announcements`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetReq(gId: string) {
  return new Request(`http://localhost/api/groups/${gId}/announcements`);
}

function makeDeleteReq(gId: string, body: object) {
  return new Request(`http://localhost/api/groups/${gId}/announcements`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ctx = (gId: string) => ({
  params: Promise.resolve({ groupId: gId }),
});

describe("POST /api/groups/:groupId/announcements", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(
      makePostReq(groupUUID, { content: "hi" }),
      ctx(groupUUID),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when a regular viewer tries to pin", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { email: viewerEmail },
      expires: "9999",
    });
    const res = await POST(
      makePostReq(groupUUID, { content: "viewer trying to post" }),
      ctx(groupUUID),
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when content is empty", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { email: leaderEmail },
      expires: "9999",
    });
    const res = await POST(
      makePostReq(groupUUID, { content: "   " }),
      ctx(groupUUID),
    );
    expect(res.status).toBe(400);
  });

  it("leader can create an announcement", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { email: leaderEmail },
      expires: "9999",
    });
    const res = await POST(
      makePostReq(groupUUID, { content: "Trip is confirmed for July!" }),
      ctx(groupUUID),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.content).toBe("Trip is confirmed for July!");
    expect(data.pinnedBy).toBeDefined();
  });
});

describe("GET /api/groups/:groupId/announcements", () => {
  it("returns announcements sorted newest first", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { email: leaderEmail },
      expires: "9999",
    });
    await POST(
      makePostReq(groupUUID, { content: "Second announcement" }),
      ctx(groupUUID),
    );

    const res = await GET(makeGetReq(groupUUID), ctx(groupUUID));
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    if (list.length > 1) {
      const t0 = new Date(list[0].timestamp).getTime();
      const t1 = new Date(list[1].timestamp).getTime();
      expect(t0).toBeGreaterThanOrEqual(t1);
    }
  });

  it("returns 404 for a group that does not exist", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await GET(makeGetReq(fakeId), ctx(fakeId));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/groups/:groupId/announcements", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await DELETE(
      makeDeleteReq(groupUUID, { announcementID: "some-id" }),
      ctx(groupUUID),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when announcementID is missing", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { email: leaderEmail },
      expires: "9999",
    });
    const res = await DELETE(makeDeleteReq(groupUUID, {}), ctx(groupUUID));
    expect(res.status).toBe(400);
  });

  it("returns 403 when a viewer tries to delete", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { email: viewerEmail },
      expires: "9999",
    });
    const res = await DELETE(
      makeDeleteReq(groupUUID, { announcementID: "any-id" }),
      ctx(groupUUID),
    );
    expect(res.status).toBe(403);
  });

  it("leader can delete an existing announcement", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { email: leaderEmail },
      expires: "9999",
    });
    const created = await POST(
      makePostReq(groupUUID, { content: "to be deleted" }),
      ctx(groupUUID),
    );
    const ann = await created.json();
    const annId = ann.announcementID;

    const res = await DELETE(
      makeDeleteReq(groupUUID, { announcementID: annId }),
      ctx(groupUUID),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});
