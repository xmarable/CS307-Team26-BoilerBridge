import dotenv from "dotenv";

export default async () => {
  dotenv.config({ path: ".env.local" });
  // This confirms to the terminal that the vars are ready before tests start
  if (process.env.MONGODB_URI) {
    console.log("✅ Jest Global Setup: MONGODB_URI loaded successfully.");
  } else {
    console.warn("⚠️  Jest Global Setup: MONGODB_URI not found in .env.local");
  }
};