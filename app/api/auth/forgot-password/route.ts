import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import z from "zod";


const ForgotPassSchema = z.object({
    email: z.string().email()
})

export async function POST(req: NextRequest) {
    const body = await req.json();
    const email = ForgotPassSchema.safeParse(body);

    const response = NextResponse.json(
        { message: "If an account exists for that email, a reset link has been sent." },
        { status: 200 }
    )

    if (!email.success) {
        return response;
    }

    await dbConnect();

    const user = await User.findOne({ email: email.data.email });
    if (!user) {
        return response;
    }

    // Generate random token and it's hash for reset link
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30) // 30 Minutes

    user.passwordReset = {
        tokenHash: tokenHash,
        expiresAt: expiresAt,
    }

    await user.save();
    const url = `https://localhost:3000/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;
    console.log(`Password Reset Link: ${url}`);
    return response;
}