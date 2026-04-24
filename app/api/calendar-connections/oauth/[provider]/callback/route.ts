import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { encrypt } from "@/lib/tokenEncryption";
import dbConnect from "@/lib/dbConnect";
import CalendarConnection from "@/models/CalendarConnection";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const OUTLOOK_TOKEN_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";

function getSecret() {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

async function exchangeGoogleCode(
  code: string,
  callbackUrl: string,
): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number; providerAccountId: string }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
      redirect_uri: callbackUrl,
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
  const data = await res.json();

  // Fetch the user's Google account ID
  const profileRes = await fetch(
    "https://www.googleapis.com/oauth2/v1/userinfo?alt=json",
    { headers: { Authorization: `Bearer ${data.access_token}` } },
  );
  const profile = profileRes.ok ? await profileRes.json() : {};

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in ?? 3600,
    providerAccountId: profile.id ?? "unknown",
  };
}

async function exchangeOutlookCode(
  code: string,
  callbackUrl: string,
): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number; providerAccountId: string }> {
  const res = await fetch(OUTLOOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.OUTLOOK_CLIENT_ID!,
      client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
      redirect_uri: callbackUrl,
      scope: "https://graph.microsoft.com/Calendars.ReadWrite offline_access openid profile",
    }),
  });
  if (!res.ok) throw new Error(`Outlook token exchange failed: ${res.status}`);
  const data = await res.json();

  const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const profile = profileRes.ok ? await profileRes.json() : {};

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in ?? 3600,
    providerAccountId: profile.id ?? "unknown",
  };
}

/**
 * GET /api/calendar-connections/oauth/[provider]/callback
 * Receives the OAuth authorization code, exchanges for tokens,
 * saves the encrypted connection, and redirects back to the UI.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const { provider } = await params;
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const callbackUrl = `${baseUrl}/api/calendar-connections/oauth/${provider}/callback`;

  // If the user denied access
  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/dashboard?calendarError=${encodeURIComponent(error)}`,
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/dashboard?calendarError=missing_code`,
    );
  }

  let userId: string;
  let returnUrl: string;

  try {
    const { payload } = await jwtVerify(state, getSecret());
    userId = payload.userId as string;
    returnUrl = (payload.returnUrl as string) ?? "/dashboard";
  } catch {
    return NextResponse.redirect(
      `${baseUrl}/dashboard?calendarError=invalid_state`,
    );
  }

  try {
    let tokens: {
      accessToken: string;
      refreshToken?: string;
      expiresIn: number;
      providerAccountId: string;
    };

    if (provider === "google") {
      tokens = await exchangeGoogleCode(code, callbackUrl);
    } else if (provider === "outlook") {
      tokens = await exchangeOutlookCode(code, callbackUrl);
    } else {
      return NextResponse.redirect(
        `${returnUrl}?calendarError=unsupported_provider`,
      );
    }

    await dbConnect();

    const tokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

    await CalendarConnection.findOneAndUpdate(
      { userId, provider },
      {
        userId,
        provider,
        providerAccountId: tokens.providerAccountId,
        encryptedAccessToken: encrypt(tokens.accessToken),
        encryptedRefreshToken: tokens.refreshToken
          ? encrypt(tokens.refreshToken)
          : undefined,
        tokenExpiresAt,
        $unset: { syncError: 1 },
      },
      { upsert: true, new: true },
    );

    return NextResponse.redirect(
      `${returnUrl}?calendarConnected=${provider}`,
    );
  } catch (err: any) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(
      `${returnUrl}?calendarError=${encodeURIComponent(err.message ?? "oauth_error")}`,
    );
  }
}
