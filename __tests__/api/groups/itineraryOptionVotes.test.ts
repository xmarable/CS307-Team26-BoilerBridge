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

const nextAuth = await import("next-auth");
const mockGetServerSession = nextAuth.getServerSession as jest.MockedFunction<
  typeof nextAuth.getServerSession
>;

const { default: dbConnect } = await import("@/lib/dbConnect");
const { default: User } = await import("@/models/User");
const { default: TravelGroup } = await import("@/models/TravelGroup");
const { default: CalendarEvent } = await import("@/models/CalendarEvent");
const { default: ItineraryOptionVote } = await import(
  "@/models/ItineraryOptionVote"
);

let GETVotes: any;
let POSTVotes: any;
let POSTFinalize: any;

let groupUUID: string;
let leaderId: string;
let memberId: string;
let outsiderId: string;
const ogId = "550e8400-e29b-41d4-a716-446655440000";

beforeAll(async () => {
  await dbConnect();

  const vRoute = await import("@/app/api/groups/[groupId]/itinerary/votes/route");
  GETVotes = vRoute.GET;
  POSTVotes = vRoute.POST;

  const fRoute = await import(
    "@/app/api/groups/[groupId]/itinerary/votes/[optionGroupId]/finalize/route"
  );
  POSTFinalize = fRoute.POST;

  const hash = await bcrypt.hash("pw", 10);
  const leader = await User.create({
    username: `og_ld_${randomUUID().slice(0, 8)}`,
    email: `og_ld_${randomUUID().slice(0, 8)}@t.com`,
    passwordHash: hash,
    school: "Purdue",
  });
  const member = await User.create({
    username: `og_mb_${randomUUID().slice(0, 8)}`,
    email: `og_mb_${randomUUID().slice(0, 8)}@t.com`,
    passwordHash: hash,
    school: "Purdue",
  });
  const outsider = await User.create({
    username: `og_out_${randomUUID().slice(0, 8)}`,
    email: `og_out_${randomUUID().slice(0, 8)}@t.com`,
    passwordHash: hash,
    school: "Purdue",
  });
  leaderId = leader.userId.toString();
  memberId = member.userId.toString();
  outsiderId = outsider.userId.toString();

  const g = await TravelGroup.create({
    groupName: "Option vote test",
    leaderID: leaderId,
    membersList: [
      { userId: leaderId, role: "Leader" },
      { userId: memberId, role: "Admin" },
    ],
  });
  groupUUID = g.groupID.toString();
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await ItineraryOptionVote.deleteMany({ groupId: groupUUID });
    await CalendarEvent.deleteMany({ groupId: groupUUID });
    await TravelGroup.deleteMany({ groupID: groupUUID });
    await User.deleteMany({
      userId: { $in: [leaderId, memberId, outsiderId] },
    });
    await mongoose.connection.close();
  }
});

beforeEach(async () => {
  await ItineraryOptionVote.deleteMany({ groupId: groupUUID });
  await CalendarEvent.deleteMany({ groupId: groupUUID });
});

describe("POST /api/groups/:groupId/itinerary/votes", () => {
  async function seedTwoOptions() {
    const a = await CalendarEvent.create({
      title: "Opt A",
      startTime: new Date("2026-07-01T10:00:00Z"),
      endTime: new Date("2026-07-01T11:00:00Z"),
      createdBy: leaderId,
      groupId: groupUUID,
      source: "itinerary",
      itineraryOptionStatus: "candidate",
      optionGroupId: ogId,
    });
    const b = await CalendarEvent.create({
      title: "Opt B",
      startTime: new Date("2026-07-01T10:30:00Z"),
      endTime: new Date("2026-07-01T11:30:00Z"),
      createdBy: leaderId,
      groupId: groupUUID,
      source: "itinerary",
      itineraryOptionStatus: "candidate",
      optionGroupId: ogId,
    });
    return { a, b };
  }

  it("returns 403 for non-members", async () => {
    const { a } = await seedTwoOptions();
    mockGetServerSession.mockResolvedValue({
      user: { userId: outsiderId },
      expires: "9999",
    });
    const res = await POSTVotes(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionGroupId: ogId, optionId: String(a._id) }),
      }) as any,
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(403);
  });

  it("records vote and updates tally on change", async () => {
    const { a, b } = await seedTwoOptions();
    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    let res = await POSTVotes(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionGroupId: ogId, optionId: String(a._id) }),
      }) as any,
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(200);
    let data = await res.json();
    expect(data.poll.tallies[String(a._id)]).toBe(1);

    res = await POSTVotes(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionGroupId: ogId, optionId: String(b._id) }),
      }) as any,
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(200);
    data = await res.json();
    expect(data.poll.tallies[String(a._id)]).toBe(0);
    expect(data.poll.tallies[String(b._id)]).toBe(1);
  });
});

describe("GET /api/groups/:groupId/itinerary/votes", () => {
  it("returns polls for members", async () => {
    await CalendarEvent.create({
      title: "Solo",
      startTime: new Date("2026-07-02T10:00:00Z"),
      endTime: new Date("2026-07-02T11:00:00Z"),
      createdBy: leaderId,
      groupId: groupUUID,
      source: "itinerary",
      itineraryOptionStatus: "candidate",
      optionGroupId: ogId,
    });
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await GETVotes(
      new Request(`http://localhost`) as any,
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.polls[ogId]).toBeDefined();
  });
});

describe("POST finalize", () => {
  it("returns 403 for non-leader", async () => {
    const a = await CalendarEvent.create({
      title: "Win",
      startTime: new Date("2026-07-03T10:00:00Z"),
      endTime: new Date("2026-07-03T11:00:00Z"),
      createdBy: leaderId,
      groupId: groupUUID,
      source: "itinerary",
      itineraryOptionStatus: "candidate",
      optionGroupId: ogId,
    });
    await CalendarEvent.create({
      title: "Lose",
      startTime: new Date("2026-07-03T10:30:00Z"),
      endTime: new Date("2026-07-03T11:30:00Z"),
      createdBy: leaderId,
      groupId: groupUUID,
      source: "itinerary",
      itineraryOptionStatus: "candidate",
      optionGroupId: ogId,
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const res = await POSTFinalize(
      new Request("http://localhost", { method: "POST" }) as any,
      {
        params: Promise.resolve({
          groupId: groupUUID,
          optionGroupId: ogId,
        }),
      },
    );
    expect(res.status).toBe(403);

    await CalendarEvent.deleteMany({ _id: a._id });
  });

  it("finalizes for leader", async () => {
    const winner = await CalendarEvent.create({
      title: "W2",
      startTime: new Date("2026-07-04T10:00:00Z"),
      endTime: new Date("2026-07-04T11:00:00Z"),
      createdBy: leaderId,
      groupId: groupUUID,
      source: "itinerary",
      itineraryOptionStatus: "candidate",
      optionGroupId: ogId,
    });
    const loser = await CalendarEvent.create({
      title: "L2",
      startTime: new Date("2026-07-04T10:30:00Z"),
      endTime: new Date("2026-07-04T11:30:00Z"),
      createdBy: leaderId,
      groupId: groupUUID,
      source: "itinerary",
      itineraryOptionStatus: "candidate",
      optionGroupId: ogId,
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await POSTFinalize(
      new Request("http://localhost", { method: "POST" }) as any,
      {
        params: Promise.resolve({
          groupId: groupUUID,
          optionGroupId: ogId,
        }),
      },
    );
    expect(res.status).toBe(200);
    const w = await CalendarEvent.findById(winner._id).lean();
    const l = await CalendarEvent.findById(loser._id).lean();
    expect((w as { itineraryOptionStatus?: string }).itineraryOptionStatus).toBe(
      "final",
    );
    expect((l as { itineraryOptionStatus?: string }).itineraryOptionStatus).toBe(
      "removed",
    );
  });
});
