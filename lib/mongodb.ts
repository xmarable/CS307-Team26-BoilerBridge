import { MongoClient, MongoClientOptions } from "mongodb";

/**
 * This raw MongoDB client is specifically for NextAuth adapter usage.
 * Features strict environment isolation without fallbacks.
 */

let MONGODB_URI: string;

if (process.env.NODE_ENV === "test") {
  if (!process.env.TEST_MONGODB_URI) {
    throw new Error(
      "🚨 FATAL: TEST_MONGODB_URI is undefined. Please define it in .env.local",
    );
  }
  if (process.env.TEST_MONGODB_URI === process.env.MONGODB_URI) {
    throw new Error(
      "🚨 FATAL: TEST_MONGODB_URI matches MONGODB_URI. You are about to wipe prod!",
    );
  }
  MONGODB_URI = process.env.TEST_MONGODB_URI;
} else {
  if (!process.env.MONGODB_URI) {
    throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
  }
  MONGODB_URI = process.env.MONGODB_URI;
}

const options: MongoClientOptions = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  const globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(MONGODB_URI, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  client = new MongoClient(MONGODB_URI, options);
  clientPromise = client.connect();
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise;
