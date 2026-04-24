import { jest } from "@jest/globals";

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.unstable_mockModule("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.unstable_mockModule("@/lib/auth", () => ({
  authOptions: {},
}));

jest.unstable_mockModule("@/lib/dbConnect", () => ({
  default: jest.fn(),
}));

jest.unstable_mockModule("@/lib/roles", () => ({
  getMemberPermissions: jest.fn(),
}));

jest.unstable_mockModule("@/models/CalendarEvent", () => ({
  default: {
    bulkWrite: jest.fn(),
  },
}));

// ── Dynamic imports (after mocks are registered) ───────────────────────────

const { getServerSession } = await import("next-auth");
const { getMemberPermissions } = await import("@/lib/roles");
const { default: CalendarEvent } = await import("@/models/CalendarEvent");
const { PATCH } =
  (await import("@/app/api/groups/[groupId]/calendar/events/reorder/route")) as {
    PATCH: Function;
  };

// ── Helpers ────────────────────────────────────────────────────────────────

const GROUP_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeRequest(body: unknown) {
  return {
    json: (jest.fn() as any).mockResolvedValue(body),
  } as any;
}

const context = { params: Promise.resolve({ groupId: GROUP_ID }) };

// ── Test Suite ─────────────────────────────────────────────────────────────

describe("User Story #3: Drag and Drop Reordering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when the user is not authenticated", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await PATCH(makeRequest({}), context);
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid payload (empty orders array)", async () => {
    (getServerSession as any).mockResolvedValue({
      user: { userId: "admin-1" },
    });
    (getMemberPermissions as any).mockResolvedValue({
      canEdit: true,
      status: 200,
    });
    const res = await PATCH(makeRequest({ orders: [] }), context);
    expect(res.status).toBe(400);
  });

  it("returns 404 when the group is not found", async () => {
    (getServerSession as any).mockResolvedValue({
      user: { userId: "leader-1" },
    });
    (getMemberPermissions as any).mockResolvedValue({
      error: "Group not found",
      status: 404,
    });
    const res = await PATCH(
      makeRequest({ orders: [{ eventId: "evt-1", displayOrder: 0 }] }),
      context,
    );
    expect(res.status).toBe(404);
  });

  it("persists the new displayOrder for each event and returns 200", async () => {
    (getServerSession as any).mockResolvedValue({
      user: { userId: "leader-1" },
    });
    (getMemberPermissions as any).mockResolvedValue({
      canEdit: true,
      status: 200,
    });
    (CalendarEvent.bulkWrite as any).mockResolvedValue({ ok: 1 });

    const orders = [
      { eventId: "evt-a", displayOrder: 0 },
      { eventId: "evt-b", displayOrder: 1 },
      { eventId: "evt-c", displayOrder: 2 },
    ];

    const res = await PATCH(makeRequest({ orders }), context);
    expect(res.status).toBe(200);

    expect(CalendarEvent.bulkWrite as any).toHaveBeenCalledWith(
      orders.map(({ eventId, displayOrder }) => ({
        updateOne: {
          filter: { _id: eventId, groupId: GROUP_ID },
          update: { $set: { displayOrder } },
        },
      })),
    );
  });

  // AC1: Given I want to move lunch to a later time, When I drag the activity
  // card down the list, Then the rest of the schedule shifts to accommodate the change.
  it("AC1 - Given I want to move lunch to a later time, When I drag the activity card down the list, Then the rest of the schedule shifts to accommodate the change", async () => {
    (getServerSession as any).mockResolvedValue({
      user: { userId: "leader-1" },
    });
    (getMemberPermissions as any).mockResolvedValue({
      canEdit: true,
      status: 200,
    });
    (CalendarEvent.bulkWrite as any).mockResolvedValue({ ok: 1 });

    // lunch was at slot 0, dinner at slot 1 — drag lunch down to slot 1
    // dinner shifts up to slot 0, lunch shifts to slot 1 with dinner's old time
    const orders = [
      {
        eventId: "evt-dinner",
        displayOrder: 0,
        startTime: "2026-04-23T12:00:00Z",
        endTime: "2026-04-23T13:00:00Z",
      },
      {
        eventId: "evt-lunch",
        displayOrder: 1,
        startTime: "2026-04-23T13:00:00Z",
        endTime: "2026-04-23T14:00:00Z",
      },
    ];

    const res = await PATCH(makeRequest({ orders }), context);
    expect(res.status).toBe(200);

    const calls = (CalendarEvent.bulkWrite as any).mock.calls[0][0];
    // dinner now occupies the first slot
    expect(calls[0].updateOne.update.$set.displayOrder).toBe(0);
    // lunch has shifted to the later slot
    expect(calls[1].updateOne.update.$set.displayOrder).toBe(1);
    expect(calls[1].updateOne.update.$set.startTime).toEqual(
      new Date("2026-04-23T13:00:00Z"),
    );
  });

  // AC2: Given I am a Viewer, When I try to drag a card, Then the UI prevents
  // the movement and shows a read-only tooltip.
  it("AC2 - Given I am a Viewer, When I try to drag a card, Then the UI prevents the movement and shows a read-only tooltip", async () => {
    (getServerSession as any).mockResolvedValue({
      user: { userId: "viewer-1" },
    });
    (getMemberPermissions as any).mockResolvedValue({
      canEdit: false,
      status: 200,
    });

    const res = await PATCH(
      makeRequest({
        orders: [{ eventId: "evt-1", displayOrder: 0 }],
      }),
      context,
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/viewers cannot/i);
  });

  // AC3: Given a schedule change is made, When I refresh the page, Then the
  // activities stay in the new order I set.
  it("AC3 - Given a schedule change is made, When I refresh the page, Then the activities stay in the new order I set", async () => {
    (getServerSession as any).mockResolvedValue({
      user: { userId: "leader-1" },
    });
    (getMemberPermissions as any).mockResolvedValue({
      canEdit: true,
      status: 200,
    });
    (CalendarEvent.bulkWrite as any).mockResolvedValue({ ok: 1 });

    const reorderedPayload = [
      { eventId: "evt-b", displayOrder: 0 },
      { eventId: "evt-a", displayOrder: 1 },
    ];

    const res = await PATCH(makeRequest({ orders: reorderedPayload }), context);
    expect(res.status).toBe(200);

    const calls = (CalendarEvent.bulkWrite as any).mock.calls[0][0];
    expect(calls[0].updateOne.update.$set.displayOrder).toBe(0);
    expect(calls[1].updateOne.update.$set.displayOrder).toBe(1);
  });
});
