import dotenv from "dotenv";

// configure dotenv to point to your local variables
dotenv.config({ path: ".env.local" });

// ensure test db uri is set so tests that use dbconnect can run
if (process.env.NODE_ENV === "test") {
  process.env.TEST_MONGODB_URI =
    process.env.TEST_MONGODB_URI ||
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/boilerbridge-test";
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
