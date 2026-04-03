/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import User from "@/models/User";
import VerificationCode from "@/models/VerificationCode";
import dbConnect from "@/lib/dbConnect";
import sgMail from "@sendgrid/mail";

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
      { userId: (session.user as any).userId },
      { email, code: verificationOtp, createdAt: new Date() },
      { upsert: true, new: true },
    );

    sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);

    const msg = {
      to: email,
      from: "boilerbridge307@gmail.com",
      subject: "BoilerBridge Student Verification",
      text: `Your verification code is: ${verificationOtp}`,
      html: `
            <div style="font-family: sans-serif; line-height: 1.5;">
              <p>Please use the following code to verify your student status:</p>
              <h2 style="color: #f59e0b;">${verificationOtp}</h2>
              <p>If you did not request this verification, please disregard this email.</p>
            </div>
        `,
    };

    try {
      await sgMail.send(msg);
    } catch (e) {
      console.error("SendGrid Error:", e);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 },
      );
    }

    return NextResponse.json({ message: "Code sent" });
  }

  if (action === "confirm") {
    const record = await VerificationCode.findOne({
      userId: (session.user as any).userId,
      code,
    });

    if (!record) {
      return NextResponse.json(
        { error: "Invalid or expired code" },
        { status: 400 },
      );
    }

    const updatedUser = await User.findOneAndUpdate(
      { userId: (session.user as any).userId },
      {
        $set: {
          "settings.security.isStudentVerified": true,
          eduEmail: record.email,
        },
      },
      { new: true },
    );

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await VerificationCode.deleteOne({ _id: record._id });

    return NextResponse.json({
      message: "Verified successfully",
      isStudentVerified: true,
      eduEmail: updatedUser.eduEmail,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
