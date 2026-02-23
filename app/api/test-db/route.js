import dbConnect from "@/lib/dbConnect";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Attempt to connect to MongoDB
    await dbConnect();

    return NextResponse.json(
      {
        status: "success",
        message: "BoilerBridge is successfully connected to MongoDB Atlas!",
      },
      { status: 200 },
    );
  } catch (error) {
    // If connection fails, return the error message
    return NextResponse.json(
      {
        status: "error",
        message: "Database connection failed",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
