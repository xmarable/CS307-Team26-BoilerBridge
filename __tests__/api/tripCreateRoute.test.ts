import { jest } from "@jest/globals";

const mockGenerateRainyDayPlan = jest.fn();
const mockTripCreate = jest.fn();
const mockMustHaveInsertMany = jest.fn();
const mockGetServerSession = jest.fn();
const mockGetMemberPermissions = jest.fn();

await jest.unstable_mockModule("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

await jest.unstable_mockModule("@/lib/auth", () => ({
  authOptions: {},
}));

await jest.unstable_mockModule("@/lib/dbConnect", () => ({
  __esModule: true,
  default: jest.fn(),
}));

await jest.unstable_mockModule("@/lib/rainyDayEngine", () => ({
  generateRainyDayPlan: mockGenerateRainyDayPlan,
}));

await jest.unstable_mockModule("@/lib/roles", () => ({
  getMemberPermissions: mockGetMemberPermissions,
}));

await jest.unstable_mockModule("@/models/Trip", () => ({
  __esModule: true,
  default: { create: mockTripCreate, find: jest.fn() },
}));

await jest.unstable_mockModule("@/models/MustHave", () => ({
  __esModule: true,
  default: { insertMany: mockMustHaveInsertMany },
}));

const route = await import("@/app/api/trip/route");

const validBody = {
  groupId: "15105263-6166-40c8-977a-a3575375bc58",
  fromCity: "Chicago",
  toCity: "New York",
  fromDate: "2026-05-01",
  toDate: "2026-05-04",
  mode: "flight",
  budget: 700,
};

describe("POST /api/trip rainy-day sanitization", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetServerSession.mockResolvedValue({
      user: { userId: "34be63e5-f03d-4e4e-b6a7-a2cd0c27313c" },
    });

    mockGetMemberPermissions.mockResolvedValue({ canEdit: true });

    mockGenerateRainyDayPlan.mockResolvedValue([
      {
        activityId: "rainy-1",
        name: "Museum Visit",
        startTime: new Date("2026-05-01T10:00:00.000Z"),
        endTime: new Date("2026-05-01T12:00:00.000Z"),
        isOutdoor: false,
      },
    ]);

    mockTripCreate.mockImplementation(async (doc) => ({
      _id: "trip-id",
      ...doc,
    }));
    mockMustHaveInsertMany.mockResolvedValue([]);
  });

  it("creates a trip when rainyDayItinerary is omitted", async () => {
    const req = new Request("http://localhost/api/trip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    const res = await route.POST(req);
    expect(res.status).toBe(201);

    expect(mockGenerateRainyDayPlan).toHaveBeenCalledTimes(1);
    expect(mockTripCreate).toHaveBeenCalledTimes(1);

    const createdDoc = mockTripCreate.mock.calls[0][0];
    expect(Array.isArray(createdDoc.rainyDayItinerary)).toBe(true);
    expect(createdDoc.rainyDayItinerary).toHaveLength(1);
    expect(createdDoc.rainyDayItinerary[0].name).toBe("Museum Visit");
  });

  it("filters out empty rainy-day placeholder objects and falls back", async () => {
    const req = new Request("http://localhost/api/trip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...validBody,
        rainyDayItinerary: [{}],
      }),
    });

    const res = await route.POST(req);
    expect(res.status).toBe(201);

    expect(mockGenerateRainyDayPlan).toHaveBeenCalledTimes(1);
    const createdDoc = mockTripCreate.mock.calls[0][0];
    expect(createdDoc.rainyDayItinerary).toHaveLength(1);
    expect(createdDoc.rainyDayItinerary[0].activityId).toBe("rainy-1");
  });

  it("uses valid provided rainy-day itinerary items without fallback generation", async () => {
    const req = new Request("http://localhost/api/trip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...validBody,
        rainyDayItinerary: [
          {
            activityId: "manual-1",
            name: "Indoor Arcade",
            startTime: "2026-05-02T13:00:00.000Z",
            endTime: "2026-05-02T15:00:00.000Z",
            isOutdoor: false,
            category: "Leisure",
            location: "Downtown",
          },
        ],
      }),
    });

    const res = await route.POST(req);
    expect(res.status).toBe(201);

    expect(mockGenerateRainyDayPlan).not.toHaveBeenCalled();
    const createdDoc = mockTripCreate.mock.calls[0][0];
    expect(createdDoc.rainyDayItinerary).toHaveLength(1);
    expect(createdDoc.rainyDayItinerary[0]).toMatchObject({
      activityId: "manual-1",
      name: "Indoor Arcade",
      isOutdoor: false,
      category: "Leisure",
      location: "Downtown",
    });
  });

  it("stores submitted must-haves as approved group items", async () => {
    const req = new Request("http://localhost/api/trip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...validBody,
        mustHaves: [{ name: "Science Museum", address: "Main St" }],
      }),
    });

    const res = await route.POST(req);
    expect(res.status).toBe(201);
    expect(mockMustHaveInsertMany).toHaveBeenCalledTimes(1);
    expect(mockMustHaveInsertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        groupId: validBody.groupId,
        name: "Science Museum",
        address: "Main St",
        status: "approved",
      }),
    ]);
  });
});
