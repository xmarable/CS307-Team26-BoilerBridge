// Import mongoose
import mongoose from "mongoose";

// Hardcode the URI to bypass environment variable errors
const MONGODB_URI = "mongodb+srv://xavy:oFWGjxWrDYiEN6xi@boilerbridge.nuolzqx.mongodb.net/BoilerBridge";

// Set up the global cache
let cached = global.mongoose;

// Check if the cache is empty
if (!cached) {
  // Create the empty cache object
  cached = global.mongoose = { conn: null, promise: null };
}

// Define the database connection function
async function dbConnect() {
  // Check if we are in the Jest testing environment
  if (process.env.NODE_ENV === "test") {
    // Check if there is a stale connection open
    if (mongoose.connection.readyState !== 0) {
      // Close the stale connection to fix the bad auth error
      await mongoose.disconnect();
    }
    
    // Open a brand new connection for the test
    const conn = await mongoose.connect(MONGODB_URI, {
      bufferCommands: false
    });
    
    // Return the new connection
    return conn;
  }
  else {
    // Check if we already have a connection for the app
    if (cached.conn) {
      // Return the existing connection
      return cached.conn;
    }

    // Check if a connection promise is missing
    if (!cached.promise) {
      // Start a new connection promise
      cached.promise = mongoose.connect(MONGODB_URI, {
        bufferCommands: false
      }).then((mongooseInstance) => {
        // Return the mongoose instance
        return mongooseInstance;
      });
    }
    
    // Wait for the connection to finish
    cached.conn = await cached.promise;
    
    // Return the connection
    return cached.conn;
  }
}

// Export the connection function
export default dbConnect;