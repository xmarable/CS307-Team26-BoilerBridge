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

const sectionRoute = await import("@/app/api/itinerary/[id]/section/route");
const PATCH = sectionRoute.PATCH as (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) => Promise<Response>;

const tripGetRoute = await import("@/app/api/trip/[tripId]/route");
const GET_TRIP = tripGetRoute.GET as (
  req: NextRequest,
  ctx: { params: Promise<{ tripId: string }> },
) => Promise<Response>;

const CONNECTION_CLEANUP_DELAY_MS = 500;

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
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

async function seedTwoActivityTrip(opts: { viewerAlso?: boolean } = {}) {
  await dbConnect();
  const suffix = randomUUID().slice(0, 8);
  const leader = await User.create({
    username: `it_sec_${suffix}`,
    email: `it_sec_${suffix}@test.com`,
    passwordHash: await bcrypt.hash("pw", 10),
    school: "Purdue",
  });
  const leaderId = leader.userId.toString();

  let viewerId = "";
  if (opts.viewerAlso) {
    const viewer = await User.create({
      username: `it_view_${suffix}`,
      email: `it_view_${suffix}@test.com`,
      passwordHash: await bcrypt.hash("pw", 10),
      school: "Purdue",
    });
    viewerId = viewer.userId.toString();
  }

  const groupID = randomUUID();
  const membersList = opts.viewerAlso
    ? [
        { userId: leaderId, role: "Leader" as const },
        { userId: viewerId, role: "Viewer" as const },
      ]
    : [{ userId: leaderId, role: "Leader" as const }];

  await TravelGroup.create({
    groupID,
    groupName: `It ${suffix}`,
    leaderID: leaderId,
    membersList,
  });

  const dayId1 = randomUUID();
  const dayId2 = randomUUID();
  const itineraryActivityId1 = randomUUID();
  const itineraryActivityId2 = randomUUID();

  const t1 = new Date("2026-08-01T10:00:00.000Z");
  const t2 = new Date("2026-08-01T12:00:00.000Z");
  const t3 = new Date("2026-08-02T10:00:00.000Z");
  const t4 = new Date("2026-08-02T12:00:00.000Z");

  const trip = await Trip.create({
    groupID,
    userId: leaderId,
    fromCity: "A",
    toCity: "B",
    fromDate: new Date("2026-08-01"),
    toDate: new Date("2026-08-03"),
    mode: "flight",
    budget: 1000,
    itineraryVersion: 0,
    primaryItinerary: [
      {
        activityId: "catalog-1",
        itineraryActivityId: itineraryActivityId1,
        dayId: dayId1,
        name: "Museum",
        startTime: t1,
        endTime: t2,
        isOutdoor: false,
        category: "culture",
        location: "Downtown",
      },
      {
        activityId: "catalog-2",
        itineraryActivityId: itineraryActivityId2,
        dayId: dayId2,
        name: "Park",
        startTime: t3,
        endTime: t4,
        isOutdoor: true,
        category: "nature",
        location: "Uptown",
      },
    ],
    rainyDayItinerary: [
      {
        activityId: "r1",
        itineraryActivityId: randomUUID(),
        dayId: dayId1,
        name: "Rain alt 1",
        startTime: t1,
        endTime: t2,
        isOutdoor: false,
      },
    ],
  });

  return {
    leaderId,
    viewerId,
    groupID,
    tripId: trip._id.toString(),
    dayId1,
    dayId2,
    itineraryActivityId1,
    itineraryActivityId2,
  };
}

describe("PATCH /api/itinerary/:id/section (US16)", () => {
  it("returns_401_when_not_authenticated", async () => {
    const ctx = await seedTwoActivityTrip();
    mockGetServerSession.mockResolvedValue(null as never);
    const res = await PATCH(
      new NextRequest("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          scope: "activity",
          dayId: ctx.dayId1,
          activityId: ctx.itineraryActivityId1,
          itineraryKind: "primary",
          updates: { name: "X" },
        }),
      }),
      { params: Promise.resolve({ id: ctx.tripId }) },
    );
    expect(res.status).toBe(401);
    await Trip.deleteMany({});
    await TravelGroup.deleteMany({});
    await User.deleteMany({});
  });

  it("AC1_single_activity_partial_update_only_mutates_target_activity", async () => {
    const ctx = await seedTwoActivityTrip();
    mockGetServerSession.mockResolvedValue({
      user: { userId: ctx.leaderId, email: "x@test.com" },
      expires: "9999",
    } as never);

    const res = await PATCH(
      new NextRequest("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          scope: "activity",
          dayId: ctx.dayId1,
          activityId: ctx.itineraryActivityId1,
          itineraryKind: "primary",
          updates: { name: "Museum (updated)" },
        }),
      }),
      { params: Promise.resolve({ id: ctx.tripId }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    const primary = data.primaryItinerary as { name: string; itineraryActivityId: string }[];
    const a1 = primary.find((x) => x.itineraryActivityId === ctx.itineraryActivityId1);
    const a2 = primary.find((x) => x.itineraryActivityId === ctx.itineraryActivityId2);
    expect(a1?.name).toBe("Museum (updated)");
    expect(a2?.name).toBe("Park");
    expect(data.itineraryVersion).toBe(1);

    await Trip.deleteMany({});
    await TravelGroup.deleteMany({});
    await User.deleteMany({});
  });

  it("AC2_persistence_after_refresh_re_fetch_contains_updated_section", async () => {
    const ctx = await seedTwoActivityTrip();
    mockGetServerSession.mockResolvedValue({
      user: { userId: ctx.leaderId, email: "x@test.com" },
      expires: "9999",
    } as never);

    const patchRes = await PATCH(
      new NextRequest("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          scope: "activity",
          dayId: ctx.dayId2,
          activityId: ctx.itineraryActivityId2,
          itineraryKind: "primary",
          updates: { location: "Riverside" },
        }),
      }),
      { params: Promise.resolve({ id: ctx.tripId }) },
    );
    expect(patchRes.status).toBe(200);

    const getRes = await GET_TRIP(new NextRequest("http://localhost"), {
      params: Promise.resolve({ tripId: ctx.tripId }),
    });
    expect(getRes.status).toBe(200);
    const loaded = await getRes.json();
    const p = loaded.primaryItinerary as { location?: string; itineraryActivityId: string }[];
    const row = p.find((x) => x.itineraryActivityId === ctx.itineraryActivityId2);
    expect(row?.location).toBe("Riverside");

    await Trip.deleteMany({});
    await TravelGroup.deleteMany({});
    await User.deleteMany({});
  });

  it("AC3_concurrent_edits_different_sections_do_not_clobber_peer_fields", async () => {
    const ctx = await seedTwoActivityTrip();
    mockGetServerSession.mockResolvedValue({
      user: { userId: ctx.leaderId, email: "x@test.com" },
      expires: "9999",
    } as never);

    const r1 = await PATCH(
      new NextRequest("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          scope: "activity",
          dayId: ctx.dayId1,
          activityId: ctx.itineraryActivityId1,
          itineraryKind: "primary",
          updates: { category: "art" },
        }),
      }),
      { params: Promise.resolve({ id: ctx.tripId }) },
    );
    const r2 = await PATCH(
      new NextRequest("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          scope: "activity",
          dayId: ctx.dayId2,
          activityId: ctx.itineraryActivityId2,
          itineraryKind: "primary",
          updates: { category: "parks" },
        }),
      }),
      { params: Promise.resolve({ id: ctx.tripId }) },
    );
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    const trip = await Trip.findById(ctx.tripId).lean();
    const primary = (trip as { primaryItinerary: { itineraryActivityId: string; category?: string }[] })
      .primaryItinerary;
    const row1 = primary.find((x) => x.itineraryActivityId === ctx.itineraryActivityId1);
    const row2 = primary.find((x) => x.itineraryActivityId === ctx.itineraryActivityId2);
    expect(row1?.category).toBe("art");
    expect(row2?.category).toBe("parks");

    await Trip.deleteMany({});
    await TravelGroup.deleteMany({});
    await User.deleteMany({});
  });

  it("AC3_stale_version_conflict_returns_409_when_stale_version_sent", async () => {
    const ctx = await seedTwoActivityTrip();
    mockGetServerSession.mockResolvedValue({
      user: { userId: ctx.leaderId, email: "x@test.com" },
      expires: "9999",
    } as never);

    const ok = await PATCH(
      new NextRequest("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          scope: "activity",
          dayId: ctx.dayId1,
          activityId: ctx.itineraryActivityId1,
          itineraryKind: "primary",
          version: 0,
          updates: { name: "N1" },
        }),
      }),
      { params: Promise.resolve({ id: ctx.tripId }) },
    );
    expect(ok.status).toBe(200);

    const conflict = await PATCH(
      new NextRequest("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          scope: "activity",
          dayId: ctx.dayId2,
          activityId: ctx.itineraryActivityId2,
          itineraryKind: "primary",
          version: 0,
          updates: { name: "Should fail" },
        }),
      }),
      { params: Promise.resolve({ id: ctx.tripId }) },
    );
    expect(conflict.status).toBe(409);
    const body = await conflict.json();
    expect(body.currentVersion).toBe(1);

    const trip = await Trip.findById(ctx.tripId).lean();
    const primary = (trip as { primaryItinerary: { name: string; itineraryActivityId: string }[] })
      .primaryItinerary;
    const row2 = primary.find((x) => x.itineraryActivityId === ctx.itineraryActivityId2);
    expect(row2?.name).toBe("Park");

    await Trip.deleteMany({});
    await TravelGroup.deleteMany({});
    await User.deleteMany({});
  });

  it("AC4_unauthorized_viewer_receives_403_on_section_patch", async () => {
    const ctx = await seedTwoActivityTrip({ viewerAlso: true });
    mockGetServerSession.mockResolvedValue({
      user: { userId: ctx.viewerId, email: "v@test.com" },
      expires: "9999",
    } as never);

    const res = await PATCH(
      new NextRequest("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          scope: "activity",
          dayId: ctx.dayId1,
          activityId: ctx.itineraryActivityId1,
          itineraryKind: "primary",
          updates: { name: "Hack" },
        }),
      }),
      { params: Promise.resolve({ id: ctx.tripId }) },
    );
    expect(res.status).toBe(403);

    await Trip.deleteMany({});
    await TravelGroup.deleteMany({});
    await User.deleteMany({});
  });

  it("rejects_invalid_itinerary_object_id_with_400", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: "x", email: "x@test.com" },
      expires: "9999",
    } as never);
    const res = await PATCH(
      new NextRequest("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          scope: "activity",
          dayId: "d",
          activityId: "a",
          updates: { name: "x" },
        }),
      }),
      { params: Promise.resolve({ id: "not-an-object-id" }) },
    );
    expect(res.status).toBe(400);
  });

  it("rejects_activity_scope_without_activityId", async () => {
    const ctx = await seedTwoActivityTrip();
    mockGetServerSession.mockResolvedValue({
      user: { userId: ctx.leaderId, email: "x@test.com" },
      expires: "9999",
    } as never);
    const res = await PATCH(
      new NextRequest("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          scope: "activity",
          dayId: ctx.dayId1,
          updates: { name: "x" },
        }),
      }),
      { params: Promise.resolve({ id: ctx.tripId }) },
    );
    expect(res.status).toBe(400);
    await Trip.deleteMany({});
    await TravelGroup.deleteMany({});
    await User.deleteMany({});
  });

  it("rejects_invalid_scope_value", async () => {
    const ctx = await seedTwoActivityTrip();
    mockGetServerSession.mockResolvedValue({
      user: { userId: ctx.leaderId, email: "x@test.com" },
      expires: "9999",
    } as never);
    const res = await PATCH(
      new NextRequest("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          scope: "week",
          dayId: ctx.dayId1,
          updates: { name: "x" },
        }),
      }),
      { params: Promise.resolve({ id: ctx.tripId }) },
    );
    expect(res.status).toBe(400);
    await Trip.deleteMany({});
    await TravelGroup.deleteMany({});
    await User.deleteMany({});
  });

  it("returns_404_when_target_activity_not_found", async () => {
    const ctx = await seedTwoActivityTrip();
    mockGetServerSession.mockResolvedValue({
      user: { userId: ctx.leaderId, email: "x@test.com" },
      expires: "9999",
    } as never);
    const res = await PATCH(
      new NextRequest("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          scope: "activity",
          dayId: ctx.dayId1,
          activityId: randomUUID(),
          itineraryKind: "primary",
          updates: { name: "ghost" },
        }),
      }),
      { params: Promise.resolve({ id: ctx.tripId }) },
    );
    expect(res.status).toBe(404);
    await Trip.deleteMany({});
    await TravelGroup.deleteMany({});
    await User.deleteMany({});
  });

  it("rejects_disallowed_update_fields", async () => {
    const ctx = await seedTwoActivityTrip();
    mockGetServerSession.mockResolvedValue({
      user: { userId: ctx.leaderId, email: "x@test.com" },
      expires: "9999",
    } as never);
    const res = await PATCH(
      new NextRequest("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          scope: "activity",
          dayId: ctx.dayId1,
          activityId: ctx.itineraryActivityId1,
          itineraryKind: "primary",
          updates: { name: "ok", evilField: 1 },
        }),
      }),
      { params: Promise.resolve({ id: ctx.tripId }) },
    );
    expect(res.status).toBe(400);
    await Trip.deleteMany({});
    await TravelGroup.deleteMany({});
    await User.deleteMany({});
  });

  it("day_scope_updates_only_matching_day_activities", async () => {
    const ctx = await seedTwoActivityTrip();
    mockGetServerSession.mockResolvedValue({
      user: { userId: ctx.leaderId, email: "x@test.com" },
      expires: "9999",
    } as never);
    const res = await PATCH(
      new NextRequest("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          scope: "day",
          dayId: ctx.dayId1,
          itineraryKind: "primary",
          updates: { isOutdoor: true },
        }),
      }),
      { params: Promise.resolve({ id: ctx.tripId }) },
    );
    expect(res.status).toBe(200);
    const trip = await Trip.findById(ctx.tripId).lean();
    const primary = (trip as { primaryItinerary: { dayId: string; isOutdoor: boolean }[] })
      .primaryItinerary;
    const day1Acts = primary.filter((x) => x.dayId === ctx.dayId1);
    const day2Acts = primary.filter((x) => x.dayId === ctx.dayId2);
    expect(day1Acts.every((a) => a.isOutdoor === true)).toBe(true);
    expect(day2Acts).toHaveLength(1);
    expect(day2Acts[0]?.name).toBe("Park");
    expect(day2Acts[0]?.isOutdoor).toBe(true);

    await Trip.deleteMany({});
    await TravelGroup.deleteMany({});
    await User.deleteMany({});
  });
});
