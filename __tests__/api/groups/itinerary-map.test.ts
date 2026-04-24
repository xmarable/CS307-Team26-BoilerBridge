import { jest } from "@jest/globals";
import mongoose from "mongoose";
import { randomUUID } from "crypto";

await jest.unstable_mockModule("next-auth", () => ({
  getServerSession: jest.fn(),
}));

await jest.unstable_mockModule("@/lib/auth", () => ({
  authOptions: {},
}));

const nextAuth = await import("next-auth");
const { default: bcrypt } = await import("bcryptjs");
const { default: dbConnect } = await import("@/lib/dbConnect");
const { default: User } = await import("@/models/User");
const { default: TravelGroup } = await import("@/models/TravelGroup");
const { default: ItineraryStop } = await import("@/models/ItineraryStop");

const mockGetServerSession = nextAuth.getServerSession as jest.MockedFunction<
  typeof nextAuth.getServerSession
>;

let GET_STOPS: (req: Request, ctx: { params: Promise<{ groupId: string }> }) => Promise<Response>;
let POST_STOP: (req: Request, ctx: { params: Promise<{ groupId: string }> }) => Promise<Response>;
let PUT_STOP: (req: Request, ctx: { params: Promise<{ groupId: string; id: string }> }) => Promise<Response>;
let DELETE_STOP: (req: Request, ctx: { params: Promise<{ groupId: string; id: string }> }) => Promise<Response>;

let leaderId: string;
let memberId: string;
let outsiderId: string;
let groupUUID: string;

beforeAll(async () => {
  await dbConnect();
  await ItineraryStop.deleteMany({});
  await TravelGroup.deleteMany({});
  await User.deleteMany({});

  const hash = await bcrypt.hash("pass", 10);

  const leader = await User.create({
    username: "map_leader",
    email: "map_leader@test.com",
    passwordHash: hash,
    school: "Purdue",
  });
  const member = await User.create({
    username: "map_member",
    email: "map_member@test.com",
    passwordHash: hash,
    school: "Purdue",
  });
  const outsider = await User.create({
    username: "map_outsider",
    email: "map_outsider@test.com",
    passwordHash: hash,
    school: "Purdue",
  });

  leaderId = leader.userId.toString();
  memberId = member.userId.toString();
  outsiderId = outsider.userId.toString();

  const group = await TravelGroup.create({
    groupName: "Map Test Group",
    leaderID: leaderId,
    membersList: [
      { userId: leaderId, role: "Leader" },
      { userId: memberId, role: "Viewer" },
    ],
  });
  groupUUID = group.groupID.toString();

  const listRoute = await import("@/app/api/groups/[groupId]/itinerary/map/route");
  GET_STOPS = listRoute.GET as any;
  POST_STOP = listRoute.POST as any;

  const itemRoute = await import("@/app/api/groups/[groupId]/itinerary/map/[id]/route");
  PUT_STOP = itemRoute.PUT as any;
  DELETE_STOP = itemRoute.DELETE as any;
});

afterAll(async () => {
  await ItineraryStop.deleteMany({});
  await TravelGroup.deleteMany({});
  await User.deleteMany({});
  jest.resetModules();
  jest.clearAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
});

function makeGet(groupId: string, query = "") {
  return new Request(`http://localhost/api/groups/${groupId}/itinerary/map${query}`);
}

function makePost(groupId: string, body: object) {
  return new Request(`http://localhost/api/groups/${groupId}/itinerary/map`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePut(groupId: string, id: string, body: object) {
  return new Request(`http://localhost/api/groups/${groupId}/itinerary/map/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDelete(groupId: string, id: string) {
  return new Request(`http://localhost/api/groups/${groupId}/itinerary/map/${id}`, {
    method: "DELETE",
  });
}

// ─── GET ─────────────────────────────────────────────────────────────────────

describe("GET /api/groups/:groupId/itinerary/map", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET_STOPS(makeGet(groupUUID), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when group does not exist", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: leaderId }, expires: "9999" });
    const fakeGroup = randomUUID();
    const res = await GET_STOPS(makeGet(fakeGroup), {
      params: Promise.resolve({ groupId: fakeGroup }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not a group member", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: outsiderId }, expires: "9999" });
    const res = await GET_STOPS(makeGet(groupUUID), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 200 with empty stops array when no stops exist", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: memberId }, expires: "9999" });
    const res = await GET_STOPS(makeGet(groupUUID), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.stops)).toBe(true);
    expect(data.stops.length).toBe(0);
  });

  it("returns stops sorted by order and includes hasCoordinates flag", async () => {
    await ItineraryStop.create([
      { groupId: groupUUID, title: "Stop B", order: 2, createdBy: leaderId, lat: 40.42, lng: -86.92 },
      { groupId: groupUUID, title: "Stop A", order: 1, createdBy: leaderId },
      { groupId: groupUUID, title: "Stop C", order: 3, createdBy: leaderId, lat: 40.50, lng: -87.00 },
    ]);

    mockGetServerSession.mockResolvedValue({ user: { userId: leaderId }, expires: "9999" });
    const res = await GET_STOPS(makeGet(groupUUID), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.stops.length).toBe(3);
    expect(data.stops[0].title).toBe("Stop A");
    expect(data.stops[1].title).toBe("Stop B");
    expect(data.stops[2].title).toBe("Stop C");

    // Stop A has no coordinates
    expect(data.stops[0].hasCoordinates).toBe(false);
    // Stop B has coordinates
    expect(data.stops[1].hasCoordinates).toBe(true);
    // Stop C has coordinates
    expect(data.stops[2].hasCoordinates).toBe(true);

    await ItineraryStop.deleteMany({ groupId: groupUUID });
  });

  it("filters stops by tripId when query param is provided", async () => {
    const tripA = "trip-uuid-aaa";
    const tripB = "trip-uuid-bbb";
    await ItineraryStop.create([
      { groupId: groupUUID, title: "Trip A Stop", order: 1, createdBy: leaderId, tripId: tripA },
      { groupId: groupUUID, title: "Trip B Stop", order: 1, createdBy: leaderId, tripId: tripB },
      { groupId: groupUUID, title: "No Trip Stop", order: 2, createdBy: leaderId },
    ]);

    mockGetServerSession.mockResolvedValue({ user: { userId: leaderId }, expires: "9999" });
    const res = await GET_STOPS(makeGet(groupUUID, `?tripId=${tripA}`), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.stops.length).toBe(1);
    expect(data.stops[0].title).toBe("Trip A Stop");

    await ItineraryStop.deleteMany({ groupId: groupUUID });
  });
});

// ─── POST ────────────────────────────────────────────────────────────────────

describe("POST /api/groups/:groupId/itinerary/map", () => {
  afterEach(async () => {
    await ItineraryStop.deleteMany({ groupId: groupUUID });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST_STOP(makePost(groupUUID, { title: "Stop", order: 0 }), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not a group member", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: outsiderId }, expires: "9999" });
    const res = await POST_STOP(makePost(groupUUID, { title: "Stop", order: 0 }), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 when title is missing", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: memberId }, expires: "9999" });
    const res = await POST_STOP(makePost(groupUUID, { order: 0 }), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/title/i);
  });

  it("returns 400 when order is missing", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: memberId }, expires: "9999" });
    const res = await POST_STOP(makePost(groupUUID, { title: "Stop" }), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/order/i);
  });

  it("returns 400 when lat is out of range", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: memberId }, expires: "9999" });
    const res = await POST_STOP(makePost(groupUUID, { title: "Stop", order: 0, lat: 200, lng: 0 }), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/lat/i);
  });

  it("returns 400 when lng is out of range", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: memberId }, expires: "9999" });
    const res = await POST_STOP(makePost(groupUUID, { title: "Stop", order: 0, lat: 40.42, lng: -200 }), {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/lng/i);
  });

  it("creates a stop with coordinates and returns 201", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: memberId }, expires: "9999" });
    const res = await POST_STOP(
      makePost(groupUUID, {
        title: "Purdue Bell Tower",
        placeName: "Bell Tower",
        address: "West Lafayette, IN",
        lat: 40.4237,
        lng: -86.9212,
        order: 1,
        notes: "Meet here at noon",
      }),
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.stop).toBeDefined();
    expect(data.stop.title).toBe("Purdue Bell Tower");
    expect(data.stop.lat).toBe(40.4237);
    expect(data.stop.lng).toBe(-86.9212);
    expect(data.stop.createdBy).toBe(memberId);
  });

  it("creates a stop without coordinates", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: memberId }, expires: "9999" });
    const res = await POST_STOP(
      makePost(groupUUID, { title: "TBD Location", order: 2 }),
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.stop.lat).toBeUndefined();
    expect(data.stop.lng).toBeUndefined();
  });
});

// ─── PUT ─────────────────────────────────────────────────────────────────────

describe("PUT /api/groups/:groupId/itinerary/map/:id", () => {
  let stopCreatedByMember: string;
  let stopCreatedByLeader: string;

  beforeAll(async () => {
    const s1 = await ItineraryStop.create({
      groupId: groupUUID,
      title: "Member Stop",
      order: 1,
      createdBy: memberId,
    });
    const s2 = await ItineraryStop.create({
      groupId: groupUUID,
      title: "Leader Stop",
      order: 2,
      createdBy: leaderId,
    });
    stopCreatedByMember = s1._id.toString();
    stopCreatedByLeader = s2._id.toString();
  });

  afterAll(async () => {
    await ItineraryStop.deleteMany({ groupId: groupUUID });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await PUT_STOP(makePut(groupUUID, stopCreatedByMember, { title: "Updated" }), {
      params: Promise.resolve({ groupId: groupUUID, id: stopCreatedByMember }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when stop does not exist", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: leaderId }, expires: "9999" });
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await PUT_STOP(makePut(groupUUID, fakeId, { title: "Updated" }), {
      params: Promise.resolve({ groupId: groupUUID, id: fakeId }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when a non-creator non-admin tries to update", async () => {
    // outsider is not in the group at all → will get 403 at membership check
    mockGetServerSession.mockResolvedValue({ user: { userId: outsiderId }, expires: "9999" });
    const res = await PUT_STOP(makePut(groupUUID, stopCreatedByMember, { title: "Hacked" }), {
      params: Promise.resolve({ groupId: groupUUID, id: stopCreatedByMember }),
    });
    expect(res.status).toBe(403);
  });

  it("allows the creator to update their own stop", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: memberId }, expires: "9999" });
    const res = await PUT_STOP(
      makePut(groupUUID, stopCreatedByMember, { title: "Updated by Member", order: 5 }),
      { params: Promise.resolve({ groupId: groupUUID, id: stopCreatedByMember }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.stop.title).toBe("Updated by Member");
    expect(data.stop.order).toBe(5);
  });

  it("allows the group leader (admin) to update a stop they did not create", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: leaderId }, expires: "9999" });
    const res = await PUT_STOP(
      makePut(groupUUID, stopCreatedByMember, { title: "Admin Override" }),
      { params: Promise.resolve({ groupId: groupUUID, id: stopCreatedByMember }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.stop.title).toBe("Admin Override");
  });

  it("returns 400 when updated lat is out of range", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: leaderId }, expires: "9999" });
    const res = await PUT_STOP(
      makePut(groupUUID, stopCreatedByLeader, { lat: -200 }),
      { params: Promise.resolve({ groupId: groupUUID, id: stopCreatedByLeader }) },
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/lat/i);
  });
});

// ─── DELETE ──────────────────────────────────────────────────────────────────

describe("DELETE /api/groups/:groupId/itinerary/map/:id", () => {
  let stopId: string;

  beforeEach(async () => {
    const s = await ItineraryStop.create({
      groupId: groupUUID,
      title: "Deletable Stop",
      order: 1,
      createdBy: memberId,
    });
    stopId = s._id.toString();
  });

  afterEach(async () => {
    await ItineraryStop.findByIdAndDelete(stopId).catch(() => {});
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await DELETE_STOP(makeDelete(groupUUID, stopId), {
      params: Promise.resolve({ groupId: groupUUID, id: stopId }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not a group member", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: outsiderId }, expires: "9999" });
    const res = await DELETE_STOP(makeDelete(groupUUID, stopId), {
      params: Promise.resolve({ groupId: groupUUID, id: stopId }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 when stop does not exist", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: leaderId }, expires: "9999" });
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await DELETE_STOP(makeDelete(groupUUID, fakeId), {
      params: Promise.resolve({ groupId: groupUUID, id: fakeId }),
    });
    expect(res.status).toBe(404);
  });

  it("allows the creator to delete their stop", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: memberId }, expires: "9999" });
    const res = await DELETE_STOP(makeDelete(groupUUID, stopId), {
      params: Promise.resolve({ groupId: groupUUID, id: stopId }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toMatch(/deleted/i);

    const gone = await ItineraryStop.findById(stopId);
    expect(gone).toBeNull();
  });

  it("allows the group leader to delete a stop they did not create", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: leaderId }, expires: "9999" });
    const res = await DELETE_STOP(makeDelete(groupUUID, stopId), {
      params: Promise.resolve({ groupId: groupUUID, id: stopId }),
    });
    expect(res.status).toBe(200);

    const gone = await ItineraryStop.findById(stopId);
    expect(gone).toBeNull();
  });
});
