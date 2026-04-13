import { jest } from "@jest/globals";
import mongoose from "mongoose";

let GET: any, POST: any, DELETE: any;
let User: any, TravelGroup: any, Vote: any, dbConnect: any, bcrypt: any;
let mockGetServerSession: jest.Mock<any>;

let groupUUID: string, leaderId: string, memberId: string, outsiderId: string;

// ── Mock next-auth and auth config ──────────────────────────────────────────
await jest.unstable_mockModule("next-auth", () => ({
  getServerSession: jest.fn(),
}));

await jest.unstable_mockModule("@/lib/auth", () => ({
  authOptions: {},
}));

// ── Mock Pusher so POST/DELETE don't need real credentials ──────────────────
jest.unstable_mockModule("pusher", () => ({
  default: jest.fn().mockImplementation(() => ({
    trigger: jest.fn().mockResolvedValue(undefined),
  })),
}));

// ── Setup ───────────────────────────────────────────────────────────────────
beforeAll(async () => {
  jest.resetModules();

  const nextAuth = (await import("next-auth")) as any;
  mockGetServerSession = nextAuth.getServerSession as any;

  ({ default: bcrypt } = await import("bcryptjs"));
  ({ default: dbConnect } = await import("@/lib/dbConnect"));
  ({ default: User } = await import("@/models/User"));
  ({ default: TravelGroup } = await import("@/models/TravelGroup"));
  ({ default: Vote } = await import("@/models/Vote"));

  await dbConnect();
  await Vote.deleteMany({});
  await TravelGroup.deleteMany({});
  await User.deleteMany({});

  const hash = await bcrypt.hash("pass", 10);

  const leader = await User.create({
    username: "vote_leader",
    email: "vote_leader@test.com",
    passwordHash: hash,
    school: "Purdue",
  });
  const member = await User.create({
    username: "vote_member",
    email: "vote_member@test.com",
    passwordHash: hash,
    school: "Purdue",
  });
  const outsider = await User.create({
    username: "vote_outsider",
    email: "vote_outsider@test.com",
    passwordHash: hash,
    school: "Purdue",
  });

  leaderId = leader.userId.toString();
  memberId = member.userId.toString();
  outsiderId = outsider.userId.toString();

  const group = await TravelGroup.create({
    groupName: "Vote Test Group",
    leaderID: leaderId,
    membersList: [
      { userId: leaderId, role: "Leader" },
      { userId: memberId, role: "Viewer" },
    ],
  });

  groupUUID = group.groupID.toString();

  const route = await import("@/app/api/groups/[groupId]/itinerary/vote/route");
  GET = route.GET;
  POST = route.POST;
  DELETE = route.DELETE;
});

afterAll(async () => {
  if (Vote && TravelGroup && User) {
    await Vote.deleteMany({});
    await TravelGroup.deleteMany({});
    await User.deleteMany({});
  }

  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();

  if ((global as any).mongoose) {
    (global as any).mongoose.conn = null;
    (global as any).mongoose.promise = null;
  }

  jest.clearAllMocks();
});

beforeEach(async () => {
  jest.clearAllMocks();
  // Clear votes between tests so counts are predictable
  await Vote.deleteMany({});
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const ACTIVITY_A = "activity-aaa-001";
const ACTIVITY_B = "activity-bbb-002";

function makeGetRequest(gId: string, activityIds: string[]) {
  const qs = activityIds.length ? `?activityIds=${activityIds.join(",")}` : "";
  return new Request(`http://localhost/api/groups/${gId}/itinerary/vote${qs}`);
}

function makePostRequest(gId: string, body: object) {
  return new Request(`http://localhost/api/groups/${gId}/itinerary/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest(gId: string, body: object) {
  return new Request(`http://localhost/api/groups/${gId}/itinerary/vote`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── GET ───────────────────────────────────────────────────────────────────────

describe("GET /api/groups/:groupId/itinerary/vote", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(makeGetRequest(groupUUID, [ACTIVITY_A]) as any, {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-members", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: outsiderId },
      expires: "9999",
    });
    const res = await GET(makeGetRequest(groupUUID, [ACTIVITY_A]) as any, {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(403);
  });

  it("returns empty votes object when activityIds is omitted", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await GET(makeGetRequest(groupUUID, []) as any, {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.votes).toEqual({});
  });

  it("returns zero counts and null userVote when no votes exist", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await GET(makeGetRequest(groupUUID, [ACTIVITY_A]) as any, {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.votes[ACTIVITY_A]).toEqual({
      upvotes: 0,
      downvotes: 0,
      userVote: null,
    });
  });

  it("returns correct counts and userVote after votes are cast", async () => {
    // Seed: leader upvotes, member downvotes
    await Vote.create({
      activityId: ACTIVITY_A,
      groupId: groupUUID,
      userId: leaderId,
      type: "up",
    });
    await Vote.create({
      activityId: ACTIVITY_A,
      groupId: groupUUID,
      userId: memberId,
      type: "down",
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await GET(makeGetRequest(groupUUID, [ACTIVITY_A]) as any, {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.votes[ACTIVITY_A]).toEqual({
      upvotes: 1,
      downvotes: 1,
      userVote: "up",
    });
  });

  it("returns data for multiple activityIds in one call", async () => {
    await Vote.create({
      activityId: ACTIVITY_A,
      groupId: groupUUID,
      userId: leaderId,
      type: "up",
    });
    await Vote.create({
      activityId: ACTIVITY_B,
      groupId: groupUUID,
      userId: leaderId,
      type: "down",
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await GET(
      makeGetRequest(groupUUID, [ACTIVITY_A, ACTIVITY_B]) as any,
      {
        params: Promise.resolve({ groupId: groupUUID }),
      },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.votes[ACTIVITY_A].userVote).toBe("up");
    expect(data.votes[ACTIVITY_B].userVote).toBe("down");
  });
});

// ── POST ─────────────────────────────────────────────────────────────────────

describe("POST /api/groups/:groupId/itinerary/vote", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(
      makePostRequest(groupUUID, { activityId: ACTIVITY_A, type: "up" }) as any,
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-members", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: outsiderId },
      expires: "9999",
    });
    const res = await POST(
      makePostRequest(groupUUID, { activityId: ACTIVITY_A, type: "up" }) as any,
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(403);
  });

  it("casts a vote and returns updated counts", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await POST(
      makePostRequest(groupUUID, { activityId: ACTIVITY_A, type: "up" }) as any,
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.upvotes).toBe(1);
    expect(data.downvotes).toBe(0);
  });

  it("a member can also cast a vote", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const res = await POST(
      makePostRequest(groupUUID, {
        activityId: ACTIVITY_A,
        type: "down",
      }) as any,
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.downvotes).toBe(1);
  });

  it("voting twice updates the vote type instead of creating a duplicate", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });

    // First vote: up
    await POST(
      makePostRequest(groupUUID, { activityId: ACTIVITY_A, type: "up" }) as any,
      { params: Promise.resolve({ groupId: groupUUID }) },
    );

    // Change vote: down
    const res = await POST(
      makePostRequest(groupUUID, {
        activityId: ACTIVITY_A,
        type: "down",
      }) as any,
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.upvotes).toBe(0);
    expect(data.downvotes).toBe(1);

    // Confirm only one vote document exists for this user+activity
    const count = await Vote.countDocuments({
      activityId: ACTIVITY_A,
      userId: leaderId,
      groupId: groupUUID,
    });
    expect(count).toBe(1);
  });

  it("tallies correctly when multiple users vote on the same activity", async () => {
    // leader up, member up
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    await POST(
      makePostRequest(groupUUID, { activityId: ACTIVITY_A, type: "up" }) as any,
      { params: Promise.resolve({ groupId: groupUUID }) },
    );

    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const res = await POST(
      makePostRequest(groupUUID, { activityId: ACTIVITY_A, type: "up" }) as any,
      { params: Promise.resolve({ groupId: groupUUID }) },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.upvotes).toBe(2);
    expect(data.downvotes).toBe(0);
  });
});

// ── DELETE ───────────────────────────────────────────────────────────────────

describe("DELETE /api/groups/:groupId/itinerary/vote", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await DELETE(
      makeDeleteRequest(groupUUID, { activityId: ACTIVITY_A }) as any,
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-members", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: outsiderId },
      expires: "9999",
    });
    const res = await DELETE(
      makeDeleteRequest(groupUUID, { activityId: ACTIVITY_A }) as any,
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(403);
  });

  it("retracts a vote and decreases the tally", async () => {
    // Seed an upvote
    await Vote.create({
      activityId: ACTIVITY_A,
      groupId: groupUUID,
      userId: leaderId,
      type: "up",
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await DELETE(
      makeDeleteRequest(groupUUID, { activityId: ACTIVITY_A }) as any,
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.upvotes).toBe(0);
    expect(data.downvotes).toBe(0);

    const remaining = await Vote.countDocuments({
      activityId: ACTIVITY_A,
      userId: leaderId,
      groupId: groupUUID,
    });
    expect(remaining).toBe(0);
  });

  it("deleting a non-existent vote is harmless and returns updated counts", async () => {
    // Seed another user's vote so the activity has at least one
    await Vote.create({
      activityId: ACTIVITY_A,
      groupId: groupUUID,
      userId: memberId,
      type: "up",
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await DELETE(
      makeDeleteRequest(groupUUID, { activityId: ACTIVITY_A }) as any,
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    // Member's vote should still be there
    expect(data.upvotes).toBe(1);
  });
});

// ── Acceptance Criteria ───────────────────────────────────────────────────────

describe("Acceptance Criteria", () => {
  it("Given a list of generated activities, When I click the vote button, Then the vote count increases globally for everyone in the group.", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const postRes = await POST(
      makePostRequest(groupUUID, { activityId: ACTIVITY_A, type: "up" }) as any,
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(postRes.status).toBe(200);
    const postData = await postRes.json();
    expect(postData.upvotes).toBe(1);

    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const getRes = await GET(makeGetRequest(groupUUID, [ACTIVITY_A]) as any, {
      params: Promise.resolve({ groupId: groupUUID }),
    });
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.votes[ACTIVITY_A].upvotes).toBe(1);
  });

  it("Given I have already voted on an activity, When I click the vote button again, Then my previous vote is retracted and the tally decreases.", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });

    await POST(
      makePostRequest(groupUUID, { activityId: ACTIVITY_A, type: "up" }) as any,
      { params: Promise.resolve({ groupId: groupUUID }) },
    );

    const retractRes = await DELETE(
      makeDeleteRequest(groupUUID, { activityId: ACTIVITY_A }) as any,
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(retractRes.status).toBe(200);
    const retractData = await retractRes.json();
    expect(retractData.upvotes).toBe(0);
    expect(retractData.downvotes).toBe(0);
  });

  it("Given a user is not a member of the travel group, When they attempt to hit the voting API endpoint, Then the server rejects the request with a 403 error.", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: outsiderId },
      expires: "9999",
    });
    const res = await POST(
      makePostRequest(groupUUID, { activityId: ACTIVITY_A, type: "up" }) as any,
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    expect(res.status).toBe(403);
  });
});
