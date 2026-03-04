/** @jest-environment node */
import { jest } from "@jest/globals";
import mongoose from "mongoose"; // import mongoose for db interaction
import dbConnect from "../lib/dbConnect"; // utility to connect to our mongo instance
import UserImport from "../models/User"; // grab the user model for testing

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const User = (UserImport as any).default || UserImport; // IMPORTANT: handle potential cjs/esm default export mismatch

const CONNECTION_CLEANUP_DELAY_MS = 500; // time to wait for mongo to actually kill the connection

beforeAll(async () => {
  await dbConnect(); // make sure we are connected before any tests run
  await User.syncIndexes(); // ensure indexes are in place before testing unique constraints
});

afterAll(async () => {
  if (User !== null && typeof User.deleteMany === "function") {
    await User.deleteMany({}); // IMPORTANT: wipe the user collection so we dont leak state between runs
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close(true); // close the connection after tests complete
  }
  await mongoose.disconnect(); // ensure mongoose fully disconnects

  if ((global as any).mongoose) {
    (global as any).mongoose.conn = null;
    (global as any).mongoose.promise = null;
  }
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, CONNECTION_CLEANUP_DELAY_MS); // buffer to let the driver finish cleanup
    timer.unref();
  }); // buffer to let the driver finish cleanup

  jest.resetModules();
});

describe("User Model Test Suite", () => {
  it("should create and save a valid user successfully", async () => {
    const validUser = new User({
      // create a new instance with all required fields
      username: "xavy_test",
      email: "xmarab@purdue.edu",
      passwordHash: "hashed_password_123",
      school: "Purdue University",
    });

    const savedUser = await validUser.save(); // push it to the database
    expect(savedUser._id).toBeDefined(); // verify mongo generated an objectid
    expect(savedUser.email).toBe("xmarab@purdue.edu"); // double check the data stayed correct
  });

  it("should fail to save a user with a duplicate email", async () => {
    // use a unique email just for this specific test case
    const duplicateEmail = "duplicate_test@purdue.edu"; // constant for the email we are going to collide

    // save the first instance
    await new User({
      // setup the first user that will own the email
      username: "original_user",
      email: duplicateEmail,
      passwordHash: "hash123",
    }).save();

    // attempt to save the second instance
    const duplicateUser = new User({
      // create a second user with that same email
      username: "xavy_duplicate",
      email: duplicateEmail,
      passwordHash: "hashed_password_456",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let error: any = null; // local var to capture the thrown error
    try {
      await duplicateUser.save(); // IMPORTANT: this should explode because of the unique index
    } catch (err) {
      error = err; // catch the error so we can inspect it
    }

    expect(error).toBeDefined(); // make sure it actually failed
    expect(error.code).toBe(11000); // IMPORTANT: 11000 is the specific mongo code for duplicate key errors
  });

  it("should fail to save a user without a password", async () => {
    const invalidUser = new User({
      // create a user but leave out the required passwordhash
      username: "missing_password_user",
      email: "nopassword@purdue.edu",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let error: any = null; // another var for error catching
    try {
      await invalidUser.save(); // this should trigger mongoose validation
    } catch (err) {
      error = err; // grab the validation error
    }

    expect(error).toBeDefined(); // confirm save failed
    if (error !== null) {
      expect(error.name).toBe("ValidationError"); // IMPORTANT: verify it failed for schema reasons not connection reasons
    }
  });
});
