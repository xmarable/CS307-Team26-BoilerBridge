import { jest } from "@jest/globals";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

await jest.unstable_mockModule("next-auth", () => ({
  getServerSession: jest.fn(),
}));

await jest.unstable_mockModule("@/lib/auth", () => ({
  authOptions: {},
}));

await jest.unstable_mockModule("@/lib/itinerary/generatePartial", () => ({
  generatePartialItinerary: jest.fn(),
}));

const nextAuth = await import("next-auth");
const generatePartial = await import("@/lib/itinerary/generatePartial");
const { default: dbConnect } = await import("@/lib/dbConnect");
const { default: User } = await import("@/models/User");
const { default: TravelGroup } = await import("@/models/TravelGroup");
const { default: Trip } = await import("@/models/Trip");
const { default: CalendarEvent } = await import("@/models/CalendarEvent");
const { default: MustHave } = await import("@/models/MustHave");

let mockGetServerSession: jest.MockedFunction<any>;

const mockGeneratePartialItinerary =
  generatePartial.generatePartialItinerary as jest.MockedFunction<
    typeof generatePartial.generatePartialItinerary
  >;

let POSTRegenerate: (
  req: Request,
  ctx: { params: Promise<{ groupId: string }> },
) => Promise<Response>;
let POSTApply: (
  req: Request,
  ctx: { params: Promise<{ groupId: string }> },
) => Promise<Response>;

let lastGenerateInput:
  | Parameters<typeof generatePartial.generatePartialItinerary>[0]
  | null;

const CONNECTION_CLEANUP_DELAY_MS = 500;

beforeAll(async () => {
  await dbConnect();

  const nextAuth = (await import("next-auth")) as any;
  mockGetServerSession = nextAuth.getServerSession as any;

  mockGeneratePartialItinerary.mockImplementation(async (input) => {
    lastGenerateInput = input;
    return input.targetEvents.map((e) => {
      const start = new Date(e.startTime);
      const end = new Date(e.endTime);
      return {
        title: `AI ${e.title}`,
        description: e.description,
        startTime: new Date(start.getTime() + 60_000),
        endTime: new Date(end.getTime() + 60_000),
        location: e.location,
        eventType: e.eventType ?? "activity",
        timezone: "UTC",
      };
    });
  });

  const reg =
    await import("@/app/api/groups/[groupId]/itinerary/regenerate/route");
  POSTRegenerate = reg.POST as any;
  const app =
    await import("@/app/api/groups/[groupId]/itinerary/regenerate/apply/route");
  POSTApply = app.POST as any;
});

afterAll(async () => {
  mockGeneratePartialItinerary.mockReset();
  if (mongoose.connection.readyState === 1) {
    await CalendarEvent.deleteMany({});
    await MustHave.deleteMany({});
    await Trip.deleteMany({});
    await TravelGroup.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();
  }
  await new Promise((r) => setTimeout(r, CONNECTION_CLEANUP_DELAY_MS));
});

beforeEach(() => {
  jest.clearAllMocks();
  lastGenerateInput = null;
});

async function createLeaderAndGroup() {
  const suffix = randomUUID().slice(0, 8);
  const passwordHash = await bcrypt.hash("pw", 10);
  const leader = await User.create({
    username: `it_lead_${suffix}`,
    email: `it_lead_${suffix}@test.com`,
    passwordHash,
    school: "Purdue",
  });
  const leaderId = leader.userId.toString();
  const groupID = randomUUID();

  await TravelGroup.create({
    groupID,
    groupName: `Trip Test ${suffix}`,
    leaderID: leaderId,
    membersList: [{ userId: leaderId, role: "Leader" }],
  });

  await Trip.create({
    groupID,
    userId: leaderId,
    fromCity: "Chicago",
    toCity: "Denver",
    fromDate: new Date("2026-06-01"),
    toDate: new Date("2026-06-10"),
    mode: "flight",
    budget: 2000,
  });

  return { leaderId, groupID, leader };
}

describe("POST /api/groups/[groupId]/itinerary/regenerate", () => {
  it("returns 403 when user is not a group member", async () => {
    const suffix = randomUUID().slice(0, 8);
    const passwordHash = await bcrypt.hash("pw", 10);
    const outsider = await User.create({
      username: `it_out_${suffix}`,
      email: `it_out_${suffix}@test.com`,
      passwordHash,
      school: "Purdue",
    });
    const { leaderId, groupID } = await createLeaderAndGroup();

    mockGetServerSession.mockResolvedValue({
      user: {
        userId: outsider.userId.toString(),
        email: outsider.email,
      },
      expires: "9999-12-31T23:59:59.999Z",
    });

    const ev = await CalendarEvent.create({
      title: "Solo",
      startTime: new Date("2026-06-02T10:00:00Z"),
      endTime: new Date("2026-06-02T11:00:00Z"),
      createdBy: leaderId,
      groupId: groupID,
      source: "itinerary",
    });

    const before = await CalendarEvent.countDocuments({ groupId: groupID });

    const req = new Request(
      `http://localhost/api/groups/${groupID}/itinerary/regenerate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds: [String(ev._id)] }),
      },
    );

    const res = await POSTRegenerate(req, {
      params: Promise.resolve({ groupId: groupID }),
    });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toMatch(/not a member|Access denied/i);

    const after = await CalendarEvent.countDocuments({ groupId: groupID });
    expect(after).toBe(before);

    await User.deleteOne({ userId: outsider.userId });
    await CalendarEvent.deleteMany({ groupId: groupID });
    await Trip.deleteMany({ groupID });
    await TravelGroup.deleteOne({ groupID });
    await User.deleteOne({ userId: leaderId });
  });

  it("returns 403 for Viewer role (cannot edit itinerary)", async () => {
    const suffix = randomUUID().slice(0, 8);
    const passwordHash = await bcrypt.hash("pw", 10);
    const leader = await User.create({
      username: `it_ld_${suffix}`,
      email: `it_ld_${suffix}@test.com`,
      passwordHash,
      school: "Purdue",
    });
    const viewer = await User.create({
      username: `it_vw_${suffix}`,
      email: `it_vw_${suffix}@test.com`,
      passwordHash,
      school: "Purdue",
    });
    const leaderId = leader.userId.toString();
    const groupID = randomUUID();

    await TravelGroup.create({
      groupID,
      groupName: `Viewer Test ${suffix}`,
      leaderID: leaderId,
      membersList: [
        { userId: leaderId, role: "Leader" },
        { userId: viewer.userId.toString(), role: "Viewer" },
      ],
    });

    await Trip.create({
      groupID,
      userId: leaderId,
      fromCity: "A",
      toCity: "B",
      fromDate: new Date(),
      toDate: new Date(Date.now() + 86400000),
      mode: "bus",
      budget: 500,
    });

    const ev = await CalendarEvent.create({
      title: "V",
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      createdBy: leaderId,
      groupId: groupID,
      source: "itinerary",
    });

    mockGetServerSession.mockResolvedValue({
      user: {
        userId: viewer.userId.toString(),
        email: viewer.email,
      },
      expires: "9999-12-31T23:59:59.999Z",
    });

    const req = new Request(
      `http://localhost/api/groups/${groupID}/itinerary/regenerate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds: [String(ev._id)] }),
      },
    );

    const res = await POSTRegenerate(req, {
      params: Promise.resolve({ groupId: groupID }),
    });

    expect(res.status).toBe(403);

    await CalendarEvent.deleteMany({ groupId: groupID });
    await Trip.deleteMany({ groupID });
    await TravelGroup.deleteOne({ groupID });
    await User.deleteOne({ userId: viewer.userId });
    await User.deleteOne({ userId: leader.userId });
  });

  it("returns originals and proposed without saving; includes approved must-haves in generator input", async () => {
    const { leaderId, groupID } = await createLeaderAndGroup();

    await MustHave.create({
      groupId: groupID as never,
      name: "Approved Museum",
      status: "approved",
      addedBy: leaderId as never,
    });

    const ev = await CalendarEvent.create({
      title: "Brunch",
      startTime: new Date("2026-06-03T12:00:00Z"),
      endTime: new Date("2026-06-03T13:00:00Z"),
      createdBy: leaderId,
      groupId: groupID,
      source: "itinerary",
    });

    const before = await CalendarEvent.countDocuments({ groupId: groupID });

    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId, email: "x@test.com" },
      expires: "9999-12-31T23:59:59.999Z",
    });

    const req = new Request(
      `http://localhost/api/groups/${groupID}/itinerary/regenerate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds: [String(ev._id)] }),
      },
    );

    const res = await POSTRegenerate(req, {
      params: Promise.resolve({ groupId: groupID }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.originals).toHaveLength(1);
    expect(data.proposed).toHaveLength(1);
    expect(data.proposed[0].title).toMatch(/^AI /);

    const after = await CalendarEvent.countDocuments({ groupId: groupID });
    expect(after).toBe(before);

    expect(
      lastGenerateInput?.approvedMustHaves.some(
        (m) => m.name === "Approved Museum",
      ),
    ).toBe(true);

    await CalendarEvent.deleteMany({ groupId: groupID });
    await MustHave.deleteMany({ groupId: groupID as never });
    await Trip.deleteMany({ groupID });
    await TravelGroup.deleteOne({ groupID });
    await User.deleteOne({ userId: leaderId });
  });

  it("passes current trip avoid lists and budget range into partial generator input (US14)", async () => {
    const { leaderId, groupID } = await createLeaderAndGroup();

    await Trip.updateOne(
      { groupID },
      {
        $set: {
          avoidActivities: ["Zoo", "Nightclub"],
          avoidLocations: ["Strip"],
          budgetMin: 50,
          budgetMax: 400,
        },
      },
    );

    const ev = await CalendarEvent.create({
      title: "Brunch",
      startTime: new Date("2026-06-03T12:00:00Z"),
      endTime: new Date("2026-06-03T13:00:00Z"),
      createdBy: leaderId,
      groupId: groupID,
      source: "itinerary",
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId, email: "x@test.com" },
      expires: "9999-12-31T23:59:59.999Z",
    });

    const req = new Request(
      `http://localhost/api/groups/${groupID}/itinerary/regenerate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds: [String(ev._id)] }),
      },
    );

    const res = await POSTRegenerate(req, {
      params: Promise.resolve({ groupId: groupID }),
    });
    expect(res.status).toBe(200);

    expect(lastGenerateInput?.trip.avoidActivities).toEqual(["Zoo", "Nightclub"]);
    expect(lastGenerateInput?.trip.avoidLocations).toEqual(["Strip"]);
    expect(lastGenerateInput?.trip.budgetMin).toBe(50);
    expect(lastGenerateInput?.trip.budgetMax).toBe(400);

    await CalendarEvent.deleteMany({ groupId: groupID });
    await Trip.deleteMany({ groupID });
    await TravelGroup.deleteOne({ groupID });
    await User.deleteOne({ userId: leaderId });
  });
});

describe("POST /api/groups/[groupId]/itinerary/regenerate/apply", () => {
  it("replaces only selected events and leaves others untouched", async () => {
    const { leaderId, groupID } = await createLeaderAndGroup();

    const replaceMe = await CalendarEvent.create({
      title: "Old A",
      startTime: new Date("2026-06-04T09:00:00Z"),
      endTime: new Date("2026-06-04T10:00:00Z"),
      createdBy: leaderId,
      groupId: groupID,
      source: "itinerary",
    });

    const keepMe = await CalendarEvent.create({
      title: "Keep B",
      startTime: new Date("2026-06-05T09:00:00Z"),
      endTime: new Date("2026-06-05T10:00:00Z"),
      createdBy: leaderId,
      groupId: groupID,
      source: "manual",
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId, email: "x@test.com" },
      expires: "9999-12-31T23:59:59.999Z",
    });

    const proposedStart = new Date("2026-06-04T09:30:00Z");
    const proposedEnd = new Date("2026-06-04T10:30:00Z");

    const req = new Request(
      `http://localhost/api/groups/${groupID}/itinerary/regenerate/apply`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replaceEventIds: [String(replaceMe._id)],
          proposedEvents: [
            {
              title: "New A",
              startTime: proposedStart.toISOString(),
              endTime: proposedEnd.toISOString(),
              eventType: "food",
              timezone: "UTC",
            },
          ],
        }),
      },
    );

    const res = await POSTApply(req, {
      params: Promise.resolve({ groupId: groupID }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.events).toHaveLength(1);

    const remaining = await CalendarEvent.find({ groupId: groupID }).sort({
      startTime: 1,
    });
    expect(remaining).toHaveLength(2);

    const titles = remaining.map((e) => e.title).sort();
    expect(titles).toEqual(["Keep B", "New A"]);

    const oldGone = await CalendarEvent.findById(replaceMe._id);
    expect(oldGone).toBeNull();

    await CalendarEvent.deleteMany({ groupId: groupID });
    await Trip.deleteMany({ groupID });
    await TravelGroup.deleteOne({ groupID });
    await User.deleteOne({ userId: leaderId });
  });

  it("returns 403 for non-member on apply", async () => {
    const suffix = randomUUID().slice(0, 8);
    const passwordHash = await bcrypt.hash("pw", 10);
    const outsider = await User.create({
      username: `it_ap_out_${suffix}`,
      email: `it_ap_out_${suffix}@test.com`,
      passwordHash,
      school: "Purdue",
    });

    const { leaderId, groupID } = await createLeaderAndGroup();
    const ev = await CalendarEvent.create({
      title: "X",
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      createdBy: leaderId,
      groupId: groupID,
      source: "itinerary",
    });

    mockGetServerSession.mockResolvedValue({
      user: {
        userId: outsider.userId.toString(),
        email: outsider.email,
      },
      expires: "9999-12-31T23:59:59.999Z",
    });

    const req = new Request(
      `http://localhost/api/groups/${groupID}/itinerary/regenerate/apply`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replaceEventIds: [String(ev._id)],
          proposedEvents: [
            {
              title: "Y",
              startTime: new Date().toISOString(),
              endTime: new Date(Date.now() + 7200000).toISOString(),
              timezone: "UTC",
            },
          ],
        }),
      },
    );

    const res = await POSTApply(req, {
      params: Promise.resolve({ groupId: groupID }),
    });

    expect(res.status).toBe(403);

    await User.deleteOne({ userId: outsider.userId });
    await CalendarEvent.deleteMany({ groupId: groupID });
    await Trip.deleteMany({ groupID });
    await TravelGroup.deleteOne({ groupID });
    await User.deleteOne({ userId: leaderId });
  });
});
