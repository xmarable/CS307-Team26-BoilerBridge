import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import { getMemberPermissions } from "@/lib/roles";
import Trip from "@/models/Trip";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { userId?: string })?.userId;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId } = await params;
    if (!groupId) {
      return NextResponse.json({ error: "Group ID is required." }, { status: 400 });
    }

    await dbConnect();

    const permissionResult = await getMemberPermissions(groupId, userId);
    if ("error" in permissionResult && permissionResult.error) {
      return NextResponse.json(
        { error: permissionResult.error },
        { status: permissionResult.status },
      );
    }

    const trips = await Trip.find({ groupID: groupId as never })
      .sort({ createdAt: -1 })
      .lean();

    const payload = trips.map((trip) => {
      const t = trip as Record<string, unknown>;
      return {
        _id: t._id?.toString(),
        fromCity: t.fromCity,
        toCity: t.toCity,
        fromDate: t.fromDate,
        toDate: t.toDate,
        mode: t.mode,
        budget: t.budget,
        createdAt: t.createdAt,
      };
    });

    return NextResponse.json({ trips: payload }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to load group trips.", details: message },
      { status: 500 },
    );
  }
}
