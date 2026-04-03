import { jest } from "@jest/globals";

const mockFindById = jest.fn();
const mockDbConnect = jest.fn().mockResolvedValue(undefined);

let GET: typeof import("@/app/api/activities/[activityId]/route").GET;
let mockGetServerSession: jest.Mock;

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
  default: { findById: mockFindById },
}));

beforeAll(async () => {
  jest.resetModules();
  const nextAuth = await import("next-auth");
  mockGetServerSession = nextAuth.getServerSession as unknown as jest.Mock;

  const route = await import("@/app/api/activities/[activityId]/route");
  GET = route.GET;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockDbConnect.mockResolvedValue(undefined);
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
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid activity id", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "user1" },
    });
    const req = new Request("http://localhost/api/activities/not-valid");
    const res = await GET(req as never, {
      params: Promise.resolve({ activityId: "not-valid" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when activity missing", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "user1" },
    });
    mockFindById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
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

    const doc = {
      _id: "507f1f77bcf86cd799439011",
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

    mockFindById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(doc),
    });

    const oid = "507f1f77bcf86cd799439011";
    const req = new Request(`http://localhost/api/activities/${oid}`);
    const res = await GET(req as never, {
      params: Promise.resolve({ activityId: oid }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.activity.name).toBe("Museum Tour");
    expect(json.activity.description).toBe("A great museum.");
    expect(json.activity.referenceLinks).toHaveLength(1);
    expect(json.activity.bookingUrl).toBe("https://tickets.example/museum");
  });
});
