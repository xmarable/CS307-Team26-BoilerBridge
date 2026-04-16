import { jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockGetServerSession = jest.fn();
const mockEnrich = jest.fn();

await jest.unstable_mockModule("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

await jest.unstable_mockModule("@/lib/auth", () => ({
  authOptions: {},
}));

await jest.unstable_mockModule("@/lib/travel/enrichActivityForApi", () => ({
  enrichActivityForApi: mockEnrich,
}));

const { GET } = await import("@/app/api/activities/preview/route");

describe("GET /api/activities/preview (name-only US15)", () => {
  beforeEach(() => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "mongo-user-id" },
    });
    mockEnrich.mockResolvedValue({
      activity: {
        name: "Resolved pier",
        isPreview: true,
        rating: 4.2,
        reviewCount: 10,
        referenceLinks: [],
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("accepts name without placeId and calls enrichActivityForApi", async () => {
    const req = new NextRequest(
      "http://localhost/api/activities/preview?name=Navy%20Pier&address=Chicago",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockEnrich).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Navy Pier",
        address: "Chicago",
        reviewCount: 0,
      }),
    );
    expect(mockEnrich.mock.calls[0][0]).not.toHaveProperty("placeId");
    const body = await res.json();
    expect(body.activity?.name).toBe("Resolved pier");
  });

  it("returns 400 when neither placeId nor sufficient name is provided", async () => {
    const req = new NextRequest("http://localhost/api/activities/preview?name=a");
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect(mockEnrich).not.toHaveBeenCalled();
  });

  it("passes destination city for destination-aware enrichment", async () => {
    const req = new NextRequest(
      "http://localhost/api/activities/preview?name=Magnolia+Bakery&destination=Chicago",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockEnrich).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Magnolia Bakery",
        destinationCity: "Chicago",
      }),
    );
  });
});
