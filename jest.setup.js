import dotenv from "dotenv";

if (typeof globalThis.structuredClone !== "function") {
  globalThis.structuredClone = (v) => JSON.parse(JSON.stringify(v));
}

// configure dotenv to point to your local variables
dotenv.config({ path: ".env.local" });

// ensure test db uri is set so tests that use dbconnect can run
if (process.env.NODE_ENV === "test") {
  if (!process.env.TEST_MONGODB_URI) {
    process.env.TEST_MONGODB_URI =
      process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/boilerbridge-test";
  }
  // lib/dbConnect refuses TEST_MONGODB_URI === MONGODB_URI so test cleanup cannot wipe prod.
  // If only MONGODB_URI is set (common in .env.local), point tests at a separate local DB name.
  if (
    process.env.MONGODB_URI &&
    process.env.TEST_MONGODB_URI === process.env.MONGODB_URI
  ) {
    process.env.TEST_MONGODB_URI =
      "mongodb://127.0.0.1:27017/boilerbridge-jest-isolated";
  }
}

// polyfill globals used by next.js and api routes in jest node environment
if (typeof global.performance === "undefined") {
  global.performance = performance;
}
if (
  typeof global.Request === "undefined" &&
  typeof globalThis.Request !== "undefined"
) {
  global.Request = globalThis.Request;
}
if (
  typeof global.Response === "undefined" &&
  typeof globalThis.Response !== "undefined"
) {
  global.Response = globalThis.Response;
}
if (
  typeof global.Headers === "undefined" &&
  typeof globalThis.Headers !== "undefined"
) {
  global.Headers = globalThis.Headers;
}
