import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import User from "@/models/User";
import VerificationCode from "@/models/VerificationCode";
import dbConnect from "@/lib/dbConnect";

export async function POST(req: NextRequest) {
  await dbConnect();
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action, email, code } = await req.json();

  if (action === "request") {
    if (!email || !email.endsWith(".edu")) {
      return NextResponse.json(
        { error: "Only .edu emails allowed" },
        { status: 400 },
      );
    }

    const verificationOtp = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    await VerificationCode.findOneAndUpdate(
      { userId: session.user.userId },
      { email, code: verificationOtp, createdAt: new Date() },
      { upsert: true, new: true },
    );

    // Replace with your actual mailer utility
    console.log(`Sending code ${verificationOtp} to ${email}`);

    return NextResponse.json({ message: "Code sent" });
  }

  if (action === "confirm") {
    const record = await VerificationCode.findOne({
      userId: session.user.userId,
      code,
    });

    if (!record) {
      return NextResponse.json(
        { error: "Invalid or expired code" },
        { status: 400 },
      );
    }

    const updatedUser = await User.findOneAndUpdate(
      { userId: session.user.userId },
      {
        $set: {
          "settings.security.isStudentVerified": true,
          eduEmail: record.email,
        },
      },
      { new: true },
    );

    await VerificationCode.deleteOne({ _id: record._id });

    return NextResponse.json({
      message: "Verified successfully",
      isStudentVerified: true,
      eduEmail: updatedUser.eduEmail,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
