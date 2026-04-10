import { jest } from "@jest/globals";
import mongoose from "mongoose";

let POST: any;
let User: any, dbConnect: any;

await jest.unstable_mockModule("next-auth", () => ({
  getServerSession: jest.fn(),
}));

await jest.unstable_mockModule("@/lib/auth", () => ({
  authOptions: {},
}));

beforeAll(async () => {
  jest.resetModules();

  ({ default: dbConnect } = await import("@/lib/dbConnect"));
  ({ default: User } = await import("@/models/User"));

  await dbConnect();
  await User.deleteMany({ email: { $regex: "reg_test_" } });

  const route = await import("@/app/api/auth/register/route");
  POST = route.POST;
});

afterAll(async () => {
  await User?.deleteMany({ email: { $regex: "reg_test_" } });
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if ((global as any).mongoose) {
    (global as any).mongoose.conn = null;
    (global as any).mongoose.promise = null;
  }
  jest.clearAllMocks();
});

function makeReq(body: object) {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validUser = () => ({
  username: "reg_test_user",
  email: "reg_test_user@example.com",
  password: "securepass123",
});

describe("POST /api/auth/register", () => {
  it("returns 400 when username is too short", async () => {
    const res = await POST(makeReq({ ...validUser(), username: "ab" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is under 8 characters", async () => {
    const res = await POST(makeReq({ ...validUser(), password: "short" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is malformed", async () => {
    const res = await POST(makeReq({ ...validUser(), email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("creates a new account and returns 201", async () => {
    const res = await POST(makeReq(validUser()));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.message).toBe("Account created");
  });

  it("returns 409 when the email is already taken", async () => {
    // user already exists from the previous test
    const res = await POST(
      makeReq({ ...validUser(), username: "reg_test_user2" }),
    );
    expect(res.status).toBe(409);
  });

  it("returns 409 when the username is already taken", async () => {
    const res = await POST(
      makeReq({ ...validUser(), email: "reg_test_other@example.com" }),
    );
    expect(res.status).toBe(409);
  });
});
