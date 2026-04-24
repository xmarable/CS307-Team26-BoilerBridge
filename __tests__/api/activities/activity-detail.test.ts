import { jest } from "@jest/globals";

const mockFindOne = jest.fn<any>();
const mockUpdateOne = jest.fn<any>().mockResolvedValue({ acknowledged: true });
const mockDbConnect = jest.fn<any>().mockResolvedValue(undefined);

let GET: typeof import("@/app/api/activities/[activityId]/route").GET;
let mockGetServerSession: jest.Mock<any>;

await jest.unstable_mockModule("next-auth", () => ({
  getServerSession: jest.fn(),
}));

await jest.unstable_mockModule("@/lib/auth", () => ({
  authOptions: {},
}));

await jest.unstable_mockModule("@/lib/dbConnect", () => ({
  default: mockDbConnect,
}));

await jest.unstable_mockModule("@/models/Activity", () => ({
  default: { findOne: mockFindOne, updateOne: mockUpdateOne },
}));

beforeAll(async () => {
  jest.resetModules();
  const nextAuth = (await import("next-auth")) as any;
  mockGetServerSession = nextAuth.getServerSession;

  const route = await import("@/app/api/activities/[activityId]/route");
  GET = route.GET;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockDbConnect.mockResolvedValue(undefined);
  delete process.env.GOOGLE_MAPS_API_KEY;
  delete process.env.EXPEDIA_RAPID_API_KEY;
  delete process.env.EXPEDIA_RAPID_SECRET;
});

describe("GET /api/activities/[activityId]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const oid = "507f1f77bcf86cd799439011";
    const req = new Request(`http://localhost/api/activities/${oid}`);
    const res = await GET(req as never, {
      params: Promise.resolve({ activityId: oid }),
    });
    expect(res.status).toBe(401);
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  it("returns 404 when activity id is not found (catalog activityId)", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "user1" },
    });
    mockFindOne.mockReturnValue({
      lean: jest.fn<any>().mockResolvedValue(null),
    });
    const req = new Request("http://localhost/api/activities/not-valid");
    const res = await GET(req as never, {
      params: Promise.resolve({ activityId: "not-valid" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when activity missing", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "user1" },
    });
    mockFindOne.mockReturnValue({
      lean: jest.fn<any>().mockResolvedValue(null),
    });
    const oid = "507f1f77bcf86cd799439011";
    const req = new Request(`http://localhost/api/activities/${oid}`);
    const res = await GET(req as never, {
      params: Promise.resolve({ activityId: oid }),
    });
    expect(res.status).toBe(404);
  });

  it("returns activity details including referenceLinks and bookingUrl", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "user1" },
    });

    const oid = "507f1f77bcf86cd799439011";
    const doc = {
      _id: oid,
      activityId: oid,
      placeId: "p1",
      name: "Museum Tour",
      address: "123 Main St",
      rating: 4.2,
      reviewCount: 3,
      estimatedCost: 25,
      infoUrl: "https://museum.example/info",
      description: "A great museum.",
      referenceLinks: [
        { title: "City guide", url: "https://guide.example/museum" },
      ],
      bookingUrl: "https://tickets.example/museum",
    };

    mockFindOne.mockReturnValue({
      lean: jest.fn<any>().mockResolvedValue(doc),
    });

    const req = new Request(`http://localhost/api/activities/${oid}`);
    const res = await GET(req as never, {
      params: Promise.resolve({ activityId: oid }),
    });

    expect(res.status).toBe(200);
    expect(mockFindOne).toHaveBeenCalledWith({ activityId: oid });
    const json = await res.json();
    expect(json.activity.name).toBe("Museum Tour");
    expect(json.activity.description).toBe("A great museum.");
    expect(json.activity.referenceLinks).toHaveLength(1);
    expect(json.activity.bookingUrl).toBe("https://tickets.example/museum");
    expect(json.activity.bookingPlan?.primary?.label).toBe("Book now");
    expect(json.activity.bookingPlan?.mode).toBe("direct");
    expect(json.activity.shortSummary).toBeTruthy();
  });

  it("returns explore booking plan without primary when no direct booking URL", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "user1" },
    });

    const oid = "507f1f77bcf86cd799439011";
    const doc = {
      _id: oid,
      activityId: oid,
      placeId: "p1",
      name: "City Park",
      address: "1 Green Way",
      rating: 4.5,
      reviewCount: 100,
      googleTypes: ["park", "tourist_attraction"],
    };

    mockFindOne.mockReturnValue({
      lean: jest.fn<any>().mockResolvedValue(doc),
    });

    const req = new Request(`http://localhost/api/activities/${oid}`);
    const res = await GET(req as never, {
      params: Promise.resolve({ activityId: oid }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.activity.bookingPlan?.mode).toBe("explore");
    expect(json.activity.bookingPlan?.primary).toBeUndefined();
    expect(json.activity.bookingPlan?.bookingNote).toBeTruthy();
    expect(json.activity.hintTags).toContain("Outdoors");
  });

  it("omits unsafe manual booking URLs from primary CTA", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "user1" },
    });

    const oid = "507f1f77bcf86cd799439011";
    const doc = {
      _id: oid,
      activityId: oid,
      placeId: "p1",
      name: "Sketchy Venue",
      bookingUrl: "javascript:alert(1)",
      reviewCount: 0,
    };

    mockFindOne.mockReturnValue({
      lean: jest.fn<any>().mockResolvedValue(doc),
    });

    const req = new Request(`http://localhost/api/activities/${oid}`);
    const res = await GET(req as never, {
      params: Promise.resolve({ activityId: oid }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.activity.bookingPlan?.primary).toBeUndefined();
    expect(json.activity.bookingUrl).toMatch(/^https:\/\/www\.expedia\.com\//);
  });
});
