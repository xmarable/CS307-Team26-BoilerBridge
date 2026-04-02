import { jest } from "@jest/globals";
import mongoose from "mongoose";

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
const { default: SharedCost } = await import("@/models/SharedCost");

const mockGetServerSession = nextAuth.getServerSession as jest.MockedFunction<
  typeof nextAuth.getServerSession
>;

let GET: (req: Request, ctx: { params: Promise<{ groupId: string }> }) => Promise<Response>;
let POST: (req: Request, ctx: { params: Promise<{ groupId: string }> }) => Promise<Response>;
let PUT: (req: Request, ctx: { params: Promise<{ groupId: string; id: string }> }) => Promise<Response>;
let DELETE: (req: Request, ctx: { params: Promise<{ groupId: string; id: string }> }) => Promise<Response>;

let groupId: string;
let leaderId: string;
let memberId: string;
let outsiderId: string;

beforeAll(async () => {
  await dbConnect();
  await SharedCost.deleteMany({});
  await TravelGroup.deleteMany({});
  await User.deleteMany({});

  const hash = await bcrypt.hash("pass", 10);
  const leader = await User.create({ username: "leader", email: "leader@test.com", passwordHash: hash, school: "Purdue" });
  const member = await User.create({ username: "member", email: "member@test.com", passwordHash: hash, school: "Purdue" });
  const outsider = await User.create({ username: "outsider", email: "outsider@test.com", passwordHash: hash, school: "Purdue" });

  leaderId = leader.userId.toString();
  memberId = member.userId.toString();
  outsiderId = outsider.userId.toString();

  const group = await TravelGroup.create({
    groupName: "Test Group",
    leaderID: leaderId,
    membersList: [
      { userId: leaderId, role: "Leader" },
      { userId: memberId, role: "Viewer" },
    ],
  });
  groupId = group._id.toString();

  const collectionRoute = await import("@/app/api/groups/[groupId]/shared-costs/route");
  GET = collectionRoute.GET as any;
  POST = collectionRoute.POST as any;

  const itemRoute = await import("@/app/api/groups/[groupId]/shared-costs/[id]/route");
  PUT = itemRoute.PUT as any;
  DELETE = itemRoute.DELETE as any;
});

afterAll(async () => {
  await SharedCost.deleteMany({});
  await TravelGroup.deleteMany({});
  await User.deleteMany({});
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if ((global as any).mongoose) {
    (global as any).mongoose.conn = null;
    (global as any).mongoose.promise = null;
  }
  jest.resetModules();
  jest.clearAllMocks();
});

beforeEach(() => jest.clearAllMocks());

const validPayload = () => ({
  title: "Airbnb stay",
  amount: 300,
  currency: "USD",
  paidBy: leaderId,
  participants: [{ userId: leaderId }, { userId: memberId }],
  splitType: "equal",
  date: "2026-03-15",
  category: "Accommodation",
});

function makeGetRequest(gId: string, query = "") {
  return new Request(`http://localhost/api/groups/${gId}/shared-costs${query}`);
}
function makePostRequest(gId: string, body: object) {
  return new Request(`http://localhost/api/groups/${gId}/shared-costs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function makePutRequest(gId: string, id: string, body: object) {
  return new Request(`http://localhost/api/groups/${gId}/shared-costs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function makeDeleteRequest(gId: string, id: string) {
  return new Request(`http://localhost/api/groups/${gId}/shared-costs/${id}`, {
    method: "DELETE",
  });
}

// ─── GET ──────────────────────────────────────────────────────────────────────

describe("GET /api/groups/:groupId/shared-costs", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(makeGetRequest(groupId), { params: Promise.resolve({ groupId }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-members", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: outsiderId }, expires: "9999" });
    const res = await GET(makeGetRequest(groupId), { params: Promise.resolve({ groupId }) });
    expect(res.status).toBe(403);
  });

  it("returns 200 with shared costs for group members", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: memberId }, expires: "9999" });
    const res = await GET(makeGetRequest(groupId), { params: Promise.resolve({ groupId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.sharedCosts)).toBe(true);
  });

  it("filters by category", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: leaderId }, expires: "9999" });
    const res = await GET(makeGetRequest(groupId, "?category=Food"), { params: Promise.resolve({ groupId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sharedCosts.every((c: any) => c.category === "Food")).toBe(true);
  });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe("POST /api/groups/:groupId/shared-costs", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(makePostRequest(groupId, validPayload()), { params: Promise.resolve({ groupId }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-members", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: outsiderId }, expires: "9999" });
    const res = await POST(makePostRequest(groupId, validPayload()), { params: Promise.resolve({ groupId }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 when title is missing", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: leaderId }, expires: "9999" });
    const { title, ...noTitle } = validPayload();
    const res = await POST(makePostRequest(groupId, noTitle), { params: Promise.resolve({ groupId }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/title/i);
  });

  it("returns 400 when amount is invalid", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: leaderId }, expires: "9999" });
    const res = await POST(makePostRequest(groupId, { ...validPayload(), amount: -10 }), { params: Promise.resolve({ groupId }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/amount/i);
  });

  it("returns 400 when paidBy is not a group member", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: leaderId }, expires: "9999" });
    const res = await POST(makePostRequest(groupId, { ...validPayload(), paidBy: outsiderId }), { params: Promise.resolve({ groupId }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/paidBy/i);
  });

  it("returns 400 when a participant is not a group member", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: leaderId }, expires: "9999" });
    const res = await POST(
      makePostRequest(groupId, { ...validPayload(), participants: [{ userId: outsiderId }] }),
      { params: Promise.resolve({ groupId }) }
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/participants/i);
  });

  it("returns 400 for an invalid splitType", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: leaderId }, expires: "9999" });
    const res = await POST(makePostRequest(groupId, { ...validPayload(), splitType: "halves" }), { params: Promise.resolve({ groupId }) });
    expect(res.status).toBe(400);
  });

  it("creates a shared cost and returns 201", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: leaderId }, expires: "9999" });
    const res = await POST(makePostRequest(groupId, validPayload()), { params: Promise.resolve({ groupId }) });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.sharedCost).toBeDefined();
    expect(data.sharedCost.title).toBe("Airbnb stay");
    expect(data.sharedCost.amount).toBe(300);
    expect(data.sharedCost.groupId).toBe(groupId);
  });
});

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe("PUT /api/groups/:groupId/shared-costs/:id", () => {
  let costId: string;

  beforeAll(async () => {
    const cost = await SharedCost.create({
      groupId,
      title: "Dinner",
      amount: 80,
      currency: "USD",
      paidBy: leaderId,
      participants: [{ userId: leaderId }, { userId: memberId }],
      splitType: "equal",
      date: new Date(),
      createdBy: leaderId,
    });
    costId = cost._id.toString();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await PUT(makePutRequest(groupId, costId, { title: "Updated" }), { params: Promise.resolve({ groupId, id: costId }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-member", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: outsiderId }, expires: "9999" });
    const res = await PUT(makePutRequest(groupId, costId, { title: "Updated" }), { params: Promise.resolve({ groupId, id: costId }) });
    expect(res.status).toBe(403);
  });

  it("returns 403 when non-creator member tries to edit", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: memberId }, expires: "9999" });
    const res = await PUT(makePutRequest(groupId, costId, { title: "Updated" }), { params: Promise.resolve({ groupId, id: costId }) });
    expect(res.status).toBe(403);
  });

  it("allows creator to update the shared cost", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: leaderId }, expires: "9999" });
    const res = await PUT(makePutRequest(groupId, costId, { title: "Fancy Dinner", amount: 120 }), { params: Promise.resolve({ groupId, id: costId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sharedCost.title).toBe("Fancy Dinner");
    expect(data.sharedCost.amount).toBe(120);
  });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe("DELETE /api/groups/:groupId/shared-costs/:id", () => {
  let costId: string;

  beforeEach(async () => {
    const cost = await SharedCost.create({
      groupId,
      title: "Taxi",
      amount: 30,
      currency: "USD",
      paidBy: leaderId,
      participants: [{ userId: leaderId }],
      splitType: "equal",
      date: new Date(),
      createdBy: leaderId,
    });
    costId = cost._id.toString();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await DELETE(makeDeleteRequest(groupId, costId), { params: Promise.resolve({ groupId, id: costId }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-member", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: outsiderId }, expires: "9999" });
    const res = await DELETE(makeDeleteRequest(groupId, costId), { params: Promise.resolve({ groupId, id: costId }) });
    expect(res.status).toBe(403);
  });

  it("allows creator to delete", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: leaderId }, expires: "9999" });
    const res = await DELETE(makeDeleteRequest(groupId, costId), { params: Promise.resolve({ groupId, id: costId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toMatch(/deleted/i);
  });

  it("returns 404 for a non-existent shared cost", async () => {
    mockGetServerSession.mockResolvedValue({ user: { userId: leaderId }, expires: "9999" });
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await DELETE(makeDeleteRequest(groupId, fakeId), { params: Promise.resolve({ groupId, id: fakeId }) });
    expect(res.status).toBe(404);
  });
});
