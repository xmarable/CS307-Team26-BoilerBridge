import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import z from "zod";
import sgMail from "@sendgrid/mail";

const ForgotPassSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = ForgotPassSchema.safeParse(body);

  const response = NextResponse.json(
    {
      message:
        "If an account exists for that email, a reset link has been sent.",
    },
    { status: 200 },
  );

  if (!email.success) {
    return response;
  }

  await dbConnect();

  const user = await User.findOne({ email: email.data.email });
  if (!user) {
    return response;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 Minutes

  user.passwordReset = {
    tokenHash: tokenHash,
    expiresAt: expiresAt,
  };

  await user.save();

  // use an env var for the base url so it works in digitalocean too
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const url = `${baseUrl}/signin/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;

  sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);

  const msg = {
    to: user.email,
    from: "boilerbridge307@gmail.com",
    subject: "BoilerBridge Password Reset",
    text: `Reset ur password here: ${url}`,
    html: `
            <p>click the link below to reset ur password:</p>
            <p><a href="${url}">reset password</a></p>
            <p>if u didn't request this u can just ignore it lol</p>
        `,
  };

  try {
    await sgMail.send(msg);
    console.log("Email Sent");
  } catch (error) {
    console.error("SendGrid Error:", error);
    // we still return 200 to avoid leaking if an email exists
  }

  return response;
}
