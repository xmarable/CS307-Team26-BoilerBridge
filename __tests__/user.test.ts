/** @jest-environment node */

import { jest } from "@jest/globals";
import mongoose from "mongoose"; // import mongoose for db interaction

let User: any, dbConnect: any;

const CONNECTION_CLEANUP_DELAY_MS = 500; // time to wait for mongo to actually kill the connection

beforeAll(async () => {
  jest.resetModules();

  ({ default: dbConnect } = await import("../lib/dbConnect"));
  const UserMod = await import("../models/User");
  User = UserMod.default || UserMod;

  await dbConnect();

  await User.deleteMany({}); // clear the users collection before starting the tests to ensure a clean slate

  await User.syncIndexes();
});

afterAll(async () => {
  if (User && typeof User.deleteMany === "function") {
    await User.deleteMany({}); // IMPORTANT: wipe the user collection so we dont leak state between runs
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    await mongoose.connection.close(true); // close the connection after tests complete
  }

  if ((global as any).mongoose) {
    (global as any).mongoose.conn = null;
    (global as any).mongoose.promise = null;
  }

  jest.resetModules();
  jest.clearAllMocks();

  await new Promise((resolve) =>
    setTimeout(resolve, CONNECTION_CLEANUP_DELAY_MS),
  );
});

describe("User Model Test Suite", () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  it("should create and save a valid user successfully", async () => {
    const savedUser = await User.create({
      username: "xavy_test",
      email: "xmarab@purdue.edu",
      passwordHash: "hashed_password_123",
      school: "Purdue University",
    });

    expect(savedUser._id).toBeDefined(); // verify mongo generated an objectid
    expect(savedUser.email).toBe("xmarab@purdue.edu"); // double check the data stayed correct
  });

  it("should fail to save a user with a duplicate email", async () => {
    // use a unique email just for this specific test case
    const duplicateEmail = "duplicate_test@purdue.edu"; // constant for the email we are going to collide

    // save the first instance
    await User.create({
      // setup the first user that will own the email
      username: "original_user",
      email: duplicateEmail,
      passwordHash: "hash123",
    });

    let error: any = null; // local var to capture the thrown error
    try {
      await User.create({
        username: "xavy_duplicate",
        email: duplicateEmail,
        passwordHash: "hashed_password_456",
      });
    } catch (err) {
      error = err; // catch the error so we can inspect it
    }

    expect(error).not.toBeNull(); // make sure it actually failed
    expect(error.code).toBe(11000); // IMPORTANT: 11000 is the specific mongo code for duplicate key errors
  });

  it("should fail to save a user without a password", async () => {
    let error: any = null; // another var for error catching
    try {
      await User.create({
        username: "missing_password_user",
        email: "nopassword@purdue.edu",
      });
    } catch (err) {
      error = err; // grab the validation error
    }

    expect(error).toBeDefined();
    expect(error.name).toBe("ValidationError");
  });
});
