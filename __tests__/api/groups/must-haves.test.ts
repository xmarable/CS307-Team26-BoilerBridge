/** @jest-environment node */

import { jest } from "@jest/globals";
import mongoose from "mongoose";

const CONNECTION_CLEANUP_DELAY_MS = 500;

let GET: any, POST: any, PUT: any, DELETE: any, GENERATE: any;
let User: any,
  TravelGroup: any,
  MustHave: any,
  CalendarEvent: any,
  Trip: any,
  dbConnect: any,
  bcrypt: any;
let mockGetServerSession: any;

let groupUUID: string, leaderId: string, memberId: string, outsiderId: string;

await jest.unstable_mockModule("next-auth", () => ({
  getServerSession: jest.fn(),
}));

await jest.unstable_mockModule("@/lib/auth", () => ({
  authOptions: {},
}));

await jest.unstable_mockModule("@/lib/itinerary/generateFull", () => ({
  generateFullTripEvents: jest.fn(async (ctx: any, mustHaves: any[]) => {
    if (!mustHaves.length) {
      const s = new Date(ctx.fromDate.getTime() + 10 * 3600000);
      const e = new Date(ctx.fromDate.getTime() + 12 * 3600000);
      return [
        {
          title: `Explore ${ctx.toCity}`,
          description: "Mock itinerary with no must-haves",
          startTime: s,
          endTime: e,
          location: ctx.toCity,
          eventType: "activity",
          timezone: "UTC",
        },
      ];
    }
    return mustHaves.map((mh: any, i: number) => ({
      title: mh.name,
      description: mh.notes || "Mock description",
      startTime: new Date(ctx.fromDate.getTime() + i * 3600000),
      endTime: new Date(ctx.fromDate.getTime() + (i + 1) * 3600000),
      location: mh.address,
      eventType: mh.category || "activity",
      timezone: "UTC",
    }));
  }),
}));

beforeAll(async () => {
  jest.resetModules();

  const nextAuth = (await import("next-auth")) as any;
  mockGetServerSession = nextAuth.getServerSession as any;

  ({ default: bcrypt } = await import("bcryptjs"));
  ({ default: dbConnect } = await import("@/lib/dbConnect"));
  ({ default: User } = await import("@/models/User"));
  ({ default: TravelGroup } = await import("@/models/TravelGroup"));
  ({ default: MustHave } = await import("@/models/MustHave"));
  ({ default: CalendarEvent } = await import("@/models/CalendarEvent"));
  ({ default: Trip } = await import("@/models/Trip"));

  await dbConnect();

  await MustHave.deleteMany({});
  await CalendarEvent.deleteMany({});
  await Trip.deleteMany({});
  await TravelGroup.deleteMany({});
  await User.deleteMany({});

  const hash = await bcrypt.hash("pass", 10);

  const leader = await User.create({
    username: "mh_leader",
    email: "mh_leader@test.com",
    passwordHash: hash,
    school: "Purdue",
  });
  const member = await User.create({
    username: "mh_member",
    email: "mh_member@test.com",
    passwordHash: hash,
    school: "Purdue",
  });
  const outsider = await User.create({
    username: "mh_outsider",
    email: "mh_outsider@test.com",
    passwordHash: hash,
    school: "Purdue",
  });

  leaderId = leader.userId.toString();
  memberId = member.userId.toString();
  outsiderId = outsider.userId.toString();

  const group = await TravelGroup.create({
    groupName: "Must-Haves Test Group",
    leaderID: leaderId,
    membersList: [
      { userId: leaderId, role: "Leader" },
      { userId: memberId, role: "Viewer" },
    ],
  });

  groupUUID = group.groupID.toString();

  const collectionRoute =
    await import("@/app/api/groups/[groupId]/must-haves/route");
  GET = collectionRoute.GET;
  POST = collectionRoute.POST;

  const itemRoute =
    await import("@/app/api/groups/[groupId]/must-haves/[id]/route");
  PUT = itemRoute.PUT;
  DELETE = itemRoute.DELETE;

  const generateRoute =
    await import("@/app/api/groups/[groupId]/itinerary/generate/route");
  GENERATE = generateRoute.POST;
});

afterAll(async () => {
  if (MustHave && CalendarEvent && Trip && TravelGroup && User) {
    await MustHave.deleteMany({});
    await CalendarEvent.deleteMany({});
    await Trip.deleteMany({});
    await TravelGroup.deleteMany({});
    await User.deleteMany({});
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    await mongoose.connection.close(true);
  }

  if ((global as any).mongoose) {
    (global as any).mongoose.conn = null;
    (global as any).mongoose.promise = null;
  }

  jest.clearAllMocks();
  jest.resetModules();

  await new Promise((resolve) =>
    setTimeout(resolve, CONNECTION_CLEANUP_DELAY_MS),
  );
});

beforeEach(() => jest.clearAllMocks());

function makeGetRequest(gId: string, query = "") {
  return new Request(`http://localhost/api/groups/${gId}/must-haves${query}`);
}

function makePostRequest(gId: string, body: object) {
  return new Request(`http://localhost/api/groups/${gId}/must-haves`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePutRequest(gId: string, id: string, body: object) {
  return new Request(`http://localhost/api/groups/${gId}/must-haves/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest(gId: string, id: string) {
  return new Request(`http://localhost/api/groups/${gId}/must-haves/${id}`, {
    method: "DELETE",
  });
}

function makeGenerateRequest(gId: string) {
  return new Request(`http://localhost/api/groups/${gId}/itinerary/generate`, {
    method: "POST",
  });
}

// ─── GET ─────────────────────────────────────────────────────────────────────

describe("GET /api/groups/:groupId/must-haves", () => {
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

  it("returns 200 with must-haves array for group members", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const res = await GET(makeGetRequest(groupUUID), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.mustHaves)).toBe(true);
  });

  it("returns 200 with must-haves array for group leader", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await GET(makeGetRequest(groupUUID), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.mustHaves)).toBe(true);
  });

  it("filters results by status", async () => {
    await MustHave.create([
      {
        groupId: groupUUID,
        name: "Proposed Place",
        addedBy: leaderId,
        status: "proposed",
      },
      {
        groupId: groupUUID,
        name: "Approved Place",
        addedBy: leaderId,
        status: "approved",
      },
    ] as any[]);

    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await GET(makeGetRequest(groupUUID, "?status=approved"), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mustHaves.every((m: any) => m.status === "approved")).toBe(
      true,
    );
  });

  it("filters results by category", async () => {
    await MustHave.create({
      groupId: groupUUID,
      name: "Italian Restaurant",
      addedBy: leaderId,
      status: "proposed",
      category: "food",
    } as any);

    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await GET(makeGetRequest(groupUUID, "?category=food"), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mustHaves.every((m: any) => m.category === "food")).toBe(true);
  });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe("POST /api/groups/:groupId/must-haves", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(makePostRequest(groupUUID, { name: "Test" }), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-members", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: outsiderId },
      expires: "9999",
    });
    const res = await POST(makePostRequest(groupUUID, { name: "Test Place" }), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 when name is missing", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await POST(makePostRequest(groupUUID, { category: "food" }), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when priority is out of range", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await POST(
      makePostRequest(groupUUID, { name: "Bad Priority", priority: 10 }),
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(400);
  });

  it("creates a must-have and returns 201 with correct fields", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await POST(
      makePostRequest(groupUUID, {
        name: "Eiffel Tower",
        category: "landmark",
        address: "Champ de Mars, Paris",
        priority: 5,
      }),
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.mustHave).toBeDefined();
    expect(data.mustHave.name).toBe("Eiffel Tower");
    expect(data.mustHave.status).toBe("proposed");
    expect(data.mustHave.priority).toBe(5);
    expect(data.mustHave.category).toBe("landmark");
  });

  it("uses default priority=3 and status=proposed when not provided", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const res = await POST(
      makePostRequest(groupUUID, { name: "Louvre Museum" }),
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.mustHave.priority).toBe(3);
    expect(data.mustHave.status).toBe("proposed");
  });

  it("returns 409 when duplicate placeId is submitted", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    await POST(
      makePostRequest(groupUUID, {
        name: "Colosseum",
        placeId: "place-colosseum-001",
      }),
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    const res = await POST(
      makePostRequest(groupUUID, {
        name: "Colosseum Again",
        placeId: "place-colosseum-001",
      }),
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toMatch(/duplicate/i);
  });

  it("returns 409 when same name+address already exists", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    await POST(
      makePostRequest(groupUUID, {
        name: "Trevi Fountain",
        address: "Piazza di Trevi, Rome",
      }),
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    const res = await POST(
      makePostRequest(groupUUID, {
        name: "Trevi Fountain",
        address: "Piazza di Trevi, Rome",
      }),
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(409);
  });
});

// ─── PUT ─────────────────────────────────────────────────────────────────────

describe("PUT /api/groups/:groupId/must-haves/:id", () => {
  let leaderItemId: string;
  let memberItemId: string;

  beforeAll(async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const leaderRes = await POST(
      makePostRequest(groupUUID, { name: "Leader's Landmark", priority: 4 }),
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    leaderItemId = (await leaderRes.json()).mustHave._id;

    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const memberRes = await POST(
      makePostRequest(groupUUID, { name: "Member's Spot", priority: 2 }),
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    memberItemId = (await memberRes.json()).mustHave._id;
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await PUT(
      makePutRequest(groupUUID, leaderItemId, { priority: 5 }),
      { params: Promise.resolve({ groupId: groupUUID, id: leaderItemId }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-members", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: outsiderId },
      expires: "9999",
    });
    const res = await PUT(
      makePutRequest(groupUUID, leaderItemId, { priority: 5 }),
      { params: Promise.resolve({ groupId: groupUUID, id: leaderItemId }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 for a non-existent must-have", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await PUT(makePutRequest(groupUUID, fakeId, { priority: 5 }), {
      params: Promise.resolve({ groupId: groupUUID, id: fakeId }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when non-creator non-leader tries to edit", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const res = await PUT(
      makePutRequest(groupUUID, leaderItemId, { priority: 1 }),
      { params: Promise.resolve({ groupId: groupUUID, id: leaderItemId }) },
    );
    expect(res.status).toBe(403);
  });

  it("allows creator to update their must-have", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const res = await PUT(
      makePutRequest(groupUUID, memberItemId, {
        priority: 5,
        notes: "Must visit!",
      }),
      { params: Promise.resolve({ groupId: groupUUID, id: memberItemId }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mustHave.priority).toBe(5);
    expect(data.mustHave.notes).toBe("Must visit!");
  });

  it("allows leader to update any must-have (including status)", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await PUT(
      makePutRequest(groupUUID, memberItemId, { status: "approved" }),
      { params: Promise.resolve({ groupId: groupUUID, id: memberItemId }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mustHave.status).toBe("approved");
  });
});

// ─── DELETE ──────────────────────────────────────────────────────────────────

describe("DELETE /api/groups/:groupId/must-haves/:id", () => {
  let itemId: string;

  beforeEach(async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const res = await POST(
      makePostRequest(groupUUID, {
        name: `Delete Test ${Date.now()}`,
        priority: 1,
      }),
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    itemId = (await res.json()).mustHave._id;
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await DELETE(makeDeleteRequest(groupUUID, itemId), {
      params: Promise.resolve({ groupId: groupUUID, id: itemId }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-members", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: outsiderId },
      expires: "9999",
    });
    const res = await DELETE(makeDeleteRequest(groupUUID, itemId), {
      params: Promise.resolve({ groupId: groupUUID, id: itemId }),
    });
    expect(res.status).toBe(403);
  });

  it("allows creator to delete their own must-have", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const res = await DELETE(makeDeleteRequest(groupUUID, itemId), {
      params: Promise.resolve({ groupId: groupUUID, id: itemId }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("allows group leader to delete any must-have", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await DELETE(makeDeleteRequest(groupUUID, itemId), {
      params: Promise.resolve({ groupId: groupUUID, id: itemId }),
    });
    expect(res.status).toBe(200);
  });

  it("returns 404 for a must-have that does not exist", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await DELETE(makeDeleteRequest(groupUUID, fakeId), {
      params: Promise.resolve({ groupId: groupUUID, id: fakeId }),
    });
    expect(res.status).toBe(404);
  });
});

// ─── ITINERARY GENERATION ─────────────────────────────────────────────────────

describe("POST /api/groups/:groupId/itinerary/generate (must-haves integration)", () => {
  beforeAll(async () => {
    await MustHave.deleteMany({});
    await CalendarEvent.deleteMany({ source: "itinerary" } as any);
    await Trip.deleteMany({});

    await Trip.create({
      groupID: groupUUID,
      userId: leaderId,
      fromCity: "New York",
      toCity: "Paris",
      fromDate: new Date("2026-06-01"),
      toDate: new Date("2026-06-10"),
      mode: "flight",
      budget: 5000,
    } as any);

    await MustHave.insertMany([
      {
        groupId: groupUUID,
        name: "Eiffel Tower",
        address: "Champ de Mars, Paris",
        category: "landmark",
        priority: 5,
        addedBy: leaderId,
        status: "approved",
      },
      {
        groupId: groupUUID,
        name: "Louvre Museum",
        address: "Rue de Rivoli, Paris",
        category: "museum",
        priority: 4,
        addedBy: memberId,
        status: "approved",
      },
    ] as any[]);
  });

  it("generates calendar events from approved must-haves", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });

    const res = await GENERATE(makeGenerateRequest(groupUUID), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    // finalizeItineraryProposedEvents injects outbound + return travel for intercity trips
    expect(data.count).toBe(4);
    expect(data.message).toMatch(/itinerary/i);

    const events = await CalendarEvent.find({
      groupId: groupUUID,
      source: "itinerary",
    } as any);
    expect(events.length).toBe(4);
    const titles = events.map((e: { title: any }) => e.title);
    expect(titles).toContain("Eiffel Tower");
    expect(titles).toContain("Louvre Museum");
    expect(titles.some((t: string) => /Travel:.*→/.test(t))).toBe(true);
  });

  it("prioritizes higher-priority must-haves (sorted by priority desc)", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });

    const events = await CalendarEvent.find({
      groupId: groupUUID,
      source: "itinerary",
    } as any).sort({ startTime: 1 });
    const eiffel = events.find((ev: { title: string }) => ev.title === "Eiffel Tower");
    const louvre = events.find((ev: { title: string }) => ev.title === "Louvre Museum");
    expect(eiffel && louvre).toBeTruthy();
    expect(new Date(eiffel.startTime).getTime()).toBeLessThan(
      new Date(louvre.startTime).getTime(),
    );
  });

  it("does not include proposed or rejected must-haves in the itinerary", async () => {
    await CalendarEvent.deleteMany({ source: "itinerary" } as any);

    await MustHave.create([
      {
        groupId: groupUUID,
        name: "Proposed Spot",
        addedBy: leaderId,
        status: "proposed",
      },
      {
        groupId: groupUUID,
        name: "Rejected Spot",
        addedBy: leaderId,
        status: "rejected",
      },
    ] as any[]);

    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });

    const res = await GENERATE(makeGenerateRequest(groupUUID), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(200);

    const events = await CalendarEvent.find({
      groupId: groupUUID,
      source: "itinerary",
    } as any);
    const titles = events.map((e: { title: any }) => e.title);
    expect(titles).not.toContain("Proposed Spot");
    expect(titles).not.toContain("Rejected Spot");
  });

  it("still generates an itinerary when no approved must-haves exist", async () => {
    const hash = await bcrypt.hash("pass", 10);
    const emptyLeader = await User.create({
      username: "gen_empty_leader",
      email: "gen_empty@test.com",
      passwordHash: hash,
      school: "Purdue",
    });
    const emptyGroup = await TravelGroup.create({
      groupName: "Empty Group",
      leaderID: emptyLeader.userId.toString(),
      membersList: [{ userId: emptyLeader.userId.toString(), role: "Leader" }],
    });
    const emptyUUID = emptyGroup.groupID.toString();

    await Trip.create({
      groupID: emptyUUID,
      userId: emptyLeader.userId.toString(),
      fromCity: "NYC",
      toCity: "LA",
      fromDate: new Date("2026-07-01"),
      toDate: new Date("2026-07-05"),
      mode: "flight",
      budget: 1000,
    } as any);

    mockGetServerSession.mockResolvedValue({
      user: { userId: emptyLeader.userId.toString() },
      expires: "9999",
    });

    const res = await GENERATE(makeGenerateRequest(emptyUUID), {
      params: Promise.resolve({ groupId: emptyUUID }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBeGreaterThan(0);
  });

  it("returns 404 when no trip is found for the group", async () => {
    const hash = await bcrypt.hash("pass", 10);
    const noTripLeader = await User.create({
      username: "gen_notrip_leader",
      email: "gen_notrip@test.com",
      passwordHash: hash,
      school: "Purdue",
    });
    const noTripGroup = await TravelGroup.create({
      groupName: "No Trip Group",
      leaderID: noTripLeader.userId.toString(),
      membersList: [{ userId: noTripLeader.userId.toString(), role: "Leader" }],
    });
    const noTripUUID = noTripGroup.groupID.toString();

    mockGetServerSession.mockResolvedValue({
      user: { userId: noTripLeader.userId.toString() },
      expires: "9999",
    });

    const res = await GENERATE(makeGenerateRequest(noTripUUID), {
      params: Promise.resolve({ groupId: noTripUUID }),
    });
    expect(res.status).toBe(404);
  });
});
