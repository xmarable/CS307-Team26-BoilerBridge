import { NextResponse } from "next/server";
import CalendarEvent from "@/models/CalendarEvent";
import dbConnect from "@/lib/dbConnect";

export async function GET(
  req: Request,
  { params }: { params: { groupId: string } },
) {
  try {
    await dbConnect();
    const { groupId } = params;

    const events = await CalendarEvent.find({ groupId })
      .sort({ startTime: 1 })
      .lean();

    return NextResponse.json(events);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
