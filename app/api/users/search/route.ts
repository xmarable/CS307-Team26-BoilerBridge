import { NextResponse } from "next/server";
import User from "@/models/User";
import dbConnect from "@/lib/dbConnect";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const searchTerm = (
      searchParams.get("query") ||
      searchParams.get("email") ||
      ""
    ).trim();

    if (!searchTerm || searchTerm.length < 3) {
      return NextResponse.json([]);
    }

    // 1. If it starts with @ or is just a domain, block it
    if (
      searchTerm.startsWith("@") ||
      searchTerm.toLowerCase().endsWith("purdue.edu")
    ) {
      // Only allow it if there's a significant prefix before the @
      if (!searchTerm.includes("@") || searchTerm.indexOf("@") < 2) {
        return NextResponse.json([]);
      }
    }

    // 2. Refined Query Logic
    let query;
    if (searchTerm.includes("@")) {
      // If there is an @, look for an EXACT email match only
      // This prevents "@purdue" from returning every user
      query = { email: searchTerm.toLowerCase() };
    } else {
      // If no @, use the fuzzy search for username or the start of an email
      query = {
        $or: [
          { username: { $regex: searchTerm, $options: "i" } },
          { email: { $regex: `^${searchTerm}`, $options: "i" } }, // ^ ensures it matches the START of the email
        ],
      };
    }

    const users = await User.find(query)
      .select("username email userId school")
      .limit(10)
      .lean();

    return NextResponse.json(users);
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
