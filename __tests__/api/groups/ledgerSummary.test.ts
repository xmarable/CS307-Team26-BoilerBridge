import { jest } from "@jest/globals";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

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

const mockGetServerSession = nextAuth.getServerSession as jest.MockedFunction<
  typeof nextAuth.getServerSession
>;

let GETLedgerSummary: (
  req: Request,
  ctx: { params: Promise<{ groupId: string }> },
) => Promise<Response>;

const CONNECTION_CLEANUP_DELAY_MS = 500;

beforeAll(async () => {
  await dbConnect();
  const route = await import(
    "@/app/api/groups/[groupId]/ledger/summary/route"
  );
  GETLedgerSummary = route.GET;
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await TravelGroup.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();
  }
  await new Promise((r) => setTimeout(r, CONNECTION_CLEANUP_DELAY_MS));
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/groups/[groupId]/ledger/summary", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GETLedgerSummary(
      new Request("http://localhost/api/x/ledger/summary"),
      { params: Promise.resolve({ groupId: "00000000-0000-4000-8000-000000000001" }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-member", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const member = await User.create({
      username: "led_mem",
      email: "led_mem@test.com",
      passwordHash,
      school: "Purdue",
    });
    const outsider = await User.create({
      username: "led_out",
      email: "led_out@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "Ledger G1",
      leaderID: member.userId,
      membersList: [{ userId: member.userId, role: "Leader" }],
      ledger: [],
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId: outsider.userId },
      expires: "",
    });

    const res = await GETLedgerSummary(
      new Request("http://localhost/api/x/ledger/summary"),
      { params: Promise.resolve({ groupId: String(group.groupID) }) },
    );
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/access denied|do not have access/i);
  });

  it("returns hasNoExpenses when ledger empty", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const member = await User.create({
      username: "led_empty",
      email: "led_empty@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "Ledger Empty",
      leaderID: member.userId,
      membersList: [{ userId: member.userId, role: "Leader" }],
      ledger: [],
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId: member.userId },
      expires: "",
    });

    const res = await GETLedgerSummary(
      new Request("http://localhost/api/x/ledger/summary"),
      { params: Promise.resolve({ groupId: String(group.groupID) }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.meta.hasNoExpenses).toBe(true);
    expect(data.expenseCounts.total).toBe(0);
  });

  it("returns allExpensesSettled when all expenses settled for active filter", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const a = await User.create({
      username: "led_sa",
      email: "led_sa@test.com",
      passwordHash,
      school: "Purdue",
    });
    const b = await User.create({
      username: "led_sb",
      email: "led_sb@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "Ledger Settled",
      leaderID: a.userId,
      membersList: [
        { userId: a.userId, role: "Leader" },
        { userId: b.userId, role: "Viewer" },
      ],
      ledger: [
        {
          payerID: a.userId,
          amount: 20,
          description: "past",
          debtors: new Map([[String(b.userId), 20]]),
          isSettled: true,
        },
      ],
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId: a.userId },
      expires: "",
    });

    const res = await GETLedgerSummary(
      new Request(
        "http://localhost/api/x/ledger/summary?expenseFilter=active",
      ),
      { params: Promise.resolve({ groupId: String(group.groupID) }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.meta.hasNoExpenses).toBe(false);
    expect(data.meta.allExpensesSettled).toBe(true);
    expect(data.settlements).toHaveLength(0);
  });

  it("computes balances and settlements for unsettled expenses", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const a = await User.create({
      username: "led_ca",
      email: "led_ca@test.com",
      passwordHash,
      school: "Purdue",
    });
    const b = await User.create({
      username: "led_cb",
      email: "led_cb@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "Ledger Active",
      leaderID: a.userId,
      membersList: [
        { userId: a.userId, role: "Leader" },
        { userId: b.userId, role: "Viewer" },
      ],
      ledger: [
        {
          payerID: a.userId,
          amount: 50,
          description: "gas",
          debtors: new Map([[String(b.userId), 50]]),
          isSettled: false,
        },
      ],
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId: a.userId },
      expires: "",
    });

    const res = await GETLedgerSummary(
      new Request("http://localhost/api/x/ledger/summary"),
      { params: Promise.resolve({ groupId: String(group.groupID) }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.meta.hasNoExpenses).toBe(false);
    expect(data.meta.allExpensesSettled).toBe(false);
    expect(data.settlements).toHaveLength(1);
    expect(data.settlements[0].fromUserId).toBe(String(b.userId));
    expect(data.settlements[0].toUserId).toBe(String(a.userId));
    expect(data.settlements[0].amount).toBe(50);
  });

  it("returns per-member net balances and min-cash-flow settlements for multiple unsettled expenses (AC1)", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    const a = await User.create({
      username: "led_ac1a",
      email: "led_ac1a@test.com",
      passwordHash,
      school: "Purdue",
    });
    const b = await User.create({
      username: "led_ac1b",
      email: "led_ac1b@test.com",
      passwordHash,
      school: "Purdue",
    });
    const c = await User.create({
      username: "led_ac1c",
      email: "led_ac1c@test.com",
      passwordHash,
      school: "Purdue",
    });
    const group = await TravelGroup.create({
      groupName: "Ledger AC1",
      leaderID: a.userId,
      membersList: [
        { userId: a.userId, role: "Leader" },
        { userId: b.userId, role: "Viewer" },
        { userId: c.userId, role: "Viewer" },
      ],
      ledger: [
        {
          payerID: a.userId,
          amount: 90,
          description: "hotel",
          debtors: new Map([
            [String(b.userId), 30],
            [String(c.userId), 30],
          ]),
          isSettled: false,
        },
        {
          payerID: b.userId,
          amount: 30,
          description: "taxi",
          debtors: new Map([[String(c.userId), 15]]),
          isSettled: false,
        },
      ],
    });

    mockGetServerSession.mockResolvedValue({
      user: { userId: a.userId },
      expires: "",
    });

    const res = await GETLedgerSummary(
      new Request("http://localhost/api/x/ledger/summary"),
      { params: Promise.resolve({ groupId: String(group.groupID) }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    const byId = Object.fromEntries(
      data.balances.map((row: { userId: string; netAmount: number }) => [
        row.userId,
        row.netAmount,
      ]),
    );
    expect(byId[String(a.userId)]).toBe(60);
    expect(byId[String(b.userId)]).toBe(-15);
    expect(byId[String(c.userId)]).toBe(-45);

    expect(data.settlements.length).toBeGreaterThanOrEqual(1);
    expect(data.settlements.length).toBeLessThanOrEqual(2);

    // Min-cash-flow settles *net* balances; total paid equals net credit (60), not gross splits (75).
    const totalSettled = data.settlements.reduce(
      (s: number, x: { amount: number }) => s + x.amount,
      0,
    );
    expect(totalSettled).toBe(60);
  });
});
