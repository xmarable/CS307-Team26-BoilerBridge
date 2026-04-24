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
const { default: dbConnect } = await import("@/lib/dbConnect");
const { default: User } = await import("@/models/User");
const { default: TravelGroup } = await import("@/models/TravelGroup");
const { default: Notification } = await import("@/models/Notification");

let mockGetServerSession: jest.MockedFunction<any>;

let POSTPaymentRequests: (
  req: Request,
  ctx: { params: Promise<{ groupId: string }> },
) => Promise<Response>;
let GETPaymentRequests: (
  req: Request,
  ctx: { params: Promise<{ groupId: string }> },
) => Promise<Response>;
let PATCHPaymentRequest: (
  req: Request,
  ctx: { params: Promise<{ groupId: string; requestId: string }> },
) => Promise<Response>;
let POSTConfirmPayment: (
  req: Request,
  ctx: { params: Promise<{ groupId: string; requestId: string }> },
) => Promise<Response>;
let PATCHNotificationRead: (
  req: Request,
  ctx: { params: Promise<{ notificationId: string }> },
) => Promise<Response>;
let GETNotifications: (req: Request) => Promise<Response>;

const CONNECTION_CLEANUP_DELAY_MS = 500;

beforeAll(async () => {
  await dbConnect();

  const nextAuth = (await import("next-auth")) as any;
  mockGetServerSession = nextAuth.getServerSession as any;

  const postGet =
    await import("@/app/api/groups/[groupId]/payment-requests/route");
  POSTPaymentRequests = postGet.POST;
  GETPaymentRequests = postGet.GET;
  const patch =
    await import("@/app/api/groups/[groupId]/payment-requests/[requestId]/route");
  PATCHPaymentRequest = patch.PATCH;
  const confirm =
    await import("@/app/api/groups/[groupId]/payment-requests/[requestId]/confirm/route");
  POSTConfirmPayment = confirm.POST;
  const notifRead =
    await import("@/app/api/notifications/[notificationId]/read/route");
  PATCHNotificationRead = notifRead.PATCH;
  const notifGet = await import("@/app/api/notifications/route");
  GETNotifications = notifGet.GET;
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await Notification.deleteMany({});
    await TravelGroup.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();
  }
  await new Promise((r) => setTimeout(r, CONNECTION_CLEANUP_DELAY_MS));
});

beforeEach(() => {
  jest.clearAllMocks();
});

async function createUsersAndGroupWithExpense() {
  const suffix = randomUUID().slice(0, 8);
  const passwordHash = await bcrypt.hash("pw", 10);
  const a = await User.create({
    username: `pr_payer_${suffix}`,
    email: `pr_payer_${suffix}@test.com`,
    passwordHash,
    school: "Purdue",
  });
  const b = await User.create({
    username: `pr_debtor_${suffix}`,
    email: `pr_debtor_${suffix}@test.com`,
    passwordHash,
    school: "Purdue",
  });
  const expenseID = randomUUID();
  const group = await TravelGroup.create({
    groupName: "PR Group",
    leaderID: a.userId,
    membersList: [
      { userId: a.userId, role: "Leader" },
      { userId: b.userId, role: "Viewer" },
    ],
    ledger: [
      {
        expenseID,
        payerID: a.userId,
        amount: 30,
        description: "dinner",
        debtors: new Map([[String(b.userId), 30]]),
        isSettled: false,
      },
    ],
    paymentRequests: [],
  });
  return { a, b, group, expenseID: String(expenseID) };
}

describe("POST /api/groups/[groupId]/payment-requests", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POSTPaymentRequests(
      new Request("http://localhost/api/x/payment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseID: randomUUID(),
          targetMemberID: randomUUID(),
          amount: 10,
        }),
      }),
      {
        params: Promise.resolve({
          groupId: "00000000-0000-4000-8000-000000000001",
        }),
      },
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when creator is not a group member", async () => {
    const s = randomUUID().slice(0, 8);
    const passwordHash = await bcrypt.hash("pw", 10);
    const member = await User.create({
      username: `pr_mem_${s}`,
      email: `pr_mem_${s}@test.com`,
      passwordHash,
      school: "Purdue",
    });
    const outsider = await User.create({
      username: `pr_out_${s}`,
      email: `pr_out_${s}@test.com`,
      passwordHash,
      school: "Purdue",
    });
    const expenseID = randomUUID();
    const other = await User.create({
      username: `pr_other_${s}`,
      email: `pr_other_${s}@test.com`,
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "PR Outsider",
      leaderID: member.userId,
      membersList: [
        { userId: member.userId, role: "Leader" },
        { userId: other.userId, role: "Viewer" },
      ],
      ledger: [
        {
          expenseID,
          payerID: member.userId,
          amount: 20,
          debtors: new Map([[String(other.userId), 20]]),
          isSettled: false,
        },
      ],
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId: outsider.userId },
      expires: "",
    });

    const res = await POSTPaymentRequests(
      new Request("http://localhost/api/x/payment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseID: String(expenseID),
          targetMemberID: String(other.userId),
          amount: 5,
        }),
      }),
      { params: Promise.resolve({ groupId: String(group.groupID) }) },
    );
    expect(res.status).toBe(403);
  });

  it("creates a payment request with correct fields and pending status", async () => {
    const { a, b, group, expenseID } = await createUsersAndGroupWithExpense();

    mockGetServerSession.mockResolvedValue({
      user: { userId: a.userId },
      expires: "",
    });

    const res = await POSTPaymentRequests(
      new Request("http://localhost/api/x/payment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseID,
          targetMemberID: String(b.userId),
          amount: 12.5,
          message: "Please pay",
        }),
      }),
      { params: Promise.resolve({ groupId: String(group.groupID) }) },
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.paymentRequest).toMatchObject({
      requesterID: String(a.userId),
      targetMemberID: String(b.userId),
      expenseID,
      amount: 12.5,
      status: "pending",
      message: "Please pay",
    });
    expect(data.paymentRequest.requestID).toBeTruthy();

    const updated = await TravelGroup.findOne({
      groupID: group.groupID,
    }).lean();
    const prs =
      (updated as { paymentRequests?: unknown[] }).paymentRequests ?? [];
    expect(prs).toHaveLength(1);
    const row = prs[0] as Record<string, unknown>;
    expect(String(row.status)).toBe("pending");
    expect(Number(row.amount)).toBe(12.5);
  });

  it("returns 400 when amount exceeds outstanding balance on expense", async () => {
    const { a, b, group, expenseID } = await createUsersAndGroupWithExpense();

    mockGetServerSession.mockResolvedValue({
      user: { userId: a.userId },
      expires: "",
    });

    const res = await POSTPaymentRequests(
      new Request("http://localhost/api/x/payment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseID,
          targetMemberID: String(b.userId),
          amount: 30.01,
        }),
      }),
      { params: Promise.resolve({ groupId: String(group.groupID) }) },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Amount exceeds outstanding balance");
  });

  it("returns 409 for duplicate pending request same expense, requester, target", async () => {
    const { a, b, group, expenseID } = await createUsersAndGroupWithExpense();

    mockGetServerSession.mockResolvedValue({
      user: { userId: a.userId },
      expires: "",
    });

    const body = {
      expenseID,
      targetMemberID: String(b.userId),
      amount: 10,
    };
    const reqInit = {
      method: "POST" as const,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    };

    const r1 = await POSTPaymentRequests(
      new Request("http://localhost/api/x/payment-requests", reqInit),
      { params: Promise.resolve({ groupId: String(group.groupID) }) },
    );
    expect(r1.status).toBe(201);

    const r2 = await POSTPaymentRequests(
      new Request("http://localhost/api/x/payment-requests", reqInit),
      { params: Promise.resolve({ groupId: String(group.groupID) }) },
    );
    expect(r2.status).toBe(409);
  });
});

describe("PATCH /api/groups/[groupId]/payment-requests/[requestId]", () => {
  it("allows target to decline with optional reason", async () => {
    const { a, b, group, expenseID } = await createUsersAndGroupWithExpense();

    mockGetServerSession.mockResolvedValue({
      user: { userId: a.userId },
      expires: "",
    });

    const postRes = await POSTPaymentRequests(
      new Request("http://localhost/api/x/payment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseID,
          targetMemberID: String(b.userId),
          amount: 5,
        }),
      }),
      { params: Promise.resolve({ groupId: String(group.groupID) }) },
    );
    const { paymentRequest } = await postRes.json();
    const requestID = paymentRequest.requestID as string;

    mockGetServerSession.mockResolvedValue({
      user: { userId: b.userId },
      expires: "",
    });

    const patchRes = await PATCHPaymentRequest(
      new Request("http://localhost/api/x/payment-requests/y", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "declined",
          reason: "Paid cash already",
        }),
      }),
      {
        params: Promise.resolve({
          groupId: String(group.groupID),
          requestId: requestID,
        }),
      },
    );

    expect(patchRes.status).toBe(200);
    const out = await patchRes.json();
    expect(out.paymentRequest.status).toBe("declined");
    expect(out.paymentRequest.declineReason).toBe("Paid cash already");

    const updated = await TravelGroup.findOne({
      groupID: group.groupID,
    }).lean();
    const prs =
      (updated as { paymentRequests?: unknown[] }).paymentRequests ?? [];
    expect(String((prs[0] as { status: string }).status)).toBe("declined");
  });
});

describe("GET /api/groups/[groupId]/payment-requests", () => {
  it("filters sent requests for current user", async () => {
    const { a, b, group, expenseID } = await createUsersAndGroupWithExpense();

    mockGetServerSession.mockResolvedValue({
      user: { userId: a.userId },
      expires: "",
    });

    await POSTPaymentRequests(
      new Request("http://localhost/api/x/payment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseID,
          targetMemberID: String(b.userId),
          amount: 4,
        }),
      }),
      { params: Promise.resolve({ groupId: String(group.groupID) }) },
    );

    const res = await GETPaymentRequests(
      new Request(`http://localhost/api/x/payment-requests?filter=sent`),
      { params: Promise.resolve({ groupId: String(group.groupID) }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.paymentRequests).toHaveLength(1);
    expect(data.paymentRequests[0].requesterID).toBe(String(a.userId));
  });

  it("AC: target member sees pending request in incoming (filter=received)", async () => {
    const { a, b, group, expenseID } = await createUsersAndGroupWithExpense();

    mockGetServerSession.mockResolvedValue({
      user: { userId: a.userId },
      expires: "",
    });

    await POSTPaymentRequests(
      new Request("http://localhost/api/x/payment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseID,
          targetMemberID: String(b.userId),
          amount: 7,
        }),
      }),
      { params: Promise.resolve({ groupId: String(group.groupID) }) },
    );

    mockGetServerSession.mockResolvedValue({
      user: { userId: b.userId },
      expires: "",
    });

    const res = await GETPaymentRequests(
      new Request("http://localhost/api/x/payment-requests?filter=received"),
      { params: Promise.resolve({ groupId: String(group.groupID) }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.paymentRequests).toHaveLength(1);
    expect(data.paymentRequests[0].targetMemberID).toBe(String(b.userId));
    expect(data.paymentRequests[0].status).toBe("pending");
  });

  it("AC: requester sees declined status on outgoing after target declines", async () => {
    const { a, b, group, expenseID } = await createUsersAndGroupWithExpense();

    mockGetServerSession.mockResolvedValue({
      user: { userId: a.userId },
      expires: "",
    });

    const postRes = await POSTPaymentRequests(
      new Request("http://localhost/api/x/payment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseID,
          targetMemberID: String(b.userId),
          amount: 6,
        }),
      }),
      { params: Promise.resolve({ groupId: String(group.groupID) }) },
    );
    const { paymentRequest } = await postRes.json();
    const requestID = paymentRequest.requestID as string;

    mockGetServerSession.mockResolvedValue({
      user: { userId: b.userId },
      expires: "",
    });

    await PATCHPaymentRequest(
      new Request("http://localhost/api/x/payment-requests/y", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "declined", reason: "No thanks" }),
      }),
      {
        params: Promise.resolve({
          groupId: String(group.groupID),
          requestId: requestID,
        }),
      },
    );

    mockGetServerSession.mockResolvedValue({
      user: { userId: a.userId },
      expires: "",
    });

    const getRes = await GETPaymentRequests(
      new Request("http://localhost/api/x/payment-requests?filter=sent"),
      { params: Promise.resolve({ groupId: String(group.groupID) }) },
    );
    expect(getRes.status).toBe(200);
    const data = await getRes.json();
    expect(data.paymentRequests).toHaveLength(1);
    expect(data.paymentRequests[0].status).toBe("declined");
    expect(data.paymentRequests[0].declineReason).toBe("No thanks");
  });

  it("returns 403 when viewer is not a group member", async () => {
    const s = randomUUID().slice(0, 8);
    const passwordHash = await bcrypt.hash("pw", 10);
    const member = await User.create({
      username: `pr_get_${s}`,
      email: `pr_get_${s}@test.com`,
      passwordHash,
      school: "Purdue",
    });
    const outsider = await User.create({
      username: `pr_getout_${s}`,
      email: `pr_getout_${s}@test.com`,
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: `PR GET ${s}`,
      leaderID: member.userId,
      membersList: [{ userId: member.userId, role: "Leader" }],
      ledger: [],
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId: outsider.userId },
      expires: "",
    });

    const res = await GETPaymentRequests(
      new Request("http://localhost/api/x/payment-requests"),
      { params: Promise.resolve({ groupId: String(group.groupID) }) },
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/groups/.../payment-requests/.../confirm", () => {
  it("sets paid, confirmedAt, notifies requester, and updates ledger when target confirms", async () => {
    const { a, b, group, expenseID } = await createUsersAndGroupWithExpense();

    mockGetServerSession.mockResolvedValue({
      user: { userId: a.userId },
      expires: "",
    });

    const postRes = await POSTPaymentRequests(
      new Request("http://localhost/api/x/payment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseID,
          targetMemberID: String(b.userId),
          amount: 30,
        }),
      }),
      { params: Promise.resolve({ groupId: String(group.groupID) }) },
    );
    expect([200, 201]).toContain(postRes.status);
    const { paymentRequest } = await postRes.json();
    const requestID = paymentRequest.requestID as string;

    mockGetServerSession.mockResolvedValue({
      user: { userId: b.userId },
      expires: "",
    });

    const confirmRes = await POSTConfirmPayment(
      new Request("http://localhost/api/x/confirm", { method: "POST" }),
      {
        params: Promise.resolve({
          groupId: String(group.groupID),
          requestId: requestID,
        }),
      },
    );
    expect(confirmRes.status).toBe(200);
    const body = await confirmRes.json();
    expect(body.paymentRequest.status).toBe("paid");
    expect(body.paymentRequest.confirmedAt).toBeTruthy();

    const notif = await Notification.findOne({
      recipientID: a.userId,
      type: "payment_confirmed",
    }).lean();
    expect(notif).toBeTruthy();
    expect(String(notif!.paymentRequestID)).toBe(requestID);
    expect(String(notif!.message)).toContain("has confirmed payment");

    const updated = await TravelGroup.findOne({
      groupID: group.groupID,
    }).lean();
    const ledger =
      (updated as { ledger?: { isSettled?: boolean }[] }).ledger ?? [];
    expect(ledger[0]?.isSettled).toBe(true);
  });

  it("returns 403 when requester tries to confirm", async () => {
    const { a, b, group, expenseID } = await createUsersAndGroupWithExpense();

    mockGetServerSession.mockResolvedValue({
      user: { userId: a.userId },
      expires: "",
    });

    const postRes = await POSTPaymentRequests(
      new Request("http://localhost/api/x/payment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseID,
          targetMemberID: String(b.userId),
          amount: 5,
        }),
      }),
      { params: Promise.resolve({ groupId: String(group.groupID) }) },
    );
    const { paymentRequest } = await postRes.json();
    const requestID = paymentRequest.requestID as string;

    mockGetServerSession.mockResolvedValue({
      user: { userId: a.userId },
      expires: "",
    });

    const confirmRes = await POSTConfirmPayment(
      new Request("http://localhost/api/x/confirm", { method: "POST" }),
      {
        params: Promise.resolve({
          groupId: String(group.groupID),
          requestId: requestID,
        }),
      },
    );
    expect(confirmRes.status).toBe(403);
    const errBody = await confirmRes.json();
    expect(errBody.error).toBeTruthy();
  });

  it("returns 400 Payment already confirmed on duplicate confirm", async () => {
    const { a, b, group, expenseID } = await createUsersAndGroupWithExpense();

    mockGetServerSession.mockResolvedValue({
      user: { userId: a.userId },
      expires: "",
    });

    const postRes = await POSTPaymentRequests(
      new Request("http://localhost/api/x/payment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseID,
          targetMemberID: String(b.userId),
          amount: 5,
        }),
      }),
      { params: Promise.resolve({ groupId: String(group.groupID) }) },
    );
    const { paymentRequest } = await postRes.json();
    const requestID = paymentRequest.requestID as string;

    mockGetServerSession.mockResolvedValue({
      user: { userId: b.userId },
      expires: "",
    });

    const first = await POSTConfirmPayment(
      new Request("http://localhost/api/x/confirm", { method: "POST" }),
      {
        params: Promise.resolve({
          groupId: String(group.groupID),
          requestId: requestID,
        }),
      },
    );
    expect(first.status).toBe(200);

    const second = await POSTConfirmPayment(
      new Request("http://localhost/api/x/confirm", { method: "POST" }),
      {
        params: Promise.resolve({
          groupId: String(group.groupID),
          requestId: requestID,
        }),
      },
    );
    expect(second.status).toBe(400);
    const errBody = await second.json();
    expect(errBody.error).toBe("Payment already confirmed");
  });
});

describe("GET /api/notifications and PATCH .../read", () => {
  it("lists notifications with unreadCount and marks as read", async () => {
    const { a, b, group, expenseID } = await createUsersAndGroupWithExpense();

    mockGetServerSession.mockResolvedValue({
      user: { userId: a.userId },
      expires: "",
    });

    const postRes = await POSTPaymentRequests(
      new Request("http://localhost/api/x/payment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseID,
          targetMemberID: String(b.userId),
          amount: 4,
        }),
      }),
      { params: Promise.resolve({ groupId: String(group.groupID) }) },
    );
    const { paymentRequest } = await postRes.json();
    const requestID = paymentRequest.requestID as string;

    mockGetServerSession.mockResolvedValue({
      user: { userId: b.userId },
      expires: "",
    });

    await POSTConfirmPayment(
      new Request("http://localhost/api/x/confirm", { method: "POST" }),
      {
        params: Promise.resolve({
          groupId: String(group.groupID),
          requestId: requestID,
        }),
      },
    );

    mockGetServerSession.mockResolvedValue({
      user: { userId: a.userId },
      expires: "",
    });

    const listRes = await GETNotifications(
      new Request("http://localhost/api/notifications?page=1&limit=10"),
    );
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.unreadCount).toBeGreaterThanOrEqual(1);
    const n = listData.notifications.find(
      (x: { paymentRequestID: string }) => x.paymentRequestID === requestID,
    );
    expect(n).toBeTruthy();
    expect(n.read).toBe(false);

    const patchRes = await PATCHNotificationRead(
      new Request("http://localhost/api/x/read", { method: "PATCH" }),
      { params: Promise.resolve({ notificationId: n.notificationID }) },
    );
    expect(patchRes.status).toBe(200);

    const after = await GETNotifications(
      new Request("http://localhost/api/notifications?page=1&limit=10"),
    );
    const afterData = await after.json();
    const n2 = afterData.notifications.find(
      (x: { paymentRequestID: string }) => x.paymentRequestID === requestID,
    );
    expect(n2.read).toBe(true);
  });
});
