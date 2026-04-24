import { jest } from "@jest/globals";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

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
const { default: User } = await import("@/models/User");
const { default: TravelGroup } = await import("@/models/TravelGroup");
const { default: Trip } = await import("@/models/Trip");
const { default: CalendarEvent } = await import("@/models/CalendarEvent");

let PATCH: (
  req: Request,
  ctx: { params: Promise<{ groupId: string; optionId: string }> },
) => Promise<Response>;
let GETCalendar: (
  req: Request,
  ctx: { params: Promise<{ groupId: string }> },
) => Promise<Response>;

let groupUUID: string;
let leaderId: string;
let viewerId: string;
let tripId: mongoose.Types.ObjectId;

beforeAll(async () => {
  await dbConnect();
  const route = await import(
    "@/app/api/groups/[groupId]/itinerary/options/[optionId]/route"
  );
  PATCH = route.PATCH as any;
  const cal = await import("@/app/api/groups/[groupId]/calendar/events/route");
  GETCalendar = cal.GET as any;

  const hash = await bcrypt.hash("pw", 10);
  const leader = await User.create({
    username: `dismiss_ld_${randomUUID().slice(0, 8)}`,
    email: `dismiss_ld_${randomUUID().slice(0, 8)}@t.com`,
    passwordHash: hash,
    school: "Purdue",
  });
  const viewer = await User.create({
    username: `dismiss_vw_${randomUUID().slice(0, 8)}`,
    email: `dismiss_vw_${randomUUID().slice(0, 8)}@t.com`,
    passwordHash: hash,
    school: "Purdue",
  });
  leaderId = leader.userId.toString();
  viewerId = viewer.userId.toString();

  const g = await TravelGroup.create({
    groupName: "Dismiss test",
    leaderID: leaderId,
    membersList: [
      { userId: leaderId, role: "Leader" },
      { userId: viewerId, role: "Viewer" },
    ],
  });
  groupUUID = g.groupID.toString();

  const trip = await Trip.create({
    groupID: groupUUID,
    userId: leaderId,
    fromCity: "A",
    toCity: "B",
    fromDate: new Date("2026-06-01"),
    toDate: new Date("2026-06-05"),
    mode: "flight",
    budget: 1000,
    avoidActivities: [],
  });
  tripId = trip._id as mongoose.Types.ObjectId;
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await CalendarEvent.deleteMany({ groupId: groupUUID });
    await Trip.deleteMany({ groupID: groupUUID });
    await TravelGroup.deleteMany({ groupID: groupUUID });
    await User.deleteMany({
      userId: { $in: [leaderId, viewerId] },
    });
    await mongoose.connection.close();
  }
});

describe("PATCH /api/groups/:groupId/itinerary/options/:optionId", () => {
  it("returns 403 for Viewer", async () => {
    const ev = await CalendarEvent.create({
      title: "Cand",
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      createdBy: leaderId,
      groupId: groupUUID,
      source: "itinerary",
      itineraryOptionStatus: "candidate",
    });
    mockGetServerSession.mockResolvedValue({
      user: { userId: viewerId },
      expires: "9999",
    });
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH" }) as any,
      {
        params: Promise.resolve({
          groupId: groupUUID,
          optionId: String(ev._id),
        }),
      },
    );
    expect(res.status).toBe(403);
    await CalendarEvent.deleteOne({ _id: ev._id });
  });

  it("returns 404 for invalid option id", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH" }) as any,
      {
        params: Promise.resolve({
          groupId: groupUUID,
          optionId: "507f1f77bcf86cd799439011",
        }),
      },
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for finalized itinerary option", async () => {
    const ev = await CalendarEvent.create({
      title: "Final opt",
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      createdBy: leaderId,
      groupId: groupUUID,
      source: "itinerary",
      itineraryOptionStatus: "final",
    });
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH" }) as any,
      {
        params: Promise.resolve({
          groupId: groupUUID,
          optionId: String(ev._id),
        }),
      },
    );
    expect(res.status).toBe(400);
    await CalendarEvent.deleteOne({ _id: ev._id });
  });

  it("dismisses candidate and excludes title on trip", async () => {
    const title = `Excl-${randomUUID().slice(0, 6)}`;
    const ev = await CalendarEvent.create({
      title,
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      createdBy: leaderId,
      groupId: groupUUID,
      source: "itinerary",
      itineraryOptionStatus: "candidate",
    });
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const res = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss" }),
      }) as any,
      {
        params: Promise.resolve({
          groupId: groupUUID,
          optionId: String(ev._id),
        }),
      },
    );
    expect(res.status).toBe(200);

    const from = new Date(Date.now() - 86400000).toISOString();
    const to = new Date(Date.now() + 86400000 * 30).toISOString();
    mockGetServerSession.mockResolvedValue({
      user: { userId: leaderId },
      expires: "9999",
    });
    const getRes = await GETCalendar(
      new Request(`http://localhost?from=${from}&to=${to}`) as any,
      { params: Promise.resolve({ groupId: groupUUID }) },
    );
    const cal = await getRes.json();
    const ids = (cal.events as { _id: string }[]).map((e) => String(e._id));
    expect(ids).not.toContain(String(ev._id));

    const t = await Trip.findById(tripId).lean();
    expect((t as { avoidActivities?: string[] }).avoidActivities).toContain(
      title,
    );

    await CalendarEvent.deleteOne({ _id: ev._id });
    await Trip.updateOne(
      { _id: tripId },
      { $pull: { avoidActivities: title } },
    );
  });
});
