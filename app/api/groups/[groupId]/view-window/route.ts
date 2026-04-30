import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect"; // replace with your db helper
import TravelGroup from "@/models/TravelGroup"; // replace with your model

export async function PATCH(
  req: Request,
  { params }: { params: { groupId: string } },
) {
  try {
    const { from, to } = await req.json();
    await dbConnect();

    await TravelGroup.findOneAndUpdate(
      { groupID: params.groupId },
      { $set: { "viewWindow.from": from, "viewWindow.to": to } },
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "failed to update window" },
      { status: 500 },
    );
  }
}
