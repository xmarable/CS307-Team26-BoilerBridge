import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SUPPORTED_PROVIDERS } from "@/lib/calendarProviders/index";
import { SignJWT } from "jose";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const OUTLOOK_AUTH_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";

function getSecret() {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

/**
 * GET /api/calendar-connections/oauth/[provider]
 * Redirects the authenticated user to the OAuth consent screen.
 * Accepts optional ?returnUrl= query param to redirect back after auth.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { provider } = await params;

    if (!SUPPORTED_PROVIDERS.includes(provider as any)) {
      return NextResponse.json(
        { error: `Unsupported provider: ${provider}` },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(req.url);
    const returnUrl = searchParams.get("returnUrl") ?? "/dashboard";

    // Sign a short-lived state JWT to prevent CSRF and carry returnUrl
    const state = await new SignJWT({ userId, returnUrl })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("10m")
      .sign(getSecret());

    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const callbackUrl = `${baseUrl}/api/calendar-connections/oauth/${provider}/callback`;

    let authUrl: URL;

    if (provider === "google") {
      const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
      if (!clientId) {
        return NextResponse.json(
          { error: "Google Calendar is not configured on this server" },
          { status: 503 },
        );
      }
      authUrl = new URL(GOOGLE_AUTH_URL);
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", callbackUrl);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/calendar");
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", state);
    } else {
      // outlook
      const clientId = process.env.OUTLOOK_CLIENT_ID;
      if (!clientId) {
        return NextResponse.json(
          { error: "Outlook Calendar is not configured on this server" },
          { status: 503 },
        );
      }
      authUrl = new URL(OUTLOOK_AUTH_URL);
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", callbackUrl);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set(
        "scope",
        "https://graph.microsoft.com/Calendars.ReadWrite offline_access openid profile",
      );
      authUrl.searchParams.set("state", state);
    }

    return NextResponse.redirect(authUrl.toString());
  } catch (err: any) {
    console.error("OAuth initiate error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
