import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import { getMemberPermissions } from "@/lib/roles";
import CalendarEvent from "@/models/CalendarEvent";

import { Types } from "mongoose";

const ReorderSchema = z.object({
  orders: z
    .array(
      z.object({
        eventId: z.string().min(1),
        displayOrder: z.number().int().min(0),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
      }),
    )
    .min(1),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (session?.user as any)?.userId as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId } = await params;

    await dbConnect();

    const perms = await getMemberPermissions(groupId, userId);
    if ("error" in perms) {
      return NextResponse.json(
        { error: perms.error },
        { status: perms.status },
      );
    }
    if (!perms.canEdit) {
      return NextResponse.json(
        { error: "Viewers cannot reorder activities." },
        { status: 403 },
      );
    }

    const body = await req.json();
    const parsed = ReorderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { orders } = parsed.data;

    // Bulk-update displayOrder for each event — verify each belongs to this group
    const bulkOps = orders.map(
      ({
        eventId,
        displayOrder,
        startTime,
        endTime,
      }: {
        eventId: string;
        displayOrder: number;
        startTime?: string;
        endTime?: string;
      }) => ({
        updateOne: {
          filter: {
            _id: Types.ObjectId.isValid(eventId)
              ? new Types.ObjectId(eventId)
              : eventId,
            groupId,
          },
          update: {
            $set: {
              displayOrder,
              ...(startTime ? { startTime: new Date(startTime) } : {}),
              ...(endTime ? { endTime: new Date(endTime) } : {}),
            },
          },
        },
      }),
    );

    await CalendarEvent.bulkWrite(bulkOps);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("PATCH calendar reorder error:", msg);
    return NextResponse.json(
      { error: "Server error", details: msg },
      { status: 500 },
    );
  }
}
