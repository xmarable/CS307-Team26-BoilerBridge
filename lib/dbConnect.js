import mongoose from "mongoose";

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections from growing exponentially
 * during API Route usage.
 */

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  let MONGODB_URI;

  if (process.env.NODE_ENV === "test") {
    MONGODB_URI = process.env.TEST_MONGODB_URI;

    // strict test guards - no fallbacks allowed
    if (!MONGODB_URI) {
      throw new Error(
        "🚨 FATAL: TEST_MONGODB_URI is undefined. Please define it in .env.local",
      );
    }
    if (MONGODB_URI === process.env.MONGODB_URI) {
      throw new Error(
        "🚨 FATAL: TEST_MONGODB_URI matches MONGODB_URI. You are about to wipe prod!",
      );
    }

    // isolatation logic for parallel testing
    // appends worker id to db name to prevent collision
    const workerId = process.env.JEST_WORKER_ID || "1";
    const url = new URL(MONGODB_URI);

    // if the path is empty or just '/', default to boilerbridge_test
    const baseDbName =
      url.pathname && url.pathname !== "/"
        ? url.pathname.slice(1)
        : "boilerbridge_test";

    url.pathname = `/${baseDbName}_${workerId}`;
    MONGODB_URI = url.toString();

    // print the db name for visibility in test logs
    console.log(`🧪 testing with db: ${baseDbName}_${workerId}`);
  } else {
    MONGODB_URI = process.env.MONGODB_URI;

    if (!MONGODB_URI) {
      throw new Error(
        "Please define the MONGODB_URI environment variable inside .env.local",
      );
    }
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: true,
      serverSelectionTimeoutMS: 10000,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
