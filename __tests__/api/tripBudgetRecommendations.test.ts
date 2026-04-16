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
const { default: Activity } = await import("@/models/Activity");

const budgetRoute = await import("@/app/api/trip/budget-recommendations/route");
const GET = budgetRoute.GET as (req: NextRequest) => Promise<Response>;

const CONNECTION_CLEANUP_DELAY_MS = 500;

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await Activity.deleteMany({});
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

async function seedTripAndActivities() {
  await dbConnect();
  const suffix = randomUUID().slice(0, 8);
  const tag = `br_${suffix}`;
  const leader = await User.create({
    username: `bud_rec_${suffix}`,
    email: `bud_rec_${suffix}@test.com`,
    passwordHash: await bcrypt.hash("pw", 10),
    school: "Purdue",
  });
  const leaderId = leader.userId.toString();
  const groupID = randomUUID();
  await TravelGroup.create({
    groupID,
    groupName: `Budget ${suffix}`,
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
    avoidLocations: ["Strip"],
    budgetMin: 20,
    budgetMax: 80,
  });

  await Activity.create([
    {
      name: `${tag} City Zoo special`,
      address: "400 Zoo Rd",
      reviewCount: 0,
      estimatedCost: 40,
    },
    {
      name: `${tag} Casino night`,
      address: "1 Las Vegas Strip",
      reviewCount: 0,
      estimatedCost: 50,
    },
    {
      name: `${tag} Art museum`,
      address: "9 Culture Ave",
      reviewCount: 0,
      estimatedCost: 45,
    },
    {
      name: `${tag} Too cheap`,
      address: "Side St",
      reviewCount: 0,
      estimatedCost: 5,
    },
  ]);

  return {
    leaderId,
    tripId: trip._id.toString(),
    tag,
    expectedPass: `${tag} Art museum`,
    expectedBudgetOverride: `${tag} Too cheap`,
  };
}

describe("GET /api/trip/budget-recommendations (US14)", () => {
  it("returns recommendations filtered by trip avoid lists and budget range", async () => {
    const { leaderId, tripId, tag, expectedPass } = await seedTripAndActivities();
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId, email: "x@test.com" },
      expires: "9999",
    } as never);

    const res = await GET(
      new NextRequest(
        `http://localhost/api/trip/budget-recommendations?tripId=${tripId}&limit=20`,
      ),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.filters.avoidActivities).toEqual(["Zoo"]);
    expect(data.filters.avoidLocations).toEqual(["Strip"]);
    expect(data.filters.budgetMin).toBe(20);
    expect(data.filters.budgetMax).toBe(80);

    const names = (data.recommendations as { name: string }[]).map((r) => r.name);
    const ours = names.filter((n) => n.startsWith(tag));
    expect(ours).toEqual([expectedPass]);

    await Activity.deleteMany({ name: new RegExp(`^${tag}`) });
    await Trip.deleteMany({});
    await TravelGroup.deleteMany({});
    await User.deleteOne({ userId: leaderId });
  });

  it("allows overriding budget range via query params", async () => {
    const { leaderId, tripId, tag, expectedBudgetOverride } =
      await seedTripAndActivities();
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId, email: "x@test.com" },
      expires: "9999",
    } as never);

    const res = await GET(
      new NextRequest(
        `http://localhost/api/trip/budget-recommendations?tripId=${tripId}&budgetMin=1&budgetMax=10`,
      ),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.filters.budgetMin).toBe(1);
    expect(data.filters.budgetMax).toBe(10);
    const names = (data.recommendations as { name: string }[]).map((r) => r.name);
    const ours = names.filter((n) => n.startsWith(tag));
    expect(ours).toContain(expectedBudgetOverride);

    await Activity.deleteMany({ name: new RegExp(`^${tag}`) });
    await Trip.deleteMany({});
    await TravelGroup.deleteMany({});
    await User.deleteOne({ userId: leaderId });
  });
});
