import { jest } from "@jest/globals";
import mongoose from "mongoose";

// types
let GET: any, POST: any, PUT: any, DELETE: any;
let User: any,
  TravelGroup: any,
  CalendarEvent: any,
  dbConnect: any,
  bcrypt: any;
let mockGetServerSession: jest.Mock<any>;

let groupUUID: string,
  leaderId: string,
  adminId: string,
  memberId: string,
  outsiderId: string;

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
  ({ default: CalendarEvent } = await import("@/models/CalendarEvent"));

  await dbConnect();

  await CalendarEvent.deleteMany({});
  await TravelGroup.deleteMany({});
  await User.deleteMany({});

  const hash = await bcrypt.hash("pass", 10);

  const leader = await User.create({
    username: "leader",
    email: "l@test.com",
    passwordHash: hash,
    school: "Purdue",
  });
  const admin = await User.create({
    username: "admin",
    email: "a@test.com",
    passwordHash: hash,
    school: "Purdue",
  });
  const member = await User.create({
    username: "member",
    email: "m@test.com",
    passwordHash: hash,
    school: "Purdue",
  });
  const outsider = await User.create({
    username: "outsider",
    email: "o@test.com",
    passwordHash: hash,
    school: "Purdue",
  });

  leaderId = leader.userId.toString();
  adminId = admin.userId.toString();
  memberId = member.userId.toString();
  outsiderId = outsider.userId.toString();

  const group = await TravelGroup.create({
    groupName: "Admin Test Group",
    leaderID: leaderId,
    membersList: [
      { userId: leaderId, role: "Leader" },
      { userId: adminId, role: "Admin" },
      { userId: memberId, role: "Viewer" },
    ],
  });

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
  jest.clearAllMocks();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

const validEvent = () => ({
  title: "Admin Test Event",
  startTime: new Date(Date.now() + 3600000).toISOString(),
  endTime: new Date(Date.now() + 7200000).toISOString(),
  location: "Purdue Union",
  eventType: "activity",
});

// ─── ADMIN PERMISSION TESTS ──────────────────────────────────────────────────

describe("Admin Permissions for Calendar Events", () => {
  beforeEach(async () => {
    await CalendarEvent.deleteMany({});
  });

  it("allows an Admin to create an event", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: adminId } });
    const res = await POST(makePostRequest(groupUUID, validEvent()), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.event.createdBy).toBe(adminId);
  });

  it("allows an Admin to update an event they did NOT create (Leader's event)", async () => {
    // Create an event as the leader
    const leaderEvent = await CalendarEvent.create({
      ...validEvent(),
      title: "Leader Original Event",
      groupId: groupUUID,
      createdBy: leaderId,
    });

    mockGetServerSession.mockResolvedValue({ user: { userId: adminId } });
    const res = await PUT(
      makePutRequest(groupUUID, leaderEvent._id.toString(), {
        title: "Hacked by Admin",
      }),
      {
        params: Promise.resolve({
          groupId: groupUUID,
          eventId: leaderEvent._id.toString(),
        }),
      },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.event.title).toBe("Hacked by Admin");
  });

  it("allows an Admin to update an event they did NOT create (Leader's event)", async () => {
    // 1. clear existing events to prevent 409 overlap
    await CalendarEvent.deleteMany({ groupId: groupUUID });

    // 2. create a fresh event as the leader
    const leaderEvent = await CalendarEvent.create({
      ...validEvent(),
      title: "Leader Original Event",
      groupId: groupUUID,
      createdBy: leaderId,
      startTime: new Date("2026-05-01T10:00:00Z"), // hardcoded unique times
      endTime: new Date("2026-05-01T11:00:00Z"),
    });

    mockGetServerSession.mockResolvedValue({ user: { userId: adminId } });

    const res = await PUT(
      makePutRequest(groupUUID, leaderEvent._id.toString(), {
        title: "Hacked by Admin",
      }),
      {
        params: Promise.resolve({
          groupId: groupUUID,
          eventId: leaderEvent._id.toString(),
        }),
      },
    );

    // 3. now it should be 200 bc there is zero chance of overlap
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.event.title).toBe("Hacked by Admin");
  });

  it("still denies a regular Member (Viewer) from updating someone else's event", async () => {
    const leaderEvent = await CalendarEvent.create({
      ...validEvent(),
      groupId: groupUUID,
      createdBy: leaderId,
    });

    mockGetServerSession.mockResolvedValue({ user: { userId: memberId } });
    const res = await PUT(
      makePutRequest(groupUUID, leaderEvent._id.toString(), {
        title: "Member Try",
      }),
      {
        params: Promise.resolve({
          groupId: groupUUID,
          eventId: leaderEvent._id.toString(),
        }),
      },
    );

    expect(res.status).toBe(403);
  });
});
