import { jest } from "@jest/globals";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { Types } from "mongoose";

process.env.OLLAMA_SKIP = "1";
let mockGetServerSession: jest.Mock<any>;

await jest.unstable_mockModule("next-auth", () => ({
  getServerSession: jest.fn(),
}));

await jest.unstable_mockModule("@/lib/auth", () => ({
  authOptions: {},
}));

const nextAuth = await import("next-auth");
const { default: dbConnect } = await import("@/lib/dbConnect");
const { default: User } = await import("@/models/User");
const { default: TravelGroup } = await import("@/models/TravelGroup");
const { default: Trip } = await import("@/models/Trip");
const { default: CalendarEvent } = await import("@/models/CalendarEvent");
const { default: MustHave } = await import("@/models/MustHave");
const { default: Activity } = await import("@/models/Activity");

let POSTGenerate: (
  req: Request,
  ctx: { params: Promise<{ groupId: string }> },
) => Promise<Response>;

const CONNECTION_CLEANUP_DELAY_MS = 500;

beforeAll(async () => {
  await dbConnect();

  const nextAuth = (await import("next-auth")) as any;
  mockGetServerSession = nextAuth.getServerSession as any;
  const gen =
    await import("@/app/api/groups/[groupId]/itinerary/generate/route");
  POSTGenerate = gen.POST as any;
});

afterAll(async () => {
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
});

async function seedLeaderGroupTrip(
  tripOverrides?: Partial<{
    avoidActivities: string[];
    avoidLocations: string[];
    budget: number;
    budgetMin: number;
    budgetMax: number;
  }>,
) {
  const suffix = randomUUID().slice(0, 8);
  const passwordHash = await bcrypt.hash("pw", 10);
  const leader = await User.create({
    username: `gen_lead_${suffix}`,
    email: `gen_lead_${suffix}@test.com`,
    passwordHash,
    school: "Purdue",
  });
  const leaderId = leader.userId.toString();
  const groupID = randomUUID();

  await TravelGroup.create({
    groupID,
    groupName: `Gen Test ${suffix}`,
    leaderID: leaderId,
    membersList: [{ userId: leaderId, role: "Leader" }],
  });

  const trip = await Trip.create({
    groupID,
    userId: leaderId,
    fromCity: "A",
    toCity: "B",
    fromDate: new Date("2026-08-01"),
    toDate: new Date("2026-08-04"),
    mode: "flight",
    budget: tripOverrides?.budget ?? 1000,
    avoidActivities: tripOverrides?.avoidActivities ?? [],
    avoidLocations: tripOverrides?.avoidLocations ?? [],
    ...(tripOverrides?.budgetMin != null ? { budgetMin: tripOverrides.budgetMin } : {}),
    ...(tripOverrides?.budgetMax != null ? { budgetMax: tripOverrides.budgetMax } : {}),
  });

  await MustHave.create({
    groupId: groupID as never,
    name: "Must-see",
    status: "approved",
    addedBy: leaderId as never,
  });

  return { leaderId, groupID, tripId: trip._id.toString() };
}

describe("POST /api/groups/[groupId]/itinerary/generate (Ollama stub)", () => {
  it("returns 403 for non-member", async () => {
    const { leaderId, groupID } = await seedLeaderGroupTrip();
    const outsider = await User.create({
      username: `gen_out_${randomUUID().slice(0, 8)}`,
      email: `gen_out_${randomUUID().slice(0, 8)}@test.com`,
      passwordHash: await bcrypt.hash("p", 10),
      school: "Purdue",
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId: outsider.userId.toString(), email: outsider.email },
      expires: "9999",
    });

    const res = await POSTGenerate(
      new Request(`http://localhost/api/groups/${groupID}/itinerary/generate`, {
        method: "POST",
      }),
      { params: Promise.resolve({ groupId: groupID }) },
    );

    expect(res.status).toBe(403);

    await User.deleteOne({ userId: outsider.userId });
    await CalendarEvent.deleteMany({ groupId: groupID });
    await MustHave.deleteMany({ groupId: groupID as never });
    await Trip.deleteMany({ groupID });
    await TravelGroup.deleteOne({ groupID });
    await User.deleteOne({ userId: leaderId });
  });

  it("drops stub events that match avoidActivities (US14)", async () => {
    const { leaderId, groupID, tripId } = await seedLeaderGroupTrip({
      avoidActivities: ["Explore"],
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId, email: "x@test.com" },
      expires: "9999",
    });

    const res = await POSTGenerate(
      new Request(`http://localhost/api/groups/${groupID}/itinerary/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      }),
      { params: Promise.resolve({ groupId: groupID }) },
    );
    expect(res.status).toBe(200);

    const rows = await CalendarEvent.find({
      groupId: groupID,
      source: "itinerary",
    }).lean();
    expect(rows.length).toBeGreaterThan(0);
    for (const ev of rows) {
      expect(String((ev as { title?: string }).title).toLowerCase()).not.toContain(
        "explore",
      );
    }

    await CalendarEvent.deleteMany({ groupId: groupID });
    await MustHave.deleteMany({ groupId: groupID as never });
    await Trip.deleteMany({ groupID });
    await TravelGroup.deleteOne({ groupID });
    await User.deleteOne({ userId: leaderId });
  });

  it("creates itinerary events for Leader using stub", async () => {
    const { leaderId, groupID } = await seedLeaderGroupTrip();

    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId, email: "x@test.com" },
      expires: "9999",
    });

    const res = await POSTGenerate(
      new Request(`http://localhost/api/groups/${groupID}/itinerary/generate`, {
        method: "POST",
      }),
      { params: Promise.resolve({ groupId: groupID }) },
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.count).toBeGreaterThan(0);

    const n = await CalendarEvent.countDocuments({
      groupId: groupID,
      source: "itinerary",
    });
    expect(n).toBe(data.count);

    await CalendarEvent.deleteMany({ groupId: groupID });
    await MustHave.deleteMany({ groupId: groupID as never });
    await Trip.deleteMany({ groupID });
    await TravelGroup.deleteOne({ groupID });
    await User.deleteOne({ userId: leaderId });
  });

  it("uses selected trip when tripId is provided", async () => {
    const { leaderId, groupID } = await seedLeaderGroupTrip();
    const alternateTrip = await Trip.create({
      groupID,
      userId: leaderId,
      fromCity: "A",
      toCity: "Seattle",
      fromDate: new Date("2026-08-01"),
      toDate: new Date("2026-08-04"),
      mode: "flight",
      budget: 1000,
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId, email: "x@test.com" },
      expires: "9999",
    });

    const res = await POSTGenerate(
      new Request(`http://localhost/api/groups/${groupID}/itinerary/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: alternateTrip._id.toString() }),
      }),
      { params: Promise.resolve({ groupId: groupID }) },
    );

    expect(res.status).toBe(200);
    const generated = await CalendarEvent.find({
      groupId: groupID,
      source: "itinerary",
    }).lean();
    const hasSelectedTripMarker = generated.some((event: any) =>
      String(event.title).includes("Seattle"),
    );
    expect(hasSelectedTripMarker).toBe(true);

    await CalendarEvent.deleteMany({ groupId: groupID });
    await MustHave.deleteMany({ groupId: groupID as never });
    await Trip.deleteMany({ groupID });
    await TravelGroup.deleteOne({ groupID });
    await User.deleteOne({ userId: leaderId });
  });

  it("stores linkedActivityId when an Activity matches an approved must-have placeId", async () => {
    const { leaderId, groupID } = await seedLeaderGroupTrip();
    const placeId = `gen_mh_place_${randomUUID().slice(0, 8)}`;
    const activity = await Activity.create({
      name: "Must-see",
      placeId,
      reviewCount: 0,
    });
    await MustHave.updateOne(
      { groupId: groupID as never, name: "Must-see" },
      { $set: { placeId } },
    );

    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId, email: "x@test.com" },
      expires: "9999",
    });

    const res = await POSTGenerate(
      new Request(`http://localhost/api/groups/${groupID}/itinerary/generate`, {
        method: "POST",
      }),
      { params: Promise.resolve({ groupId: groupID }) },
    );
    expect(res.status).toBe(200);

    const row = await CalendarEvent.findOne({
      groupId: groupID,
      source: "itinerary",
      title: "Must-see",
    }).lean();
    expect(row).toBeTruthy();
    expect(String((row as { linkedActivityId?: string }).linkedActivityId)).toBe(
      activity._id.toString(),
    );

    await CalendarEvent.deleteMany({ groupId: groupID });
    await MustHave.deleteMany({ groupId: groupID as never });
    await Trip.deleteMany({ groupID });
    await TravelGroup.deleteOne({ groupID });
    await User.deleteOne({ userId: leaderId });
    await Activity.deleteOne({ _id: activity._id });
  });

  it("returns 400 when selected trip does not belong to group", async () => {
    const { leaderId, groupID } = await seedLeaderGroupTrip();

    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId, email: "x@test.com" },
      expires: "9999",
    });

    const res = await POSTGenerate(
      new Request(`http://localhost/api/groups/${groupID}/itinerary/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: new Types.ObjectId().toString() }),
      }),
      { params: Promise.resolve({ groupId: groupID }) },
    );

    expect(res.status).toBe(400);

    await CalendarEvent.deleteMany({ groupId: groupID });
    await MustHave.deleteMany({ groupId: groupID as never });
    await Trip.deleteMany({ groupID });
    await TravelGroup.deleteOne({ groupID });
    await User.deleteOne({ userId: leaderId });
  });
});
