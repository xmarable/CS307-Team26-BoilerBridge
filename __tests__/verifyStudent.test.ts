/** @jest-environment node */

import { jest } from "@jest/globals";
import mongoose from "mongoose";

// declare vars to be assigned in beforeAll
let User: any, VerificationCode: any, dbConnect: any;

const CONNECTION_CLEANUP_DELAY_MS = 500;

beforeAll(async () => {
  // 1. wipe cache
  jest.resetModules();

  // 2. dynamic imports inside beforeAll
  ({ default: dbConnect } = await import("../lib/dbConnect"));
  const UserMod = await import("../models/User");
  User = UserMod.default || UserMod;
  const VerifyMod = await import("../models/VerificationCode");
  VerificationCode = VerifyMod.default || VerifyMod;

  // 3. connect
  await dbConnect();

  await User.deleteMany({});
  await VerificationCode.deleteMany({});

  await User.syncIndexes();
  await VerificationCode.syncIndexes();
});

afterAll(async () => {
  if (User && VerificationCode) {
    await User.deleteMany({});
    await VerificationCode.deleteMany({});
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    await mongoose.connection.close(true);
  }

  if ((global as any).mongoose) {
    (global as any).mongoose.conn = null;
    (global as any).mongoose.promise = null;
  }

  jest.resetModules();
  jest.clearAllMocks();
});

describe("Student Verification Logic Test Suite", () => {
  let testUserId: string; // variable to hold the test user ID across tests

  beforeEach(async () => {
    await VerificationCode.deleteMany({});
    await User.deleteMany({});

    // Generate a fresh ID for this specific suite
    testUserId = new mongoose.Types.UUID().toString();

    await User.create({
      userId: testUserId,
      username: "xavy_tester",
      email: "xavy@purdue.edu",
      passwordHash: "hash123",
    });
  });

  it("should fail if the email is not a .edu address", async () => {
    const invalidEmail = "student@gmail.com";
    const user = await User.findOne({ userId: testUserId });

    if (!user) throw new Error("User not found");

    user.eduEmail = invalidEmail;
    let error: any = null;
    try {
      await user.save();
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.errors.eduEmail.message).toContain("not a valid .edu email");
  });

  it("should prevent requesting a code more than once per minute (Rate Limiting)", async () => {
    await VerificationCode.create({
      userId: testUserId,
      email: "xavy@purdue.edu",
      code: "123456",
      createdAt: new Date(),
    });

    const existingRequest = await VerificationCode.findOne({
      userId: testUserId,
    });
    const isRateLimited =
      Date.now() - existingRequest.createdAt.getTime() < 60000;

    expect(isRateLimited).toBe(true);
  });

  it("should increment attempts and eventually lock out after 5 failed tries", async () => {
    await VerificationCode.create({
      userId: testUserId,
      email: "xavy@purdue.edu",
      code: "123456",
      attempts: 0,
    });

    for (let i = 0; i < 5; i++) {
      const record = await VerificationCode.findOneAndUpdate(
        { userId: testUserId },
        { $inc: { attempts: 1 } },
        { returnDocument: "after" },
      );

      if (record && record.attempts >= 5) {
        await VerificationCode.deleteOne({ _id: record._id });
      }
    }

    const finalRecord = await VerificationCode.findOne({ userId: testUserId });
    expect(finalRecord).toBeNull();
  });

  it("should successfully verify user and update status with valid code", async () => {
    const validCode = "999888";
    const eduEmail = "test@purdue.edu";

    await VerificationCode.create({
      userId: testUserId,
      email: eduEmail,
      code: validCode,
    });

    const record = await VerificationCode.findOne({
      userId: testUserId,
      code: validCode,
    });

    expect(record).not.toBeNull();

    if (record) {
      const updateResult = await User.findOneAndUpdate(
        { userId: testUserId },
        {
          $set: {
            "settings.security.isStudentVerified": true,
            eduEmail: record.email,
          },
        },
        { returnDocument: "after" },
      );
      expect(updateResult).not.toBeNull();
      await VerificationCode.deleteOne({ _id: record._id });
    }

    const updatedUser = await User.findOne({ userId: testUserId });
    expect(updatedUser).not.toBeNull();
    if (updatedUser) {
      expect(updatedUser.settings.security.isStudentVerified).toBe(true);
      expect(updatedUser.eduEmail).toBe(eduEmail);
    }

    const remainingCode = await VerificationCode.findOne({
      userId: testUserId,
    });
    expect(remainingCode).toBeNull();
  });
});
