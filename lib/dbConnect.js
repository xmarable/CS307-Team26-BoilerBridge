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
  } else {
    MONGODB_URI = process.env.MONGODB_URI;

    if (!MONGODB_URI) {
      throw new Error(
        "Please define the MONGODB_URI environment variable inside .env.local",
      );
    }
  }

  if (!cached.promise) {
    console.log("🛠️  CONNECTING TO:", MONGODB_URI.split("@").pop());
    const opts = {
      bufferCommands: false,
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
