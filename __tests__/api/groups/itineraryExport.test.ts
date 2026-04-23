import { jest } from "@jest/globals";
import mongoose from "mongoose";

await jest.unstable_mockModule("next-auth", () => ({
  getServerSession: jest.fn(),
}));

await jest.unstable_mockModule("@/lib/auth", () => ({
  authOptions: {},
}));

const nextAuth = await import("next-auth");
const mockGetServerSession = nextAuth.getServerSession as jest.MockedFunction<
  typeof nextAuth.getServerSession
>;

let GETIcs: (req: Request, ctx: unknown) => Promise<Response>;
let GETGoogle: (req: Request, ctx: unknown) => Promise<Response>;
let POSTToken: (req: Request, ctx: unknown) => Promise<Response>;

let User: typeof import("@/models/User").default;
let TravelGroup: typeof import("@/models/TravelGroup").default;
let CalendarEvent: typeof import("@/models/CalendarEvent").default;
let dbConnect: typeof import("@/lib/dbConnect").default;

let groupUUID: string;
let leaderId: string;
let memberId: string;
let outsiderId: string;

beforeAll(async () => {
  ({ default: dbConnect } = await import("@/lib/dbConnect"));
  ({ default: User } = await import("@/models/User"));
  ({ default: TravelGroup } = await import("@/models/TravelGroup"));
  ({ default: CalendarEvent } = await import("@/models/CalendarEvent"));

  await dbConnect();
  await CalendarEvent.deleteMany({});
  await TravelGroup.deleteMany({});
  await User.deleteMany({});

  const bcrypt = (await import("bcryptjs")).default;
  const hash = await bcrypt.hash("pass", 10);

  const leader = await User.create({
    username: "exp_leader",
    email: "exp_leader@test.com",
    passwordHash: hash,
    school: "Purdue",
  });
  const member = await User.create({
    username: "exp_member",
    email: "exp_member@test.com",
    passwordHash: hash,
    school: "Purdue",
  });
  const outsider = await User.create({
    username: "exp_outsider",
    email: "exp_outsider@test.com",
    passwordHash: hash,
    school: "Purdue",
  });

  leaderId = leader.userId.toString();
  memberId = member.userId.toString();
  outsiderId = outsider.userId.toString();

  const group = await TravelGroup.create({
    groupName: "Export Test Group",
    leaderID: leaderId,
    membersList: [
      { userId: leaderId, role: "Leader" },
      { userId: memberId, role: "Viewer" },
    ],
  });
  groupUUID = group.groupID.toString();

  await CalendarEvent.create({
    groupId: groupUUID,
    title: "In range event",
    description: "Desc",
    location: "Somewhere",
    startTime: new Date("2026-08-10T14:00:00.000Z"),
    endTime: new Date("2026-08-10T15:00:00.000Z"),
    createdBy: leaderId,
    source: "manual",
  });

  await CalendarEvent.create({
    groupId: groupUUID,
    title: "Out of range",
    startTime: new Date("2026-12-01T14:00:00.000Z"),
    endTime: new Date("2026-12-01T15:00:00.000Z"),
    createdBy: leaderId,
    source: "itinerary",
  });

  const icsMod = await import(
    "@/app/api/groups/[groupId]/itinerary/export/ics/route"
  );
  GETIcs = icsMod.GET as any;

  const gMod = await import(
    "@/app/api/groups/[groupId]/itinerary/export/google/route"
  );
  GETGoogle = gMod.GET as any;

  const tMod = await import(
    "@/app/api/groups/[groupId]/itinerary/export/token/route"
  );
  POSTToken = tMod.POST as any;
});

afterAll(async () => {
  await CalendarEvent.deleteMany({});
  await TravelGroup.deleteMany({});
  await User.deleteMany({});
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});

function ctx(groupId: string) {
  return { params: Promise.resolve({ groupId }) };
}

describe("GET /api/groups/.../itinerary/export/ics", () => {
  it("returns 401 when unauthenticated (no token)", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const req = new Request(
      `http://localhost/api/groups/${groupUUID}/itinerary/export/ics`,
    );
    const res = await GETIcs(req, ctx(groupUUID));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-member", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: outsiderId },
      expires: "9999",
    });
    const req = new Request(
      `http://localhost/api/groups/${groupUUID}/itinerary/export/ics?from=${encodeURIComponent("2026-08-01T00:00:00.000Z")}&to=${encodeURIComponent("2026-08-31T23:59:59.000Z")}`,
    );
    const res = await GETIcs(req, ctx(groupUUID));
    expect(res.status).toBe(403);
  });

  it("returns valid .ics for member with VEVENT for in-range events only", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const qs = new URLSearchParams({
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-31T23:59:59.000Z",
    });
    const req = new Request(
      `http://localhost/api/groups/${groupUUID}/itinerary/export/ics?${qs}`,
    );
    const res = await GETIcs(req, ctx(groupUUID));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/calendar");
    const text = await res.text();
    expect(text).toContain("BEGIN:VCALENDAR");
    expect(text).toContain("In range event");
    expect(text).not.toContain("Out of range");
    const vevents = text.split("BEGIN:VEVENT").length - 1;
    expect(vevents).toBe(1);
  });

  it("allows access with valid token without session", async () => {
    const group = await TravelGroup.findOne({ groupID: groupUUID });
    expect(group).toBeTruthy();
    group!.calendarExportToken = "test-token-export-ics-123";
    await group!.save();

    mockGetServerSession.mockResolvedValue(null);
    const qs = new URLSearchParams({
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-31T23:59:59.000Z",
      token: "test-token-export-ics-123",
    });
    const req = new Request(
      `http://localhost/api/groups/${groupUUID}/itinerary/export/ics?${qs}`,
    );
    const res = await GETIcs(req, ctx(groupUUID));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("BEGIN:VCALENDAR");

    group!.calendarExportToken = undefined;
    await group!.save();
  });

  it("returns 403 for wrong token", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const qs = new URLSearchParams({
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-31T23:59:59.000Z",
      token: "wrong-token",
    });
    const req = new Request(
      `http://localhost/api/groups/${groupUUID}/itinerary/export/ics?${qs}`,
    );
    const res = await GETIcs(req, ctx(groupUUID));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/groups/.../itinerary/export/token", () => {
  it("returns subscriptionUrl for member", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const req = new Request(
      `http://localhost/api/groups/${groupUUID}/itinerary/export/token`,
      { method: "POST" },
    );
    const res = await POSTToken(req, ctx(groupUUID));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.subscriptionUrl).toMatch(/\/itinerary\/export\/ics\?token=/);
  });
});

describe("GET /api/groups/.../itinerary/export/google", () => {
  it("returns calendar.google.com url for first event", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const qs = new URLSearchParams({
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-31T23:59:59.000Z",
    });
    const req = new Request(
      `http://localhost/api/groups/${groupUUID}/itinerary/export/google?${qs}&eventIndex=0`,
    );
    const res = await GETGoogle(req, ctx(groupUUID));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render/);
    expect(data.url).toContain("action=TEMPLATE");
    expect(new URL(data.url).searchParams.get("text")).toBe("In range event");
  });

  it("returns 403 for non-member", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: outsiderId },
      expires: "9999",
    });
    const req = new Request(
      `http://localhost/api/groups/${groupUUID}/itinerary/export/google`,
    );
    const res = await GETGoogle(req, ctx(groupUUID));
    expect(res.status).toBe(403);
  });
});
