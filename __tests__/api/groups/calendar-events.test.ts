import { jest } from "@jest/globals";
import mongoose from "mongoose";

// types
let GET: any, POST: any, PUT: any, DELETE: any;
let User: any,
  TravelGroup: any,
  CalendarEvent: any,
  dbConnect: any,
  bcrypt: any;
let mockGetServerSession: jest.MockedFunction<any>;

// Use the UUID groupID field (what the routes use to find groups), not MongoDB _id
let groupUUID: string, leaderId: string, memberId: string, outsiderId: string;

await jest.unstable_mockModule("next-auth", () => ({
  getServerSession: jest.fn(),
}));

await jest.unstable_mockModule("@/lib/auth", () => ({
  authOptions: {},
}));

beforeAll(async () => {
  // 1. wipe cache
  jest.resetModules();

  const nextAuth = await import("next-auth");
  mockGetServerSession = nextAuth.getServerSession as any;

  ({ default: bcrypt } = await import("bcryptjs"));
  ({ default: dbConnect } = await import("@/lib/dbConnect"));
  ({ default: User } = await import("@/models/User"));
  ({ default: TravelGroup } = await import("@/models/TravelGroup"));
  ({ default: CalendarEvent } = await import("@/models/CalendarEvent"));

  // 2. connect
  await dbConnect();

  await CalendarEvent.deleteMany({});
  await TravelGroup.deleteMany({});
  await User.deleteMany({});

  const hash = await bcrypt.hash("pass", 10);

  const leader = await User.create({
    username: "cal_leader",
    email: "cal_leader@test.com",
    passwordHash: hash,
    school: "Purdue",
  });
  const member = await User.create({
    username: "cal_member",
    email: "cal_member@test.com",
    passwordHash: hash,
    school: "Purdue",
  });
  const outsider = await User.create({
    username: "cal_outsider",
    email: "cal_outsider@test.com",
    passwordHash: hash,
    school: "Purdue",
  });

  leaderId = leader.userId.toString();
  memberId = member.userId.toString();
  outsiderId = outsider.userId.toString();

  const group = await TravelGroup.create({
    groupName: "Calendar Test Group",
    leaderID: leaderId,
    membersList: [
      { userId: leaderId, role: "Leader" },
      { userId: memberId, role: "Viewer" },
    ],
  });

  // Routes use TravelGroup.findOne({ groupID }) so we need the UUID groupID field
  groupUUID = group.groupID.toString();

  const collectionRoute =
    await import("@/app/api/groups/[groupId]/calendar/events/route");
  GET = collectionRoute.GET;
  POST = collectionRoute.POST;

  const itemRoute =
    await import("@/app/api/groups/[groupId]/calendar/events/[eventId]/route");
  PUT = itemRoute.PUT;
  DELETE = itemRoute.DELETE;
});

afterAll(async () => {
  if (CalendarEvent && TravelGroup && User) {
    await CalendarEvent.deleteMany({});
    await TravelGroup.deleteMany({});
    await User.deleteMany({});
  }

  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();

  if ((global as any).mongoose) {
    (global as any).mongoose.conn = null;
    (global as any).mongoose.promise = null;
  }

  jest.clearAllMocks();
});

beforeEach(() => jest.clearAllMocks());

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeGetRequest(gId: string, query = "") {
  return new Request(
    `http://localhost/api/groups/${gId}/calendar/events${query}`,
  );
}

function makePostRequest(gId: string, body: object) {
  return new Request(`http://localhost/api/groups/${gId}/calendar/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePutRequest(gId: string, eventId: string, body: object) {
  return new Request(
    `http://localhost/api/groups/${gId}/calendar/events/${eventId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function makeDeleteRequest(gId: string, eventId: string) {
  return new Request(
    `http://localhost/api/groups/${gId}/calendar/events/${eventId}`,
    { method: "DELETE" },
  );
}

const futureStart = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();
const futureEnd = () => new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

/** startHoursFromNow avoids overlapping other tests' persisted events. */
const validEvent = (opts?: { title?: string; startHoursFromNow?: number }) => {
  const hours = opts?.startHoursFromNow ?? 1;
  const start = new Date(Date.now() + hours * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    title: opts?.title ?? "Team Dinner",
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    location: "The Capital Grille",
    eventType: "food",
  };
};

// ─── GET ─────────────────────────────────────────────────────────────────────

describe("GET /api/groups/:groupId/calendar/events", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(makeGetRequest(groupUUID), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-members", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: outsiderId },
      expires: "9999",
    });
    const res = await GET(makeGetRequest(groupUUID), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 200 with events array for group members", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const res = await GET(makeGetRequest(groupUUID), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.events)).toBe(true);
  });

  it("returns 200 with events array for group leader", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await GET(makeGetRequest(groupUUID), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(200);
  });

  it("returns 400 for invalid date params", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await GET(
      makeGetRequest(groupUUID, "?from=not-a-date&to=also-not"),
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when to is before from", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const from = new Date(Date.now() + 86400000).toISOString();
    const to = new Date(Date.now()).toISOString();
    const res = await GET(makeGetRequest(groupUUID, `?from=${from}&to=${to}`), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(400);
  });

  it("returns only events within the given date range", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });

    await CalendarEvent.create({
      title: "In Range",
      startTime: new Date(Date.now() + 1 * 86400000),
      endTime: new Date(Date.now() + 2 * 86400000),
      groupId: groupUUID,
      createdBy: leaderId,
    });

    await CalendarEvent.create({
      title: "Out of Range",
      startTime: new Date(Date.now() + 30 * 86400000),
      endTime: new Date(Date.now() + 31 * 86400000),
      groupId: groupUUID,
      createdBy: leaderId,
    });

    const from = new Date().toISOString();
    const to = new Date(Date.now() + 7 * 86400000).toISOString();
    const res = await GET(makeGetRequest(groupUUID, `?from=${from}&to=${to}`), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.events.some((e: any) => e.title === "In Range")).toBe(true);
    expect(data.events.some((e: any) => e.title === "Out of Range")).toBe(
      false,
    );
  });
});

// ─── POST ────────────────────────────────────────────────────────────────────

describe("POST /api/groups/:groupId/calendar/events", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(makePostRequest(groupUUID, validEvent()), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-members", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: outsiderId },
      expires: "9999",
    });
    const res = await POST(makePostRequest(groupUUID, validEvent()), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 when title is missing", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const { title, ...noTitle } = validEvent();
    const res = await POST(makePostRequest(groupUUID, noTitle), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when endTime is before startTime", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await POST(
      makePostRequest(groupUUID, {
        ...validEvent(),
        startTime: futureEnd(),
        endTime: futureStart(),
      }),
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/endTime must be after startTime/i);
  });

  it("returns 400 when endTime equals startTime", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const same = futureStart();
    const res = await POST(
      makePostRequest(groupUUID, {
        ...validEvent(),
        startTime: same,
        endTime: same,
      }),
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(400);
  });

  it("creates an event and returns 201", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await POST(makePostRequest(groupUUID, validEvent()), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.event).toBeDefined();
    expect(data.event.title).toBe("Team Dinner");
    expect(data.event.groupId).toBe(groupUUID);
    expect(data.event.createdBy).toBe(leaderId);
    expect(data.event.source).toBe("manual");
  });

  it("allows a regular member to create an event", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const res = await POST(
      makePostRequest(
        groupUUID,
        validEvent({ title: "Member Event", startHoursFromNow: 72 }),
      ),
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.event.createdBy).toBe(memberId);
  });

  it("returns 409 when new event overlaps an existing one", async () => {
    const base = Date.now() + 86400000 * 20;
    await CalendarEvent.create({
      title: "Existing Slot",
      startTime: new Date(base),
      endTime: new Date(base + 2 * 3600000),
      groupId: groupUUID,
      createdBy: leaderId,
    });
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await POST(
      makePostRequest(groupUUID, {
        title: "Overlap Try",
        startTime: new Date(base + 3600000).toISOString(),
        endTime: new Date(base + 3 * 3600000).toISOString(),
      }),
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.conflictWith?.title).toBe("Existing Slot");
    await CalendarEvent.deleteMany({ title: "Existing Slot" });
  });
});

// ─── PUT ─────────────────────────────────────────────────────────────────────

describe("PUT /api/groups/:groupId/calendar/events/:eventId", () => {
  let leaderEventId: string;
  let memberEventId: string;

  beforeAll(async () => {
    const base = Date.now() + 86400000 * 40;
    const leaderEvent = await CalendarEvent.create({
      title: "Leader Event",
      startTime: new Date(base),
      endTime: new Date(base + 3600000),
      groupId: groupUUID,
      createdBy: leaderId,
    });
    leaderEventId = leaderEvent._id.toString();

    const memberEvent = await CalendarEvent.create({
      title: "Member Event",
      startTime: new Date(base + 2 * 3600000),
      endTime: new Date(base + 3 * 3600000),
      groupId: groupUUID,
      createdBy: memberId,
    });
    memberEventId = memberEvent._id.toString();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await PUT(
      makePutRequest(groupUUID, leaderEventId, { title: "Updated" }),
      {
        params: Promise.resolve({ groupId: groupUUID, eventId: leaderEventId }),
      },
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-members", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: outsiderId },
      expires: "9999",
    });
    const res = await PUT(
      makePutRequest(groupUUID, leaderEventId, { title: "Updated" }),
      {
        params: Promise.resolve({ groupId: groupUUID, eventId: leaderEventId }),
      },
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when non-creator non-leader tries to edit", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const res = await PUT(
      makePutRequest(groupUUID, leaderEventId, { title: "Updated" }),
      {
        params: Promise.resolve({ groupId: groupUUID, eventId: leaderEventId }),
      },
    );
    expect(res.status).toBe(403);
  });

  it("allows creator to update their event", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const res = await PUT(
      makePutRequest(groupUUID, memberEventId, { title: "Updated by Member" }),
      {
        params: Promise.resolve({ groupId: groupUUID, eventId: memberEventId }),
      },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.event.title).toBe("Updated by Member");
  });

  it("returns 409 when update would overlap another event", async () => {
    const base = Date.now() + 86400000 * 25;
    const a = await CalendarEvent.create({
      title: "PutOverlap A",
      startTime: new Date(base + 10 * 3600000),
      endTime: new Date(base + 12 * 3600000),
      groupId: groupUUID,
      createdBy: leaderId,
    });
    const b = await CalendarEvent.create({
      title: "PutOverlap B",
      startTime: new Date(base + 14 * 3600000),
      endTime: new Date(base + 16 * 3600000),
      groupId: groupUUID,
      createdBy: leaderId,
    });
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await PUT(
      makePutRequest(groupUUID, String(b._id), {
        startTime: new Date(base + 11 * 3600000).toISOString(),
        endTime: new Date(base + 13 * 3600000).toISOString(),
      }),
      {
        params: Promise.resolve({
          groupId: groupUUID,
          eventId: String(b._id),
        }),
      },
    );
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.conflictWith?.title).toBe("PutOverlap A");
    await CalendarEvent.deleteMany({ _id: { $in: [a._id, b._id] } });
  });

  it("allows leader to update any event", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await PUT(
      makePutRequest(groupUUID, memberEventId, { title: "Updated by Leader" }),
      {
        params: Promise.resolve({ groupId: groupUUID, eventId: memberEventId }),
      },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.event.title).toBe("Updated by Leader");
  });

  it("returns 400 when endTime is set before startTime", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await PUT(
      makePutRequest(groupUUID, leaderEventId, {
        startTime: futureEnd(),
        endTime: futureStart(),
      }),
      {
        params: Promise.resolve({ groupId: groupUUID, eventId: leaderEventId }),
      },
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/endTime must be after startTime/i);
  });

  it("returns 400 for an invalid eventId", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await PUT(
      makePutRequest(groupUUID, "not-a-valid-objectid", { title: "X" }),
      {
        params: Promise.resolve({
          groupId: groupUUID,
          eventId: "not-a-valid-objectid",
        }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for an event that does not exist", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await PUT(
      makePutRequest(groupUUID, fakeId, { title: "Ghost" }),
      { params: Promise.resolve({ groupId: groupUUID, eventId: fakeId }) },
    );
    expect(res.status).toBe(404);
  });
});

// ─── DELETE ──────────────────────────────────────────────────────────────────

describe("DELETE /api/groups/:groupId/calendar/events/:eventId", () => {
  let eventId: string;
  let memberEventId: string;

  beforeEach(async () => {
    const ev = await CalendarEvent.create({
      title: "To Delete",
      startTime: new Date(Date.now() + 3600000),
      endTime: new Date(Date.now() + 7200000),
      groupId: groupUUID,
      createdBy: leaderId,
    });
    eventId = ev._id.toString();

    const memberEv = await CalendarEvent.create({
      title: "Member To Delete",
      startTime: new Date(Date.now() + 3600000),
      endTime: new Date(Date.now() + 7200000),
      groupId: groupUUID,
      createdBy: memberId,
    });
    memberEventId = memberEv._id.toString();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await DELETE(makeDeleteRequest(groupUUID, eventId), {
      params: Promise.resolve({ groupId: groupUUID, eventId }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-members", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: outsiderId },
      expires: "9999",
    });
    const res = await DELETE(makeDeleteRequest(groupUUID, eventId), {
      params: Promise.resolve({ groupId: groupUUID, eventId }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 403 when non-creator non-leader tries to delete", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const res = await DELETE(makeDeleteRequest(groupUUID, eventId), {
      params: Promise.resolve({ groupId: groupUUID, eventId }),
    });
    expect(res.status).toBe(403);
  });

  it("allows creator to delete their own event", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const res = await DELETE(makeDeleteRequest(groupUUID, memberEventId), {
      params: Promise.resolve({ groupId: groupUUID, eventId: memberEventId }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("allows leader to delete any event", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await DELETE(makeDeleteRequest(groupUUID, memberEventId), {
      params: Promise.resolve({ groupId: groupUUID, eventId: memberEventId }),
    });
    expect(res.status).toBe(200);
  });

  it("returns 400 for an invalid eventId format", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await DELETE(makeDeleteRequest(groupUUID, "not-valid"), {
      params: Promise.resolve({ groupId: groupUUID, eventId: "not-valid" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for a non-existent event", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await DELETE(makeDeleteRequest(groupUUID, fakeId), {
      params: Promise.resolve({ groupId: groupUUID, eventId: fakeId }),
    });
    expect(res.status).toBe(404);
  });
});
