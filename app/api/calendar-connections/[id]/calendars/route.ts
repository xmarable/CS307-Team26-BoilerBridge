import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getValidAccessToken } from "@/lib/calendarSync";
import { getProvider } from "@/lib/calendarProviders/index";
import dbConnect from "@/lib/dbConnect";
import CalendarConnection from "@/models/CalendarConnection";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await dbConnect();

    const connection = await CalendarConnection.findById(id);
    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }
    if (connection.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(connection);
    } catch (err: any) {
      await CalendarConnection.findByIdAndUpdate(id, { syncError: err.message });
      return NextResponse.json(
        { error: `Token error: ${err.message}` },
        { status: 401 },
      );
    }

    const provider = getProvider(connection.provider);
    const calendars = await provider.listCalendars(accessToken);

    return NextResponse.json({ calendars }, { status: 200 });
  } catch (err: any) {
    console.error("GET calendars error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
