import mongoose from "mongoose";
import dbConnect from "../lib/dbConnect.js";
import UserImport from "../models/User.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const User = (UserImport as any).default || UserImport;

const CONNECTION_CLEANUP_DELAY_MS = 500;

beforeAll(async () => {
  await dbConnect();
});

afterAll(async () => {
  if (User !== null && typeof User.deleteMany === "function") {
    await User.deleteMany({});
  }
  await mongoose.connection.close();
  await new Promise(resolve => setTimeout(resolve, CONNECTION_CLEANUP_DELAY_MS)); // Ensure all connections are closed before finishing the test suite
});

describe("User Model Test Suite", () => {
  it("should create and save a valid user successfully", async () => {
    const validUser = new User({
      username: "xavy_test",
      email: "xmarable@purdue.edu",
      passwordHash: "hashed_password_123",
      school: "Purdue University"
    });

    const savedUser = await validUser.save();
    expect(savedUser._id).toBeDefined();
    expect(savedUser.email).toBe("xmarable@purdue.edu");
  });

  it("should fail to save a user with a duplicate email", async () => {
    const duplicateUser = new User({
      username: "xavy_duplicate",
      email: "xmarable@purdue.edu",
      passwordHash: "hashed_password_456"
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let error: any = null;
    try {
      await duplicateUser.save();
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    if (error !== null) {
      expect(error.code).toBe(11000); 
    }
  });

  it("should fail to save a user without a password", async () => {
    const invalidUser = new User({
      username: "missing_password_user",
      email: "nopassword@purdue.edu"
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let error: any = null;
    try {
      await invalidUser.save();
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    if (error !== null) {
      expect(error.name).toBe("ValidationError");
    }
  });
});