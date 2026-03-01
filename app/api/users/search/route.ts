import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";

export async function GET(req: Request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // finds users, excludes sensitive fields, and limits to 10 for performance
    const users = await User.find({
      email: { $regex: email, $options: "i" },
    })
      .select("userId username email school")
      .limit(10);

    return NextResponse.json(users, { status: 200 });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error: any) {
    console.error("Error message: ", error.message);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
