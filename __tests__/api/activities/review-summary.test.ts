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
const { GET } = await import("@/app/api/activities/[activityId]/review-summary/route");
const { computeReviewSummary } = await import("@/lib/reviewSummary");

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

describe("computeReviewSummary", () => {
  it("returns null for empty reviews", () => {
    expect(computeReviewSummary([])).toBeNull();
  });

  it("computes average rating and sentiment for positive reviews", () => {
    const reviews = [
      { author: "A", text: "Great place!", rating: 5, time: new Date() },
      { author: "B", text: "Loved it", rating: 5, time: new Date() },
    ];
    const summary = computeReviewSummary(reviews);
    expect(summary).not.toBeNull();
    expect(summary!.averageRating).toBe(5);
    expect(summary!.sentimentSummary).toMatch(/positive/i);
    expect(summary!.highlights.length).toBeGreaterThan(0);
  });

  it("computes sentiment for mixed reviews", () => {
    const reviews = [
      { author: "A", text: "Okay", rating: 3, time: new Date() },
      { author: "B", text: "Meh", rating: 3, time: new Date() },
    ];
    const summary = computeReviewSummary(reviews);
    expect(summary).not.toBeNull();
    expect(summary!.sentimentSummary).toMatch(/mixed/i);
  });

  it("extracts pros from positive keywords", () => {
    const reviews = [
      { author: "A", text: "Great and amazing experience", rating: 5, time: new Date() },
    ];
    const summary = computeReviewSummary(reviews);
    expect(summary).not.toBeNull();
    expect(summary!.pros.length).toBeGreaterThan(0);
  });
});

describe("GET /api/activities/[activityId]/review-summary", () => {
  it("rejects unauthenticated requests with 401", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const req = new Request("http://localhost/api/activities/507f1f77bcf86cd799439011/review-summary");
    const res = await GET(req, {
      params: Promise.resolve({ activityId: "507f1f77bcf86cd799439011" }),
    });
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toMatch(/Unauthorized/i);
  });

  it("returns 400 for invalid activityId", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user1" }, expires: "" });
    const req = new Request("http://localhost/api/activities/bad-id/review-summary");
    const res = await GET(req, { params: Promise.resolve({ activityId: "bad-id" }) });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/Invalid activity ID/i);
  });

  it("returns 404 for non-existent activity", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user1" }, expires: "" });
    const fakeId = new mongoose.Types.ObjectId();
    const req = new Request(`http://localhost/api/activities/${fakeId}/review-summary`);
    const res = await GET(req, { params: Promise.resolve({ activityId: fakeId.toString() }) });
    const data = await res.json();
    expect(res.status).toBe(404);
    expect(data.error).toMatch(/Activity not found/i);
  });

  it("returns message when activity has no reviews", async () => {
    const activity = await Activity.create({
      name: "Empty Place",
      reviewCount: 0,
      reviews: [],
    });
    mockGetServerSession.mockResolvedValue({ user: { id: "user1" }, expires: "" });
    const req = new Request(`http://localhost/api/activities/${activity._id}/review-summary`);
    const res = await GET(req, { params: Promise.resolve({ activityId: activity._id.toString() }) });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.summary).toBeNull();
    expect(data.message).toMatch(/No reviews/i);
    await Activity.deleteOne({ _id: activity._id });
  });

  it("returns computed summary for activity with reviews", async () => {
    const activity = await Activity.create({
      name: "Test Place",
      reviewCount: 2,
      reviews: [
        { author: "A", text: "Great spot!", rating: 5, time: new Date() },
        { author: "B", text: "Nice place", rating: 4, time: new Date() },
      ],
    });
    mockGetServerSession.mockResolvedValue({ user: { id: "user1" }, expires: "" });
    const req = new Request(`http://localhost/api/activities/${activity._id}/review-summary`);
    const res = await GET(req, { params: Promise.resolve({ activityId: activity._id.toString() }) });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.summary).not.toBeNull();
    expect(data.summary.averageRating).toBe(4.5);
    expect(data.summary.sentimentSummary).toBeDefined();
    expect(data.summary.highlights).toBeDefined();
    expect(Array.isArray(data.summary.highlights)).toBe(true);
    await Activity.deleteOne({ _id: activity._id });
  });
});
