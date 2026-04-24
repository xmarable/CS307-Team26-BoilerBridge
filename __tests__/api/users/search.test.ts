import { jest } from "@jest/globals";
import mongoose from "mongoose";

let GET: any;
let User: any, dbConnect: any, bcrypt: any;

await jest.unstable_mockModule("next-auth", () => ({
  getServerSession: jest.fn(),
}));

await jest.unstable_mockModule("@/lib/auth", () => ({
  authOptions: {},
}));

beforeAll(async () => {
  jest.resetModules();

  ({ default: bcrypt } = await import("bcryptjs"));
  ({ default: dbConnect } = await import("@/lib/dbConnect"));
  ({ default: User } = await import("@/models/User"));

  await dbConnect();
  await User.deleteMany({ email: { $regex: "srch_" } });

  const hash = await bcrypt.hash("pass", 10);

  await User.create([
    { username: "srch_alice", email: "srch_alice@example.com", passwordHash: hash, school: "Purdue" },
    { username: "srch_bob",   email: "srch_bob@example.com",   passwordHash: hash, school: "Purdue" },
    { username: "srch_carol", email: "srch_carol@example.com", passwordHash: hash, school: "Purdue" },
  ]);

  const route = await import("@/app/api/users/search/route");
  GET = route.GET;
});

afterAll(async () => {
  await User?.deleteMany({ email: { $regex: "srch_" } });
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if ((global as any).mongoose) {
    (global as any).mongoose.conn = null;
    (global as any).mongoose.promise = null;
  }
  jest.clearAllMocks();
});

function makeReq(qs: string) {
  return new Request(`http://localhost/api/users/search?${qs}`);
}

describe("GET /api/users/search", () => {
  it("returns an empty array when query is shorter than 3 characters", async () => {
    const res = await GET(makeReq("query=ab"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0);
  });

  it("returns an empty array when only an @ is provided", async () => {
    const res = await GET(makeReq("query=@"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBe(0);
  });

  it("finds users by partial username match", async () => {
    const res = await GET(makeReq("query=srch_ali"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((u: any) => u.username === "srch_alice")).toBe(true);
  });

  it("returns exact email match when query contains @", async () => {
    const res = await GET(makeReq("query=srch_bob@example.com"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBe(1);
    expect(data[0].username).toBe("srch_bob");
  });

  it("returns nothing for an email that does not exist", async () => {
    const res = await GET(makeReq("query=nobody@nowhere.com"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBe(0);
  });

  it("does not expose passwordHash in results", async () => {
    const res = await GET(makeReq("query=srch_carol"));
    const data = await res.json();
    data.forEach((u: any) => {
      expect(u.passwordHash).toBeUndefined();
    });
  });

  it("caps results at 10 users", async () => {
    const res = await GET(makeReq("query=srch_"));
    const data = await res.json();
    expect(data.length).toBeLessThanOrEqual(10);
  });
});
