import { jest } from "@jest/globals";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

process.env.OLLAMA_SKIP = "1";

await jest.unstable_mockModule("next-auth", () => ({
  getServerSession: jest.fn(),
}));

await jest.unstable_mockModule("@/lib/auth", () => ({
  authOptions: {},
}));

const { default: dbConnect } = await import("@/lib/dbConnect");
const { default: User } = await import("@/models/User");
const { default: TravelGroup } = await import("@/models/TravelGroup");
const { default: Trip } = await import("@/models/Trip");
const { default: CalendarEvent } = await import("@/models/CalendarEvent");

const nextAuth = await import("next-auth");
const mockGetServerSession = nextAuth.getServerSession as jest.Mock;

let POSTApply: (req: Request, ctx: { params: Promise<{ groupId: string }> }) => Promise<Response>;

beforeAll(async () => {
  await dbConnect();
  const mod = await import(
    "@/app/api/groups/[groupId]/itinerary/apply-to-trip/route"
  );
  POSTApply = mod.POST as unknown as typeof POSTApply;
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await CalendarEvent.deleteMany({});
    await Trip.deleteMany({});
    await TravelGroup.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();
  }
  await new Promise((r) => setTimeout(r, 300));
});

beforeEach(() => {
  jest.clearAllMocks();
});

async function seedGroupLeaderViewerTrip() {
  const suffix = randomUUID().slice(0, 8);
  const passwordHash = await bcrypt.hash("pw", 10);
  const leader = await User.create({
    username: `apply_lead_${suffix}`,
    email: `apply_lead_${suffix}@test.com`,
    passwordHash,
    school: "Purdue",
  });
  const viewer = await User.create({
    username: `apply_view_${suffix}`,
    email: `apply_view_${suffix}@test.com`,
    passwordHash,
    school: "Purdue",
  });
  const leaderId = leader.userId.toString();
  const viewerId = viewer.userId.toString();
  const groupID = randomUUID();

  await TravelGroup.create({
    groupID,
    groupName: `Apply Trip ${suffix}`,
    leaderID: leaderId,
    membersList: [
      { userId: leaderId, role: "Leader" },
      { userId: viewerId, role: "Viewer" },
    ],
  });

  const trip = await Trip.create({
    groupID,
    userId: leaderId,
    fromCity: "Chicago",
    toCity: "Miami",
    fromDate: new Date("2026-04-01"),
    toDate: new Date("2026-04-10"),
    mode: "flight",
    budget: 2000,
    primaryItinerary: [
      {
        name: "Legacy primary row",
        startTime: new Date("2026-04-02T10:00:00Z"),
        endTime: new Date("2026-04-02T11:00:00Z"),
        isOutdoor: false,
        category: "Indoor",
        location: "Old",
      },
    ],
    rainyDayItinerary: [
      {
        name: "Legacy rainy",
        startTime: new Date("2026-04-02T10:00:00Z"),
        endTime: new Date("2026-04-02T11:00:00Z"),
        isOutdoor: false,
        category: "Indoor",
        location: "Old",
      },
    ],
  });

  const ev1 = await CalendarEvent.create({
    title: "Spark flight block",
    description: "Travel",
    startTime: new Date("2026-04-02T08:00:00Z"),
    endTime: new Date("2026-04-02T14:00:00Z"),
    location: "ORD",
    eventType: "travel",
    createdBy: leaderId,
    groupId: groupID,
    source: "itinerary",
    itineraryOptionStatus: "candidate",
    timezone: "UTC",
  });

  const ev2 = await CalendarEvent.create({
    title: "Spark museum",
    startTime: new Date("2026-04-04T15:00:00Z"),
    endTime: new Date("2026-04-04T17:00:00Z"),
    location: "Downtown",
    eventType: "activity",
    createdBy: leaderId,
    groupId: groupID,
    source: "itinerary",
    itineraryOptionStatus: "candidate",
    timezone: "UTC",
  });

  const manual = await CalendarEvent.create({
    title: "Manual only",
    startTime: new Date("2026-04-03T12:00:00Z"),
    endTime: new Date("2026-04-03T13:00:00Z"),
    createdBy: leaderId,
    groupId: groupID,
    source: "manual",
    itineraryOptionStatus: "final",
    timezone: "UTC",
  });

  return {
    leaderId,
    viewerId,
    leaderMongoId: leader._id,
    viewerMongoId: viewer._id,
    groupID,
    tripId: trip._id.toString(),
    ev1Id: ev1._id.toString(),
    ev2Id: ev2._id.toString(),
    manualId: manual._id.toString(),
  };
}

async function cleanupSeed(ctx: Awaited<ReturnType<typeof seedGroupLeaderViewerTrip>>) {
  await CalendarEvent.deleteMany({ groupId: ctx.groupID });
  await Trip.deleteMany({ groupID: ctx.groupID });
  await TravelGroup.deleteOne({ groupID: ctx.groupID });
  await User.deleteMany({ _id: { $in: [ctx.leaderMongoId, ctx.viewerMongoId] } });
}

describe("POST /api/groups/[groupId]/itinerary/apply-to-trip", () => {
  it("replaces Trip primary from calendar events in trip date range", async () => {
    const ctx = await seedGroupLeaderViewerTrip();

    mockGetServerSession.mockResolvedValue({
      user: { userId: ctx.leaderId, email: "l@test.com" },
      expires: "9999",
    } as never);

    const res = await POSTApply(
      new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: ctx.tripId }),
      }),
      { params: Promise.resolve({ groupId: ctx.groupID }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.appliedCount).toBe(2);

    const trip = await Trip.findById(ctx.tripId).lean();
    const primary = (trip as { primaryItinerary?: { name?: string }[] })
      .primaryItinerary;
    expect(Array.isArray(primary)).toBe(true);
    expect(primary?.length).toBe(2);
    const names = primary?.map((a) => a.name).sort();
    expect(names).toEqual(["Spark flight block", "Spark museum"].sort());

    await cleanupSeed(ctx);
  });

  it("returns 403 for Viewer", async () => {
    const ctx = await seedGroupLeaderViewerTrip();

    mockGetServerSession.mockResolvedValue({
      user: { userId: ctx.viewerId, email: "v@test.com" },
      expires: "9999",
    } as never);

    const res = await POSTApply(
      new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: ctx.tripId }),
      }),
      { params: Promise.resolve({ groupId: ctx.groupID }) },
    );

    expect(res.status).toBe(403);

    await cleanupSeed(ctx);
  });

  it("returns 400 when eventIds mix includes non-itinerary row", async () => {
    const ctx = await seedGroupLeaderViewerTrip();

    mockGetServerSession.mockResolvedValue({
      user: { userId: ctx.leaderId, email: "l@test.com" },
      expires: "9999",
    } as never);

    const res = await POSTApply(
      new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: ctx.tripId,
          eventIds: [ctx.ev1Id, ctx.manualId],
        }),
      }),
      { params: Promise.resolve({ groupId: ctx.groupID }) },
    );

    expect(res.status).toBe(400);

    await cleanupSeed(ctx);
  });
});
