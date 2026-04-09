import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { syncGroupEvents } from "@/lib/calendarSync";

const SyncBodySchema = z.object({
  groupId: z.string().min(1),
});

export async function POST(
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

    const body = await req.json();
    const parsed = SyncBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "groupId is required" },
        { status: 400 },
      );
    }

    const result = await syncGroupEvents(id, userId, parsed.data.groupId);

    return NextResponse.json(
      {
        message: "Sync complete",
        synced: result.synced,
        skipped: result.skipped,
        errors: result.errors,
      },
      { status: 200 },
    );
  } catch (err: any) {
    const status =
      err.message?.includes("not found") ? 404
      : err.message?.includes("not enabled") ? 400
      : err.message?.includes("No calendar") ? 400
      : 500;

    console.error("POST sync error:", err);
    return NextResponse.json({ error: err.message ?? "Sync failed" }, { status });
  }
}
