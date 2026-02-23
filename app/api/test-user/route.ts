import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Email query param required" }, { status: 400 });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return NextResponse.json({ message: "User not found in database" }, { status: 404 });
    }

    // Return the user (but don't send the passwordHash in a real production app!)
    return NextResponse.json({
      exists: true,
      user: {
        id: user.userId,
        username: user.username,
        email: user.email,
        school: user.school
      }
    });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_err) {
    return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
  }
}