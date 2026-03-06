// Import dotenv
import dotenv from "dotenv";

// Configure dotenv to point to your local variables
dotenv.config({ path: ".env.local" });

// Polyfill globals used by MongoDB driver and API route tests in Jest node environment
if (typeof global.performance === "undefined") {
  global.performance = performance;
}
if (typeof global.Request === "undefined" && typeof globalThis.Request !== "undefined") {
  global.Request = globalThis.Request;
}