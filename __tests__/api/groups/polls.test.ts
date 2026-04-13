import { jest } from "@jest/globals";
import mongoose from "mongoose";

let POLL_POST: any, POLL_GET: any, POLL_DELETE: any;
let VOTE_POST: any;
let User: any, TravelGroup: any, dbConnect: any, bcrypt: any;
let mockGetServerSession: jest.MockedFunction<any>;

let groupUUID: string;
let leaderId: string, memberId: string, outsiderId: string;

await jest.unstable_mockModule("next-auth", () => ({
  getServerSession: jest.fn(),
}));

await jest.unstable_mockModule("@/lib/auth", () => ({
  authOptions: {},
}));

beforeAll(async () => {
  jest.resetModules();

  const nextAuth = (await import("next-auth")) as any;
  mockGetServerSession = nextAuth.getServerSession as any;

  ({ default: bcrypt } = await import("bcryptjs"));
  ({ default: dbConnect } = await import("@/lib/dbConnect"));
  ({ default: User } = await import("@/models/User"));
  ({ default: TravelGroup } = await import("@/models/TravelGroup"));

  await dbConnect();
  await TravelGroup.deleteMany({});
  await User.deleteMany({});

  const hash = await bcrypt.hash("pass", 10);

  const leader = await User.create({
    username: "poll_leader",
    email: "poll_leader@test.com",
    passwordHash: hash,
    school: "Purdue",
  });
  const member = await User.create({
    username: "poll_member",
    email: "poll_member@test.com",
    passwordHash: hash,
    school: "Purdue",
  });
  const outsider = await User.create({
    username: "poll_outsider",
    email: "poll_outsider@test.com",
    passwordHash: hash,
    school: "Purdue",
  });

  leaderId = leader.userId.toString();
  memberId = member.userId.toString();
  outsiderId = outsider.userId.toString();

  const group = await TravelGroup.create({
    groupName: "Poll Test Group",
    leaderID: leaderId,
    membersList: [
      { userId: leaderId, role: "Leader" },
      { userId: memberId, role: "Viewer" },
    ],
  });

  groupUUID = group.groupID.toString();

  const pollRoute = await import("@/app/api/groups/[groupId]/polls/route");
  POLL_POST = pollRoute.POST;
  POLL_GET = pollRoute.GET;
  POLL_DELETE = pollRoute.DELETE;

  const voteRoute = await import("@/app/api/groups/[groupId]/polls/vote/route");
  VOTE_POST = voteRoute.POST;
});

afterAll(async () => {
  await TravelGroup?.deleteMany({});
  await User?.deleteMany({});
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if ((global as any).mongoose) {
    (global as any).mongoose.conn = null;
    (global as any).mongoose.promise = null;
  }
  jest.clearAllMocks();
});

beforeEach(() => jest.clearAllMocks());

const ctx = (gId: string) => ({
  params: Promise.resolve({ groupId: gId }),
});

function futureDateMs(ms = 5 * 60 * 1000) {
  return new Date(Date.now() + ms).toISOString();
}

function pollReq(gId: string, body: object) {
  return new Request(`http://localhost/api/groups/${gId}/polls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getReq(gId: string) {
  return new Request(`http://localhost/api/groups/${gId}/polls`);
}

function deleteReq(gId: string, body: object) {
  return new Request(`http://localhost/api/groups/${gId}/polls`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function voteReq(gId: string, body: object) {
  return new Request(`http://localhost/api/groups/${gId}/polls/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validPoll = () => ({
  question: "Which city should we visit?",
  choices: ["Paris", "Tokyo", "Cape Town"],
  endsAt: futureDateMs(),
});

describe("POST /api/groups/:groupId/polls", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POLL_POST(
      pollReq(groupUUID, validPoll()),
      ctx(groupUUID),
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when user is not a group member", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: outsiderId },
      expires: "9999",
    });
    const res = await POLL_POST(
      pollReq(groupUUID, validPoll()),
      ctx(groupUUID),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when fewer than 2 choices are given", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await POLL_POST(
      pollReq(groupUUID, { ...validPoll(), choices: ["Only one"] }),
      ctx(groupUUID),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when endsAt is less than 2 minutes in the future", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await POLL_POST(
      pollReq(groupUUID, { ...validPoll(), endsAt: new Date().toISOString() }),
      ctx(groupUUID),
    );
    expect(res.status).toBe(400);
  });

  it("any member can create a poll", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const res = await POLL_POST(
      pollReq(groupUUID, validPoll()),
      ctx(groupUUID),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.polls.question).toBe("Which city should we visit?");
    expect(data.polls.choices.length).toBe(3);
  });
});

describe("GET /api/groups/:groupId/polls", () => {
  it("returns 401 for non-members", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: outsiderId },
      expires: "9999",
    });
    const res = await POLL_GET(getReq(groupUUID), ctx(groupUUID));
    expect(res.status).toBe(401);
  });

  it("returns polls array for group members", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await POLL_GET(getReq(groupUUID), ctx(groupUUID));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.polls)).toBe(true);
  });
});

describe("DELETE /api/groups/:groupId/polls", () => {
  it("returns 400 when pollId is not a valid UUID", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await POLL_DELETE(
      deleteReq(groupUUID, { pollId: "not-a-uuid" }),
      ctx(groupUUID),
    );
    expect(res.status).toBe(400);
  });

  it("removes an existing poll", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });

    // create a poll to delete
    const created = await POLL_POST(
      pollReq(groupUUID, validPoll()),
      ctx(groupUUID),
    );
    const pollData = await created.json();
    const pollId = pollData.polls.pollId;

    const res = await POLL_DELETE(
      deleteReq(groupUUID, { pollId }),
      ctx(groupUUID),
    );
    expect(res.status).toBe(200);
  });
});

describe("POST /api/groups/:groupId/polls/vote", () => {
  let activePollId: string;

  beforeAll(async () => {
    // create a poll to vote on
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await POLL_POST(
      pollReq(groupUUID, validPoll()),
      ctx(groupUUID),
    );
    const data = await res.json();
    activePollId = data.polls.pollId;
  });

  it("returns 401 for non-members", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: outsiderId },
      expires: "9999",
    });
    const res = await VOTE_POST(
      voteReq(groupUUID, { pollId: activePollId, choiceIndex: 0 }),
      ctx(groupUUID),
    );
    expect(res.status).toBe(401);
  });

  it("records a vote on a valid choice index", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const res = await VOTE_POST(
      voteReq(groupUUID, { pollId: activePollId, choiceIndex: 1 }),
      ctx(groupUUID),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.poll).toBeDefined();
  });

  it("passing choiceIndex null removes a vote", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: memberId },
      expires: "9999",
    });
    const res = await VOTE_POST(
      voteReq(groupUUID, { pollId: activePollId, choiceIndex: null }),
      ctx(groupUUID),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.removed).toBe(true);
  });
});
