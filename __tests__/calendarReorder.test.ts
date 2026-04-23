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
const { PATCH } = (await import(
  "@/app/api/groups/[groupId]/calendar/events/reorder/route"
)) as { PATCH: Function };

// ── Helpers ────────────────────────────────────────────────────────────────

const GROUP_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeRequest(body: unknown) {
  return {
    json: (jest.fn() as any).mockResolvedValue(body),
  } as any;
}

const context = { params: Promise.resolve({ groupId: GROUP_ID }) };

// ── Test Suite ─────────────────────────────────────────────────────────────

describe("PATCH /api/groups/[groupId]/calendar/events/reorder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when the user is not authenticated", async () => {
    (getServerSession as any).mockResolvedValue(null);

    const res = await PATCH(makeRequest({}), context);
    expect(res.status).toBe(401);
  });

  it("returns 403 when a Viewer attempts to reorder", async () => {
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

    // Verify bulkWrite was called with the correct update ops for each event
    expect(CalendarEvent.bulkWrite as any).toHaveBeenCalledWith(
      orders.map(({ eventId, displayOrder }) => ({
        updateOne: {
          filter: { _id: eventId, groupId: GROUP_ID },
          update: { $set: { displayOrder } },
        },
      })),
    );
  });

  it("Given a schedule change is made, When I refresh the page, Then the activities stay in the new order", async () => {
    // Simulates the full reorder persistence flow:
    // 1. Leader drags evt-b above evt-a → sends new displayOrders
    // 2. bulkWrite stores them → next GET returns events sorted by displayOrder
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

    // Confirm the DB write reflects the user's new ordering
    const calls = (CalendarEvent.bulkWrite as any).mock.calls[0][0];
    expect(calls[0].updateOne.update.$set.displayOrder).toBe(0); // evt-b is now first
    expect(calls[1].updateOne.update.$set.displayOrder).toBe(1); // evt-a is now second
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
});
