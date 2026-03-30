import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import z from "zod";
import sgMail from "@sendgrid/mail";


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
    const url = `http://localhost:3000/signin/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;
    console.log(`Password Reset Link: ${url}`);

    sgMail.setApiKey(process.env.SENDGRID_API_KEY ?? "");
    //console.log(process.env.SENDGRID_API_KEY);

    const msg = {
        to: user.email,
        from: 'boilerbridge307@gmail.com',
        subject: 'BoilerBridge Password Reset',
        text: url,
        html: `
            <p>Click the link below to reset your password:</p>
            <p><a href="${url}">Reset Password</a></p>
            <p>If you did not request this, you can ignore this email.</p>
        `,
    }

    sgMail.send(msg).then(() => {
        console.log("Email Sent")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }).catch((e: any) => {
        console.log(e);
    })

    return response;
}