/**
 * User Story #4 — Lockdown Mode
 * Tests: lock toggle API, generate preserves locked events,
 * regenerate skips locked events, apply rejects locked events.
 */
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

await jest.unstable_mockModule("@/lib/itinerary/generateFull", () => ({
  generateFullTripEvents: jest.fn(),
}));

await jest.unstable_mockModule("@/lib/itinerary/generatePartial", () => ({
  generatePartialItinerary: jest.fn(),
}));

const nextAuthMod = await import("next-auth");
const generateFullMod = await import("@/lib/itinerary/generateFull");
const generatePartialMod = await import("@/lib/itinerary/generatePartial");

const { default: dbConnect } = await import("@/lib/dbConnect");
const { default: User } = await import("@/models/User");
const { default: TravelGroup } = await import("@/models/TravelGroup");
const { default: Trip } = await import("@/models/Trip");
const { default: CalendarEvent } = await import("@/models/CalendarEvent");

let mockGetServerSession: jest.MockedFunction<any>;
const mockGenerateFull =
  generateFullMod.generateFullTripEvents as jest.MockedFunction<any>;
const mockGeneratePartial =
  generatePartialMod.generatePartialItinerary as jest.MockedFunction<any>;

let PATCHEventLock: (
  req: Request,
  ctx: { params: Promise<{ groupId: string; eventId: string }> },
) => Promise<Response>;

let POSTGenerate: (
  req: Request,
  ctx: { params: Promise<{ groupId: string }> },
) => Promise<Response>;

let POSTRegenerate: (
  req: Request,
  ctx: { params: Promise<{ groupId: string }> },
) => Promise<Response>;

let POSTApply: (
  req: Request,
  ctx: { params: Promise<{ groupId: string }> },
) => Promise<Response>;

const CONNECTION_CLEANUP_DELAY_MS = 500;

beforeAll(async () => {
  await dbConnect();

  const nextAuth = (await import("next-auth")) as any;
  mockGetServerSession = nextAuth.getServerSession as any;

  mockGenerateFull.mockResolvedValue([]);
  mockGeneratePartial.mockImplementation(async (input: any) =>
    input.targetEvents.map((e: any) => ({
      title: `AI ${e.title}`,
      startTime: new Date(e.startTime),
      endTime: new Date(e.endTime),
      eventType: e.eventType ?? "activity",
      timezone: "UTC",
    })),
  );

  const lockRoute =
    await import("@/app/api/groups/[groupId]/calendar/events/[eventId]/route");
  PATCHEventLock = (lockRoute as any).PATCH as any;

  const genRoute =
    await import("@/app/api/groups/[groupId]/itinerary/generate/route");
  POSTGenerate = genRoute.POST as any;

  const regenRoute =
    await import("@/app/api/groups/[groupId]/itinerary/regenerate/route");
  POSTRegenerate = regenRoute.POST as any;

  const applyRoute =
    await import("@/app/api/groups/[groupId]/itinerary/regenerate/apply/route");
  POSTApply = applyRoute.POST as any;
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await CalendarEvent.deleteMany({});
    await Trip.deleteMany({});
    await TravelGroup.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();
  }
  await new Promise((r) => setTimeout(r, CONNECTION_CLEANUP_DELAY_MS));
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGenerateFull.mockResolvedValue([]);
});

async function seed() {
  const suffix = randomUUID().slice(0, 8);
  const passwordHash = await bcrypt.hash("pw", 10);
  const leader = await User.create({
    username: `lock_lead_${suffix}`,
    email: `lock_lead_${suffix}@test.com`,
    passwordHash,
    school: "Purdue",
  });
  const leaderId = leader.userId.toString();
  const groupID = randomUUID();

  await TravelGroup.create({
    groupID,
    groupName: `Lock Test ${suffix}`,
    leaderID: leaderId,
    membersList: [{ userId: leaderId, role: "Leader" }],
  });

  await Trip.create({
    groupID,
    userId: leaderId,
    fromCity: "Chicago",
    toCity: "Denver",
    fromDate: new Date("2026-07-01"),
    toDate: new Date("2026-07-10"),
    mode: "flight",
    budget: 2000,
  });

  mockGetServerSession.mockResolvedValue({
    user: { userId: leaderId, email: `lock_lead_${suffix}@test.com` },
    expires: "9999-12-31T23:59:59.999Z",
  });

  return { leaderId, groupID };
}

async function cleanup(groupID: string, leaderId: string) {
  await CalendarEvent.deleteMany({ groupId: groupID });
  await Trip.deleteMany({ groupID });
  await TravelGroup.deleteOne({ groupID });
  await User.deleteOne({ userId: leaderId });
}

/* ─── Lock Toggle API ─────────────────────────────────────────────── */

describe("PATCH /api/groups/[groupId]/calendar/events/[eventId] (lock toggle)", () => {
  it("toggles isLocked from false to true", async () => {
    const { leaderId, groupID } = await seed();

    const ev = await CalendarEvent.create({
      title: "Dinner",
      startTime: new Date("2026-07-02T19:00:00Z"),
      endTime: new Date("2026-07-02T20:30:00Z"),
      createdBy: leaderId,
      groupId: groupID,
      source: "itinerary",
    });

    expect(ev.isLocked).toBeFalsy();

    const req = new Request(
      `http://localhost/api/groups/${groupID}/calendar/events/${ev._id}`,
      { method: "PATCH" },
    );
    const res = await PATCHEventLock(req, {
      params: Promise.resolve({ groupId: groupID, eventId: String(ev._id) }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.event.isLocked).toBe(true);

    const updated = await CalendarEvent.findById(ev._id).lean();
    expect((updated as any).isLocked).toBe(true);

    await cleanup(groupID, leaderId);
  });

  it("toggles isLocked from true back to false", async () => {
    const { leaderId, groupID } = await seed();

    const ev = await CalendarEvent.create({
      title: "Museum",
      startTime: new Date("2026-07-03T10:00:00Z"),
      endTime: new Date("2026-07-03T12:00:00Z"),
      createdBy: leaderId,
      groupId: groupID,
      source: "itinerary",
      isLocked: true,
    });

    const req = new Request(
      `http://localhost/api/groups/${groupID}/calendar/events/${ev._id}`,
      { method: "PATCH" },
    );
    const res = await PATCHEventLock(req, {
      params: Promise.resolve({ groupId: groupID, eventId: String(ev._id) }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.event.isLocked).toBe(false);

    await cleanup(groupID, leaderId);
  });

  it("returns 404 for unknown event", async () => {
    const { leaderId, groupID } = await seed();

    const fakeId = new mongoose.Types.ObjectId().toString();
    const req = new Request(
      `http://localhost/api/groups/${groupID}/calendar/events/${fakeId}`,
      { method: "PATCH" },
    );
    const res = await PATCHEventLock(req, {
      params: Promise.resolve({ groupId: groupID, eventId: fakeId }),
    });

    expect(res.status).toBe(404);
    await cleanup(groupID, leaderId);
  });
});

/* ─── Generate preserves locked events ───────────────────────────── */

describe("POST /api/groups/[groupId]/itinerary/generate — locked events", () => {
  it("preserves locked itinerary events when generating new itinerary", async () => {
    const { leaderId, groupID } = await seed();

    const lockedEv = await CalendarEvent.create({
      title: "Dinner Reservation (Locked)",
      startTime: new Date("2026-07-02T19:00:00Z"),
      endTime: new Date("2026-07-02T21:00:00Z"),
      createdBy: leaderId,
      groupId: groupID,
      source: "itinerary",
      isLocked: true,
    });

    await CalendarEvent.create({
      title: "Old Activity",
      startTime: new Date("2026-07-03T10:00:00Z"),
      endTime: new Date("2026-07-03T11:00:00Z"),
      createdBy: leaderId,
      groupId: groupID,
      source: "itinerary",
      isLocked: false,
    });

    const trip = await Trip.findOne({ groupID }).lean();

    const req = new Request(
      `http://localhost/api/groups/${groupID}/itinerary/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: String((trip as any)._id) }),
      },
    );

    const res = await POSTGenerate(req, {
      params: Promise.resolve({ groupId: groupID }),
    });

    expect(res.status).toBe(200);

    // Locked event must still exist
    const stillLocked = await CalendarEvent.findById(lockedEv._id).lean();
    expect(stillLocked).not.toBeNull();
    expect((stillLocked as any).isLocked).toBe(true);
    expect((stillLocked as any).title).toBe("Dinner Reservation (Locked)");

    // The old unlocked event must be gone
    const events = await CalendarEvent.find({ groupId: groupID }).lean();
    const titles = events.map((e) => (e as any).title);
    expect(titles).toContain("Dinner Reservation (Locked)");
    expect(titles).not.toContain("Old Activity");

    await cleanup(groupID, leaderId);
  });

  it("removes all itinerary events when none are locked", async () => {
    const { leaderId, groupID } = await seed();

    await CalendarEvent.create({
      title: "Removable",
      startTime: new Date("2026-07-04T09:00:00Z"),
      endTime: new Date("2026-07-04T10:00:00Z"),
      createdBy: leaderId,
      groupId: groupID,
      source: "itinerary",
    });

    const trip = await Trip.findOne({ groupID }).lean();

    const req = new Request(
      `http://localhost/api/groups/${groupID}/itinerary/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: String((trip as any)._id) }),
      },
    );

    const res = await POSTGenerate(req, {
      params: Promise.resolve({ groupId: groupID }),
    });

    expect(res.status).toBe(200);

    const remaining = await CalendarEvent.find({ groupId: groupID }).lean();
    const titles = remaining.map((e) => (e as any).title);
    expect(titles).not.toContain("Removable");

    await cleanup(groupID, leaderId);
  });
});

/* ─── Regenerate skips locked events ─────────────────────────────── */

describe("POST /api/groups/[groupId]/itinerary/regenerate — locked events", () => {
  it("returns 400 when all selected event ids are locked", async () => {
    const { leaderId, groupID } = await seed();

    const lockedEv = await CalendarEvent.create({
      title: "Locked Brunch",
      startTime: new Date("2026-07-05T11:00:00Z"),
      endTime: new Date("2026-07-05T12:30:00Z"),
      createdBy: leaderId,
      groupId: groupID,
      source: "itinerary",
      isLocked: true,
    });

    const req = new Request(
      `http://localhost/api/groups/${groupID}/itinerary/regenerate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds: [String(lockedEv._id)] }),
      },
    );

    const res = await POSTRegenerate(req, {
      params: Promise.resolve({ groupId: groupID }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/locked/i);
    expect(data.lockedSkipped).toContain(String(lockedEv._id));

    await cleanup(groupID, leaderId);
  });

  it("returns 400 if any selected ids contain locked events (mixed)", async () => {
    const { leaderId, groupID } = await seed();

    const lockedEv = await CalendarEvent.create({
      title: "Locked Event",
      startTime: new Date("2026-07-06T09:00:00Z"),
      endTime: new Date("2026-07-06T10:00:00Z"),
      createdBy: leaderId,
      groupId: groupID,
      source: "itinerary",
      isLocked: true,
    });

    const unlocked = await CalendarEvent.create({
      title: "Unlocked Event",
      startTime: new Date("2026-07-06T11:00:00Z"),
      endTime: new Date("2026-07-06T12:00:00Z"),
      createdBy: leaderId,
      groupId: groupID,
      source: "itinerary",
      isLocked: false,
    });

    const req = new Request(
      `http://localhost/api/groups/${groupID}/itinerary/regenerate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventIds: [String(lockedEv._id), String(unlocked._id)],
        }),
      },
    );

    const res = await POSTRegenerate(req, {
      params: Promise.resolve({ groupId: groupID }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.lockedSkipped).toContain(String(lockedEv._id));

    await cleanup(groupID, leaderId);
  });

  it("excludes locked events from date-range-based regeneration", async () => {
    const { leaderId, groupID } = await seed();

    await CalendarEvent.create({
      title: "Locked Concert",
      startTime: new Date("2026-07-07T20:00:00Z"),
      endTime: new Date("2026-07-07T22:00:00Z"),
      createdBy: leaderId,
      groupId: groupID,
      source: "itinerary",
      isLocked: true,
    });

    const unlocked = await CalendarEvent.create({
      title: "Flexible Activity",
      startTime: new Date("2026-07-07T14:00:00Z"),
      endTime: new Date("2026-07-07T15:30:00Z"),
      createdBy: leaderId,
      groupId: groupID,
      source: "itinerary",
      isLocked: false,
    });

    const req = new Request(
      `http://localhost/api/groups/${groupID}/itinerary/regenerate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateRange: {
            from: "2026-07-07T00:00:00Z",
            to: "2026-07-08T00:00:00Z",
          },
        }),
      },
    );

    mockGeneratePartial.mockImplementation(async (input: any) =>
      input.targetEvents.map((e: any) => ({
        title: `AI ${e.title}`,
        startTime: new Date(e.startTime),
        endTime: new Date(e.endTime),
        eventType: "activity",
        timezone: "UTC",
      })),
    );

    const res = await POSTRegenerate(req, {
      params: Promise.resolve({ groupId: groupID }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);

    // Only the unlocked event should be in the originals list
    const originalTitles = data.originals.map((o: any) => o.title);
    expect(originalTitles).toContain("Flexible Activity");
    expect(originalTitles).not.toContain("Locked Concert");

    await cleanup(groupID, leaderId);
  });

  it("returns 400 when date range only contains locked events", async () => {
    const { leaderId, groupID } = await seed();

    await CalendarEvent.create({
      title: "Only Locked",
      startTime: new Date("2026-07-08T10:00:00Z"),
      endTime: new Date("2026-07-08T11:00:00Z"),
      createdBy: leaderId,
      groupId: groupID,
      source: "itinerary",
      isLocked: true,
    });

    const req = new Request(
      `http://localhost/api/groups/${groupID}/itinerary/regenerate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateRange: {
            from: "2026-07-08T00:00:00Z",
            to: "2026-07-09T00:00:00Z",
          },
        }),
      },
    );

    const res = await POSTRegenerate(req, {
      params: Promise.resolve({ groupId: groupID }),
    });

    expect(res.status).toBe(400);

    await cleanup(groupID, leaderId);
  });
});

/* ─── Apply rejects locked events ────────────────────────────────── */

describe("POST /api/groups/[groupId]/itinerary/regenerate/apply — locked events", () => {
  it("returns 409 when replaceEventIds includes a locked event", async () => {
    const { leaderId, groupID } = await seed();

    const lockedEv = await CalendarEvent.create({
      title: "Locked Dinner",
      startTime: new Date("2026-07-09T18:00:00Z"),
      endTime: new Date("2026-07-09T20:00:00Z"),
      createdBy: leaderId,
      groupId: groupID,
      source: "itinerary",
      isLocked: true,
    });

    const req = new Request(
      `http://localhost/api/groups/${groupID}/itinerary/regenerate/apply`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replaceEventIds: [String(lockedEv._id)],
          proposedEvents: [
            {
              title: "New Dinner",
              startTime: "2026-07-09T18:00:00Z",
              endTime: "2026-07-09T20:00:00Z",
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

    expect(res.status).toBe(409);
    expect(data.error).toMatch(/locked/i);
    expect(data.lockedIds).toContain(String(lockedEv._id));

    // Locked event must still exist unchanged
    const stillThere = await CalendarEvent.findById(lockedEv._id).lean();
    expect(stillThere).not.toBeNull();

    await cleanup(groupID, leaderId);
  });

  it("applies successfully when no events are locked", async () => {
    const { leaderId, groupID } = await seed();

    const ev = await CalendarEvent.create({
      title: "Replaceable",
      startTime: new Date("2026-07-10T09:00:00Z"),
      endTime: new Date("2026-07-10T10:00:00Z"),
      createdBy: leaderId,
      groupId: groupID,
      source: "itinerary",
      isLocked: false,
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
              title: "New Activity",
              startTime: "2026-07-10T09:00:00Z",
              endTime: "2026-07-10T10:00:00Z",
              eventType: "activity",
              timezone: "UTC",
            },
          ],
        }),
      },
    );

    const res = await POSTApply(req, {
      params: Promise.resolve({ groupId: groupID }),
    });

    expect(res.status).toBe(200);

    const gone = await CalendarEvent.findById(ev._id).lean();
    expect(gone).toBeNull();

    await cleanup(groupID, leaderId);
  });
});
