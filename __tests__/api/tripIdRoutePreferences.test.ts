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

await jest.unstable_mockModule("@/lib/rainyDayEngine", () => ({
  generateRainyDayPlan: (primary: unknown[]) => primary,
}));

const nextAuth = await import("next-auth");
const mockGetServerSession = nextAuth.getServerSession as jest.MockedFunction<
  typeof nextAuth.getServerSession
>;

const { default: dbConnect } = await import("@/lib/dbConnect");
const { default: User } = await import("@/models/User");
const { default: TravelGroup } = await import("@/models/TravelGroup");
const { default: Trip } = await import("@/models/Trip");
const { default: MustHave } = await import("@/models/MustHave");

const tripRoute = await import("@/app/api/trip/[tripId]/route");
const GET = tripRoute.GET as (
  req: NextRequest,
  ctx: { params: Promise<{ tripId: string }> },
) => Promise<Response>;
const PATCH = tripRoute.PATCH as (
  req: NextRequest,
  ctx: { params: Promise<{ tripId: string }> },
) => Promise<Response>;

const CONNECTION_CLEANUP_DELAY_MS = 500;

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
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

async function seedTripForLeader() {
  await dbConnect();
  const suffix = randomUUID().slice(0, 8);
  const leader = await User.create({
    username: `trip_pref_${suffix}`,
    email: `trip_pref_${suffix}@test.com`,
    passwordHash: await bcrypt.hash("pw", 10),
    school: "Purdue",
  });
  const leaderId = leader.userId.toString();
  const groupID = randomUUID();
  await TravelGroup.create({
    groupID,
    groupName: `Pref ${suffix}`,
    leaderID: leaderId,
    membersList: [{ userId: leaderId, role: "Leader" }],
  });
  const trip = await Trip.create({
    groupID,
    userId: leaderId,
    fromCity: "A",
    toCity: "B",
    fromDate: new Date("2026-08-01"),
    toDate: new Date("2026-08-03"),
    mode: "flight",
    budget: 1000,
    avoidActivities: ["Zoo"],
    avoidLocations: [],
    budgetMin: 100,
    budgetMax: 900,
  });
  await MustHave.create({
    groupId: groupID as never,
    name: "Art gallery",
    status: "approved",
    addedBy: leaderId as never,
  });
  return { leaderId, groupID, tripId: trip._id.toString() };
}

describe("GET/PATCH /api/trip/[tripId] preferences (US14)", () => {
  it("GET returns must-haves for the trip group and saved avoid/budget fields", async () => {
    const { leaderId, tripId } = await seedTripForLeader();
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId, email: "x@test.com" },
      expires: "9999",
    } as never);

    const res = await GET(new NextRequest("http://localhost"), {
      params: Promise.resolve({ tripId }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.avoidActivities).toEqual(["Zoo"]);
    expect(data.budgetMin).toBe(100);
    expect(data.budgetMax).toBe(900);
    expect(Array.isArray(data.mustHaves)).toBe(true);
    expect(data.mustHaves.some((m: { name: string }) => m.name === "Art gallery")).toBe(
      true,
    );

    await MustHave.deleteMany({});
    await Trip.deleteMany({});
    await TravelGroup.deleteMany({});
    await User.deleteOne({ userId: leaderId });
  });

  it("PATCH persists budget and avoid list updates for editors", async () => {
    const { leaderId, tripId } = await seedTripForLeader();
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId, email: "x@test.com" },
      expires: "9999",
    } as never);

    const patchRes = await PATCH(
      new NextRequest("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          budget: 4500,
          avoidActivities: ["Bars", "Clubs"],
          avoidLocations: ["Downtown"],
          budgetMin: null,
          budgetMax: null,
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ tripId }) },
    );
    expect(patchRes.status).toBe(200);

    const getRes = await GET(new NextRequest("http://localhost"), {
      params: Promise.resolve({ tripId }),
    });
    const data = await getRes.json();
    expect(data.budget).toBe(4500);
    expect(data.avoidActivities).toEqual(["Bars", "Clubs"]);
    expect(data.avoidLocations).toEqual(["Downtown"]);
    expect(data.budgetMin == null || data.budgetMin === undefined).toBe(true);
    expect(data.budgetMax == null || data.budgetMax === undefined).toBe(true);

    await MustHave.deleteMany({});
    await Trip.deleteMany({});
    await TravelGroup.deleteMany({});
    await User.deleteOne({ userId: leaderId });
  });
});
