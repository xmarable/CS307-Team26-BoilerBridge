import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import { encrypt } from "@/lib/tokenEncryption";
import { SUPPORTED_PROVIDERS } from "@/lib/calendarProviders/index";
import CalendarConnection from "@/models/CalendarConnection";

const CreateConnectionSchema = z.object({
  provider: z.enum(["google", "outlook"]),
  providerAccountId: z.string().min(1),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  expiresIn: z.number().int().positive(),
  calendarId: z.string().optional(),
  calendarName: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const connections = await CalendarConnection.find({ userId })
      .select("-encryptedAccessToken -encryptedRefreshToken")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ connections }, { status: 200 });
  } catch (err: any) {
    console.error("GET calendar-connections error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const body = await req.json();
    const parsed = CreateConnectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { provider, providerAccountId, accessToken, refreshToken, expiresIn, calendarId, calendarName } = parsed.data;

    if (!SUPPORTED_PROVIDERS.includes(provider as any)) {
      return NextResponse.json(
        { error: `Unsupported provider: ${provider}` },
        { status: 400 },
      );
    }

    // Prevent duplicate connection per user+provider
    const existing = await CalendarConnection.findOne({ userId, provider });
    if (existing) {
      return NextResponse.json(
        { error: `A ${provider} calendar is already linked. Unlink it first.` },
        { status: 409 },
      );
    }

    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    const connection = await CalendarConnection.create({
      userId,
      provider,
      providerAccountId,
      encryptedAccessToken: encrypt(accessToken),
      encryptedRefreshToken: refreshToken ? encrypt(refreshToken) : undefined,
      tokenExpiresAt,
      calendarId,
      calendarName,
      syncEnabled: false,
    });

    const safe = connection.toObject();
    delete (safe as any).encryptedAccessToken;
    delete (safe as any).encryptedRefreshToken;

    return NextResponse.json({ connection: safe }, { status: 201 });
  } catch (err: any) {
    console.error("POST calendar-connections error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
