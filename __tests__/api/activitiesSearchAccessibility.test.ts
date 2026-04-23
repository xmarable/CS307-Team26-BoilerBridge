import { jest } from "@jest/globals";
import mongoose from "mongoose";

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
const { default: Activity } = await import("@/models/Activity");
const route = await import("@/app/api/activities/search/route");
const GET = route.GET as (req: Request) => Promise<Response>;

const CONNECTION_CLEANUP_DELAY_MS = 500;

beforeAll(async () => {
  await dbConnect();
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await Activity.deleteMany({});
    await mongoose.connection.close();
  }
  await new Promise((r) => setTimeout(r, CONNECTION_CLEANUP_DELAY_MS));
});

beforeEach(async () => {
  jest.clearAllMocks();
  await Activity.deleteMany({});
  mockGetServerSession.mockResolvedValue({
    user: { id: "user-1", email: "u@test.com" },
    expires: "9999-01-01",
  } as never);
});

describe("GET /api/activities/search accessibility filters", () => {
  it("returns 400 for invalid accessibility payload", async () => {
    const res = await GET(
      new Request(
        "http://localhost/api/activities/search?q=museum&wheelchairAccessible=maybe",
      ),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid accessibility");
    expect(data.details).toBeDefined();
  });

  it("filters out mismatched places and returns helpful empty state payload", async () => {
    await Activity.create([
      {
        name: "Museum One",
        address: "A",
        reviewCount: 0,
        wheelchairAccessible: false,
      },
      {
        name: "Museum Two",
        address: "B",
        reviewCount: 0,
        wheelchairAccessible: true,
      },
    ]);

    const res = await GET(
      new Request(
        "http://localhost/api/activities/search?q=museum&wheelchairAccessible=true",
      ),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].name).toBe("Museum Two");
  });
});

