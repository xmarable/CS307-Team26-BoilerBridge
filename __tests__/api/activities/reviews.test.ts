/** @jest-environment node */
import { jest } from "@jest/globals";
import mongoose from "mongoose";

jest.unstable_mockModule("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.unstable_mockModule("@/lib/auth", () => ({
  authOptions: {},
}));

const { default: dbConnect } = await import("@/lib/dbConnect");
const { default: Activity } = await import("@/models/Activity");
const { getServerSession } = await import("next-auth");
const { GET } = await import("@/app/api/activities/[activityId]/reviews/route");

const mockGetServerSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;

const CONNECTION_CLEANUP_DELAY_MS = 500;

beforeAll(async () => {
  await dbConnect();
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await Activity.deleteMany({});
    await mongoose.connection.close(true);
  }
  await mongoose.disconnect();
  if ((global as unknown as { mongoose?: { conn: null; promise: null } }).mongoose) {
    (global as unknown as { mongoose: { conn: null; promise: null } }).mongoose.conn = null;
    (global as unknown as { mongoose: { promise: null } }).mongoose.promise = null;
  }
  await new Promise((resolve) => {
    const t = setTimeout(resolve, CONNECTION_CLEANUP_DELAY_MS);
    t.unref();
  });
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/activities/[activityId]/reviews", () => {
  it("rejects unauthenticated requests with 401", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const req = new Request("http://localhost/api/activities/507f1f77bcf86cd799439011/reviews");
    const res = await GET(req, {
      params: Promise.resolve({ activityId: "507f1f77bcf86cd799439011" }),
    });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toMatch(/Unauthorized/i);
  });

  it("returns 400 for invalid activityId", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "507f1f77bcf86cd799439011" },
      expires: "",
    });

    const req = new Request("http://localhost/api/activities/bad-id/reviews");
    const res = await GET(req, {
      params: Promise.resolve({ activityId: "bad-id" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/Invalid activity ID/i);
  });

  it("returns 404 for non-existent activityId", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "507f1f77bcf86cd799439011" },
      expires: "",
    });

    const fakeId = new mongoose.Types.ObjectId();
    const req = new Request(`http://localhost/api/activities/${fakeId}/reviews`);
    const res = await GET(req, {
      params: Promise.resolve({ activityId: fakeId.toString() }),
    });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toMatch(/Activity not found/i);
  });

  it("returns reviews for valid activityId with stored data", async () => {
    const activity = await Activity.create({
      name: "Test Place",
      address: "123 Main St",
      rating: 4.5,
      reviewCount: 2,
      reviews: [
        { author: "Alice", text: "Great spot!", rating: 5, time: new Date() },
        { author: "Bob", text: "Nice.", rating: 4, time: new Date() },
      ],
    });
    const activityId = activity._id.toString();

    mockGetServerSession.mockResolvedValue({
      user: { id: "507f1f77bcf86cd799439011" },
      expires: "",
    });

    const req = new Request(`http://localhost/api/activities/${activityId}/reviews`);
    const res = await GET(req, {
      params: Promise.resolve({ activityId }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe("Test Place");
    expect(data.rating).toBe(4.5);
    expect(data.reviewCount).toBe(2);
    expect(Array.isArray(data.reviews)).toBe(true);
    expect(data.reviews).toHaveLength(2);
    expect(data.reviews[0].author).toBe("Alice");
    expect(data.reviews[0].text).toBe("Great spot!");
    expect(data.reviews[0].rating).toBe(5);

    await Activity.deleteOne({ _id: activity._id });
  });

  it("returns empty reviews when Activity has no reviews", async () => {
    const activity = await Activity.create({
      name: "Empty Place",
      reviewCount: 0,
      reviews: [],
    });
    const activityId = activity._id.toString();

    mockGetServerSession.mockResolvedValue({
      user: { id: "507f1f77bcf86cd799439011" },
      expires: "",
    });

    const req = new Request(`http://localhost/api/activities/${activityId}/reviews`);
    const res = await GET(req, {
      params: Promise.resolve({ activityId }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe("Empty Place");
    expect(data.reviews).toEqual([]);
    expect(data.reviewCount).toBe(0);
    expect(data.rating).toBeNull();

    await Activity.deleteOne({ _id: activity._id });
  });
});
