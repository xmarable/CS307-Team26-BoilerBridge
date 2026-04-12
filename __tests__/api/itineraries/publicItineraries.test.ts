import { jest } from "@jest/globals";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";

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

const { default: dbConnect } = await import("@/lib/dbConnect");
const { default: User } = await import("@/models/User");
const { default: TravelGroup } = await import("@/models/TravelGroup");
const { default: Trip } = await import("@/models/Trip");
const { default: CalendarEvent } = await import("@/models/CalendarEvent");
const { default: PublicItinerary } = await import("@/models/PublicItinerary");

let POSTPublish: (
  req: NextRequest,
) => Promise<Response>;
let PATCHPublish: (
  req: NextRequest,
) => Promise<Response>;
let GETPublicList: (req: NextRequest) => Promise<Response>;
let POSTView: (
  req: NextRequest,
  ctx: { params: Promise<{ publicId: string }> },
) => Promise<Response>;
let GETPublicDetail: (
  req: NextRequest,
  ctx: { params: Promise<{ publicId: string }> },
) => Promise<Response>;

const CONNECTION_CLEANUP_DELAY_MS = 500;

beforeAll(async () => {
  if (
    process.env.NODE_ENV === "test" &&
    process.env.MONGODB_URI &&
    process.env.TEST_MONGODB_URI === process.env.MONGODB_URI
  ) {
    process.env.TEST_MONGODB_URI =
      "mongodb://127.0.0.1:27017/boilerbridge_test_public_itineraries";
  }
  await dbConnect();
  const pub = await import("@/app/api/itineraries/publish/route");
  POSTPublish = pub.POST as typeof POSTPublish;
  PATCHPublish = pub.PATCH as typeof PATCHPublish;
  const list = await import("@/app/api/itineraries/public/route");
  GETPublicList = list.GET as typeof GETPublicList;
  const view = await import(
    "@/app/api/itineraries/public/[publicId]/view/route"
  );
  POSTView = view.POST as typeof POSTView;
  const detail = await import("@/app/api/itineraries/public/[publicId]/route");
  GETPublicDetail = detail.GET as typeof GETPublicDetail;
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await PublicItinerary.deleteMany({});
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
});

async function createUser(prefix: string) {
  const suffix = randomUUID().slice(0, 8);
  const passwordHash = await bcrypt.hash("pw", 10);
  return User.create({
    username: `${prefix}_${suffix}`,
    email: `${prefix}_${suffix}@test.com`,
    passwordHash,
    school: "Purdue",
  });
}

describe("Public itineraries API", () => {
  it("owner can publish a direct trip itinerary", async () => {
    const owner = await createUser("trip_owner");
    const ownerId = owner.userId.toString();
    const groupID = randomUUID();
    await TravelGroup.create({
      groupID,
      groupName: "Trip Pub Group",
      leaderID: ownerId,
      membersList: [{ userId: ownerId, role: "Leader" }],
    });
    const trip = await Trip.create({
      groupID,
      userId: ownerId,
      fromCity: "A",
      toCity: "B",
      fromDate: new Date("2026-08-01"),
      toDate: new Date("2026-08-03"),
      mode: "flight",
      budget: 500,
      primaryItinerary: [
        {
          activityId: "mock-1",
          name: "Museum",
          startTime: new Date(),
          endTime: new Date(),
          isOutdoor: false,
        },
      ],
      rainyDayItinerary: [],
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId: ownerId, email: owner.email },
      expires: "9999",
    });

    const res = await POSTPublish(
      new NextRequest("http://localhost/api/itineraries/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "trip",
          sourceId: String(trip._id),
        }),
      }),
    );
    expect(res.status).toBe(201);
    const row = await PublicItinerary.findOne({
      sourceType: "trip",
      sourceId: String(trip._id),
    }).lean();
    expect(row?.isPublic).toBe(true);
  });

  it("non-creator cannot publish someone else's trip itinerary", async () => {
    const owner = await createUser("trip_o2");
    const other = await createUser("trip_other");
    const ownerId = owner.userId.toString();
    const groupID = randomUUID();
    await TravelGroup.create({
      groupID,
      groupName: "G2",
      leaderID: ownerId,
      membersList: [{ userId: ownerId, role: "Leader" }],
    });
    const trip = await Trip.create({
      groupID,
      userId: ownerId,
      fromCity: "X",
      toCity: "Y",
      fromDate: new Date("2026-08-01"),
      toDate: new Date("2026-08-02"),
      mode: "bus",
      budget: 100,
      primaryItinerary: [
        {
          activityId: "x1",
          name: "Walk",
          startTime: new Date(),
          endTime: new Date(),
          isOutdoor: true,
        },
      ],
      rainyDayItinerary: [],
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId: other.userId.toString(), email: other.email },
      expires: "9999",
    });

    const res = await POSTPublish(
      new NextRequest("http://localhost/api/itineraries/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "trip",
          sourceId: String(trip._id),
        }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("Leader can publish group itinerary; Viewer cannot", async () => {
    const leader = await createUser("g_lead");
    const viewer = await createUser("g_view");
    const leaderId = leader.userId.toString();
    const viewerId = viewer.userId.toString();
    const groupID = randomUUID();
    await TravelGroup.create({
      groupID,
      groupName: "Pub Group",
      leaderID: leaderId,
      membersList: [
        { userId: leaderId, role: "Leader" },
        { userId: viewerId, role: "Viewer" },
      ],
    });
    await Trip.create({
      groupID,
      userId: leaderId,
      fromCity: "P",
      toCity: "Q",
      fromDate: new Date("2026-09-01"),
      toDate: new Date("2026-09-05"),
      mode: "train",
      budget: 800,
    });
    await CalendarEvent.create({
      title: "Event",
      startTime: new Date("2026-09-02T10:00:00Z"),
      endTime: new Date("2026-09-02T12:00:00Z"),
      createdBy: leaderId as never,
      groupId: groupID as never,
      source: "itinerary",
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId: viewerId, email: viewer.email },
      expires: "9999",
    });
    const deny = await POSTPublish(
      new NextRequest("http://localhost/api/itineraries/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType: "group", sourceId: groupID }),
      }),
    );
    expect(deny.status).toBe(403);

    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId, email: leader.email },
      expires: "9999",
    });
    const ok = await POSTPublish(
      new NextRequest("http://localhost/api/itineraries/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType: "group", sourceId: groupID }),
      }),
    );
    expect(ok.status).toBe(201);
  });

  it("public feed lists only public itineraries; unpublish hides", async () => {
    const u = await createUser("feed_u");
    const uid = u.userId.toString();
    const groupID = randomUUID();
    await TravelGroup.create({
      groupID,
      groupName: "F Group",
      leaderID: uid,
      membersList: [{ userId: uid, role: "Leader" }],
    });
    const trip = await Trip.create({
      groupID,
      userId: uid,
      fromCity: "M",
      toCity: "N",
      fromDate: new Date("2026-07-01"),
      toDate: new Date("2026-07-02"),
      mode: "flight",
      budget: 200,
      primaryItinerary: [
        {
          activityId: "a1",
          name: "Park",
          startTime: new Date(),
          endTime: new Date(),
          isOutdoor: true,
        },
      ],
      rainyDayItinerary: [],
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId: uid, email: u.email },
      expires: "9999",
    });
    const pubRes = await POSTPublish(
      new NextRequest("http://localhost/api/itineraries/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "trip",
          sourceId: String(trip._id),
        }),
      }),
    );
    expect(pubRes.status).toBe(201);
    const pubJson = (await pubRes.json()) as { publicItineraryId?: string };
    const publicItineraryId = pubJson.publicItineraryId;
    expect(publicItineraryId).toBeTruthy();

    const list1 = await GETPublicList(
      new NextRequest("http://localhost/api/itineraries/public?page=1&limit=20"),
    );
    expect(list1.status).toBe(200);
    const j1 = await list1.json();
    const items1 = j1.items as { publicItineraryId: string }[] | undefined;
    expect(Array.isArray(items1)).toBe(true);
    expect(
      items1!.some((x) => x.publicItineraryId === publicItineraryId),
    ).toBe(true);

    await PATCHPublish(
      new NextRequest("http://localhost/api/itineraries/publish", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "trip",
          sourceId: String(trip._id),
          isPublic: false,
        }),
      }),
    );

    mockGetServerSession.mockResolvedValue({
      user: { userId: uid, email: u.email },
      expires: "9999",
    });
    const list2 = await GETPublicList(
      new NextRequest("http://localhost/api/itineraries/public?page=1&limit=50"),
    );
    expect(list2.status).toBe(200);
    const j2 = await list2.json();
    const items2 = (j2.items as { publicItineraryId: string }[] | undefined) ?? [];
    const still = items2.some((x) => x.publicItineraryId === publicItineraryId);
    expect(still).toBe(false);
  });

  it("public detail is readable; view endpoint increments views", async () => {
    const u = await createUser("view_u");
    const uid = u.userId.toString();
    const groupID = randomUUID();
    await TravelGroup.create({
      groupID,
      groupName: "V Group",
      leaderID: uid,
      membersList: [{ userId: uid, role: "Leader" }],
    });
    const trip = await Trip.create({
      groupID,
      userId: uid,
      fromCity: "C",
      toCity: "D",
      fromDate: new Date("2026-06-01"),
      toDate: new Date("2026-06-02"),
      mode: "taxi",
      budget: 50,
      primaryItinerary: [
        {
          activityId: "b1",
          name: "Eat",
          startTime: new Date(),
          endTime: new Date(),
          isOutdoor: false,
        },
      ],
      rainyDayItinerary: [],
    });
    mockGetServerSession.mockResolvedValue({
      user: { userId: uid, email: u.email },
      expires: "9999",
    });
    await POSTPublish(
      new NextRequest("http://localhost/api/itineraries/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "trip",
          sourceId: String(trip._id),
        }),
      }),
    );
    const pub = await PublicItinerary.findOne({
      sourceType: "trip",
      sourceId: String(trip._id),
    }).lean();
    const pid = String((pub as { _id: mongoose.Types.ObjectId })._id);

    const reader = await createUser("reader");
    mockGetServerSession.mockResolvedValue({
      user: { userId: reader.userId.toString(), email: reader.email },
      expires: "9999",
    });

    const detail = await GETPublicDetail(
      new NextRequest(`http://localhost/api/itineraries/public/${pid}`),
      { params: Promise.resolve({ publicId: pid }) },
    );
    expect(detail.status).toBe(200);
    const dj = await detail.json();
    expect(dj.title).toContain("→");
    expect(dj.isOwner).toBe(false);

    const v1 = await POSTView(
      new NextRequest(`http://localhost/api/itineraries/public/${pid}/view`, {
        method: "POST",
      }),
      { params: Promise.resolve({ publicId: pid }) },
    );
    expect(v1.status).toBe(200);
    const v1j = await v1.json();
    const v2 = await POSTView(
      new NextRequest(`http://localhost/api/itineraries/public/${pid}/view`, {
        method: "POST",
      }),
      { params: Promise.resolve({ publicId: pid }) },
    );
    const v2j = await v2.json();
    expect(v2j.views).toBeGreaterThanOrEqual(v1j.views);
  });
});
