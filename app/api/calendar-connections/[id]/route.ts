import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import CalendarConnection from "@/models/CalendarConnection";
import CalendarEventSync from "@/models/CalendarEventSync";

const UpdateConnectionSchema = z.object({
  syncEnabled: z.boolean().optional(),
  calendarId: z.string().optional(),
  calendarName: z.string().optional(),
});

export async function PUT(
  req: NextRequest,
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

    const body = await req.json();
    const parsed = UpdateConnectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { syncEnabled, calendarId, calendarName } = parsed.data;
    if (syncEnabled !== undefined) connection.syncEnabled = syncEnabled;
    if (calendarId !== undefined) connection.calendarId = calendarId;
    if (calendarName !== undefined) connection.calendarName = calendarName;

    await connection.save();

    const safe = connection.toObject();
    delete (safe as any).encryptedAccessToken;
    delete (safe as any).encryptedRefreshToken;

    return NextResponse.json({ connection: safe }, { status: 200 });
  } catch (err: any) {
    console.error("PUT calendar-connections/:id error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
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

    // Delete all sync mappings for this connection
    await CalendarEventSync.deleteMany({ connectionId: id });

    await CalendarConnection.findByIdAndDelete(id);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("DELETE calendar-connections/:id error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
