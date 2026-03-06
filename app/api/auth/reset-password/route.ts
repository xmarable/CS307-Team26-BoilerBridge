import dbConnect from "@/lib/dbConnect";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs"
import { z } from "zod";
import User from "@/models/User";

const ResetPassSchema = z.object({
    email: z.string().trim().toLowerCase(),
    token: z.string().min(1),
    newPassword: z.string().min(8).max(64)
})

export async function POST(req: NextRequest) {
    const body = await req.json();
    const info = ResetPassSchema.safeParse(body);

    if (!info.success) {
        return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const { email, token, newPassword } = info.data;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    await dbConnect();

    const user = await User.findOne({ email: email, "passwordReset.tokenHash": tokenHash, "passwordReset.expiresAt": { $gt: new Date() } });
    if (!user) {
        return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 })
    }
    
    const passwordHash = await bcrypt.hash(newPassword, 10);

    user.passwordHash = passwordHash;

    if (!user.settings) {
        user.settings = {} as any;
    }

    if (!user.setttings?.security) {
        user.settings.security = {} as any;
    }

    user.settings.security.passwordLastChanged = new Date();
    user.passwordReset = {
        tokenHash: null,
        expiresAt: null,
        requestedAt: null
    }

    await user.save();

    return NextResponse.json({ success: true }, { status: 200 });
}