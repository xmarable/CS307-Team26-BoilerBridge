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
const { default: CalendarConnection } = await import("@/models/CalendarConnection");
const { default: CalendarEventSync } = await import("@/models/CalendarEventSync");
const { default: CalendarEvent } = await import("@/models/CalendarEvent");
const { encrypt } = await import("@/lib/tokenEncryption");
const { resetMockProviderState, mockCreatedEvents } = await import(
  "@/lib/calendarProviders/mock"
);

const mockGetServerSession = nextAuth.getServerSession as jest.MockedFunction<
  typeof nextAuth.getServerSession
>;

let GET_LIST: (req: Request) => Promise<Response>;
let POST_CREATE: (req: Request) => Promise<Response>;
let PUT_UPDATE: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
let DELETE_UNLINK: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
let POST_SYNC: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

let userId: string;
let otherUserId: string;
let groupUUID: string;

beforeAll(async () => {
  await dbConnect();
  await CalendarConnection.deleteMany({});
  await CalendarEventSync.deleteMany({});
  await CalendarEvent.deleteMany({});
  await TravelGroup.deleteMany({});
  await User.deleteMany({});

  const hash = await bcrypt.hash("pass", 10);
  const user = await User.create({
    username: "cal_conn_user",
    email: "cal_conn@test.com",
    passwordHash: hash,
    school: "Purdue",
  });
  const other = await User.create({
    username: "cal_conn_other",
    email: "cal_conn_other@test.com",
    passwordHash: hash,
    school: "Purdue",
  });

  userId = user.userId.toString();
  otherUserId = other.userId.toString();

  const group = await TravelGroup.create({
    groupName: "Sync Test Group",
    leaderID: userId,
    membersList: [{ userId, role: "Leader" }],
  });
  groupUUID = group.groupID.toString();

  const listRoute = await import("@/app/api/calendar-connections/route");
  GET_LIST = listRoute.GET as any;
  POST_CREATE = listRoute.POST as any;

  const itemRoute = await import("@/app/api/calendar-connections/[id]/route");
  PUT_UPDATE = itemRoute.PUT as any;
  DELETE_UNLINK = itemRoute.DELETE as any;

  const syncRoute = await import(
    "@/app/api/calendar-connections/[id]/sync/route"
  );
  POST_SYNC = syncRoute.POST as any;
});

afterAll(async () => {
  await CalendarConnection.deleteMany({});
  await CalendarEventSync.deleteMany({});
  await CalendarEvent.deleteMany({});
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

beforeEach(() => {
  jest.clearAllMocks();
  resetMockProviderState();
});

function makeGetList() {
  return new Request("http://localhost/api/calendar-connections");
}

function makePost(body: object) {
  return new Request("http://localhost/api/calendar-connections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePut(id: string, body: object) {
  return new Request(`http://localhost/api/calendar-connections/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDelete(id: string) {
  return new Request(`http://localhost/api/calendar-connections/${id}`, {
    method: "DELETE",
  });
}

function makeSync(id: string, body: object) {
  return new Request(
    `http://localhost/api/calendar-connections/${id}/sync`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

// ─── GET ─────────────────────────────────────────────────────────────────────

describe("GET /api/calendar-connections", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET_LIST(makeGetList());
    expect(res.status).toBe(401);
  });

  it("returns 200 with empty array when user has no connections", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId },
      expires: "9999",
    });
    const res = await GET_LIST(makeGetList());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.connections)).toBe(true);
  });

  it("does not return encrypted token fields", async () => {
    // Create a connection first
    await CalendarConnection.create({
      userId,
      provider: "google",
      providerAccountId: "test-account-id",
      encryptedAccessToken: encrypt("test-access-token"),
      tokenExpiresAt: new Date(Date.now() + 3600000),
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId },
      expires: "9999",
    });
    const res = await GET_LIST(makeGetList());
    const data = await res.json();
    const conn = data.connections[0];
    expect(conn.encryptedAccessToken).toBeUndefined();
    expect(conn.encryptedRefreshToken).toBeUndefined();

    await CalendarConnection.deleteMany({ userId });
  });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe("POST /api/calendar-connections", () => {
  afterEach(async () => {
    await CalendarConnection.deleteMany({ userId });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST_CREATE(makePost({ provider: "google" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an unsupported provider", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId },
      expires: "9999",
    });
    const res = await POST_CREATE(
      makePost({
        provider: "yahoo",
        providerAccountId: "123",
        accessToken: "tok",
        expiresIn: 3600,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId },
      expires: "9999",
    });
    const res = await POST_CREATE(makePost({ provider: "google" }));
    expect(res.status).toBe(400);
  });

  it("creates a connection and returns 201", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId },
      expires: "9999",
    });
    const res = await POST_CREATE(
      makePost({
        provider: "google",
        providerAccountId: "google-123",
        accessToken: "access-tok",
        refreshToken: "refresh-tok",
        expiresIn: 3600,
        calendarId: "primary",
        calendarName: "Primary Calendar",
      }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.connection).toBeDefined();
    expect(data.connection.provider).toBe("google");
    expect(data.connection.syncEnabled).toBe(false);
    expect(data.connection.encryptedAccessToken).toBeUndefined();
  });

  it("returns 409 when a connection for the same provider already exists", async () => {
    await CalendarConnection.create({
      userId,
      provider: "google",
      providerAccountId: "existing-id",
      encryptedAccessToken: encrypt("tok"),
      tokenExpiresAt: new Date(Date.now() + 3600000),
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId },
      expires: "9999",
    });
    const res = await POST_CREATE(
      makePost({
        provider: "google",
        providerAccountId: "google-456",
        accessToken: "tok2",
        expiresIn: 3600,
      }),
    );
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toMatch(/already linked/i);
  });
});

// ─── PUT ─────────────────────────────────────────────────────────────────────

describe("PUT /api/calendar-connections/:id", () => {
  let connectionId: string;

  beforeAll(async () => {
    const conn = await CalendarConnection.create({
      userId,
      provider: "outlook",
      providerAccountId: "outlook-123",
      encryptedAccessToken: encrypt("access-tok"),
      tokenExpiresAt: new Date(Date.now() + 3600000),
      syncEnabled: false,
    });
    connectionId = conn._id.toString();
  });

  afterAll(async () => {
    await CalendarConnection.findByIdAndDelete(connectionId);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await PUT_UPDATE(
      makePut(connectionId, { syncEnabled: true }),
      { params: Promise.resolve({ id: connectionId }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 for a non-existent connection", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId },
      expires: "9999",
    });
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await PUT_UPDATE(
      makePut(fakeId, { syncEnabled: true }),
      { params: Promise.resolve({ id: fakeId }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when a different user tries to update", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: otherUserId },
      expires: "9999",
    });
    const res = await PUT_UPDATE(
      makePut(connectionId, { syncEnabled: true }),
      { params: Promise.resolve({ id: connectionId }) },
    );
    expect(res.status).toBe(403);
  });

  it("allows the owner to enable sync", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId },
      expires: "9999",
    });
    const res = await PUT_UPDATE(
      makePut(connectionId, { syncEnabled: true, calendarId: "mock-primary", calendarName: "Primary Calendar" }),
      { params: Promise.resolve({ id: connectionId }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.connection.syncEnabled).toBe(true);
    expect(data.connection.calendarId).toBe("mock-primary");
  });
});

// ─── DELETE ──────────────────────────────────────────────────────────────────

describe("DELETE /api/calendar-connections/:id", () => {
  let connectionId: string;

  beforeEach(async () => {
    const conn = await CalendarConnection.create({
      userId,
      provider: "google",
      providerAccountId: "google-del-test",
      encryptedAccessToken: encrypt("tok"),
      tokenExpiresAt: new Date(Date.now() + 3600000),
    });
    connectionId = conn._id.toString();

    // Create a sync mapping to confirm it gets cleaned up
    await CalendarEventSync.create({
      connectionId,
      calendarEventId: new mongoose.Types.ObjectId().toString(),
      externalEventId: "ext-123",
      provider: "google",
    });
  });

  afterEach(async () => {
    await CalendarConnection.findByIdAndDelete(connectionId).catch(() => {});
    await CalendarEventSync.deleteMany({ connectionId });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await DELETE_UNLINK(makeDelete(connectionId), {
      params: Promise.resolve({ id: connectionId }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when a different user tries to delete", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: otherUserId },
      expires: "9999",
    });
    const res = await DELETE_UNLINK(makeDelete(connectionId), {
      params: Promise.resolve({ id: connectionId }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 for a non-existent connection", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId },
      expires: "9999",
    });
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await DELETE_UNLINK(makeDelete(fakeId), {
      params: Promise.resolve({ id: fakeId }),
    });
    expect(res.status).toBe(404);
  });

  it("deletes the connection and all sync mappings", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId },
      expires: "9999",
    });
    const res = await DELETE_UNLINK(makeDelete(connectionId), {
      params: Promise.resolve({ id: connectionId }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);

    const gone = await CalendarConnection.findById(connectionId);
    expect(gone).toBeNull();

    const mappings = await CalendarEventSync.find({ connectionId });
    expect(mappings.length).toBe(0);
  });
});

// ─── SYNC ─────────────────────────────────────────────────────────────────────

describe("POST /api/calendar-connections/:id/sync", () => {
  let connectionId: string;

  beforeAll(async () => {
    // Create a connection with sync enabled and a valid far-future expiry
    const conn = await CalendarConnection.create({
      userId,
      provider: "google",
      providerAccountId: "google-sync-test",
      encryptedAccessToken: encrypt("mock-access-token"),
      encryptedRefreshToken: encrypt("mock-refresh-token"),
      tokenExpiresAt: new Date(Date.now() + 3600000 * 24), // 24h
      calendarId: "mock-primary",
      calendarName: "Primary Calendar",
      syncEnabled: true,
    });
    connectionId = conn._id.toString();

    // Create a calendar event for the group
    await CalendarEvent.create({
      title: "Trip Kickoff",
      startTime: new Date("2026-06-01T10:00:00Z"),
      endTime: new Date("2026-06-01T11:00:00Z"),
      groupId: groupUUID,
      createdBy: userId,
      source: "manual",
    } as any);
  });

  afterAll(async () => {
    await CalendarConnection.findByIdAndDelete(connectionId);
    await CalendarEventSync.deleteMany({ connectionId });
    await CalendarEvent.deleteMany({ groupId: groupUUID } as any);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST_SYNC(makeSync(connectionId, { groupId: groupUUID }), {
      params: Promise.resolve({ id: connectionId }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 for a non-existent connection", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId },
      expires: "9999",
    });
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await POST_SYNC(makeSync(fakeId, { groupId: groupUUID }), {
      params: Promise.resolve({ id: fakeId }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 when groupId is missing", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId },
      expires: "9999",
    });
    const res = await POST_SYNC(makeSync(connectionId, {}), {
      params: Promise.resolve({ id: connectionId }),
    });
    expect(res.status).toBe(400);
  });

  it("syncs events and creates CalendarEventSync records", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId },
      expires: "9999",
    });
    const res = await POST_SYNC(makeSync(connectionId, { groupId: groupUUID }), {
      params: Promise.resolve({ id: connectionId }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.synced).toBeGreaterThan(0);

    const syncRecords = await CalendarEventSync.find({ connectionId });
    expect(syncRecords.length).toBeGreaterThan(0);
    expect(syncRecords[0].externalEventId).toMatch(/^mock-ext-event-/);
  });

  it("updates existing sync records on re-sync (no duplicates)", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId },
      expires: "9999",
    });

    // Run sync a second time
    await POST_SYNC(makeSync(connectionId, { groupId: groupUUID }), {
      params: Promise.resolve({ id: connectionId }),
    });

    // There should still be only one sync record per event (no duplicates)
    const syncRecords = await CalendarEventSync.find({ connectionId });
    const uniqueCalEventIds = new Set(syncRecords.map((r) => r.calendarEventId));
    expect(uniqueCalEventIds.size).toBe(syncRecords.length);

    // The mock provider's update should have been called
    const { mockUpdatedEvents } = await import("@/lib/calendarProviders/mock");
    expect(mockUpdatedEvents.size).toBeGreaterThan(0);
  });

  it("returns 400 when sync is not enabled on the connection", async () => {
    const disabledConn = await CalendarConnection.create({
      userId,
      provider: "outlook",
      providerAccountId: "outlook-disabled",
      encryptedAccessToken: encrypt("tok"),
      tokenExpiresAt: new Date(Date.now() + 3600000),
      calendarId: "mock-primary",
      syncEnabled: false,
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId },
      expires: "9999",
    });
    const res = await POST_SYNC(
      makeSync(disabledConn._id.toString(), { groupId: groupUUID }),
      { params: Promise.resolve({ id: disabledConn._id.toString() }) },
    );
    expect(res.status).toBe(400);

    await CalendarConnection.findByIdAndDelete(disabledConn._id);
  });
});
