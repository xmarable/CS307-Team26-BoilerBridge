// Import dotenv
import dotenv from "dotenv";

// Configure dotenv to point to your local variables
dotenv.config({ path: ".env.local" });

// Ensure test DB URI is set so tests that use dbConnect can run (e.g. groups API tests)
if (process.env.NODE_ENV === "test") {
  process.env.TEST_MONGODB_URI =
    process.env.TEST_MONGODB_URI ||
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/boilerbridge-test";
}

// Polyfill globals used by MongoDB driver and API route tests in Jest node environment
if (typeof global.performance === "undefined") {
  global.performance = performance;
}
if (typeof global.Request === "undefined" && typeof globalThis.Request !== "undefined") {
  global.Request = globalThis.Request;
}