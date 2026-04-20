import mongoose from "mongoose";
import dotenv from "dotenv";

// ensure env vars are available in the teardown process
dotenv.config({ path: ".env.local" });

const teardown = async () => {
  try {
    const uri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI;

    if (!uri) {
      console.error("⚠️ teardown skipped: no connection string found");
      return;
    }

    // only connect if we don't have an active connection
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri);
    }

    if (mongoose.connection.db) {
      const dbName = mongoose.connection.db.databaseName;
      // we only drop if it looks like a test database to be safe
      if (dbName.includes("test") || dbName.includes("jest")) {
        await mongoose.connection.db.dropDatabase();
        console.log(`\n🗑️  cleaned up test db: ${dbName}`);
      }
    }

    await mongoose.connection.close();
    await mongoose.disconnect();
    console.log("👋 all db connections closed");
  } catch (err) {
    console.error("error during teardown:", err);
  }
};

export default teardown;
