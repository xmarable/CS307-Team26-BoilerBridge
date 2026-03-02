import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

const AllowedUpdatesSchema = z.object({
  "settings.notifications.tripReminders": z.boolean().optional(),
  "settings.notifications.friendRequests": z.boolean().optional(),
  "settings.notifications.groupInvites": z.boolean().optional(),
  "settings.deletion.requested": z.boolean().optional(),
  "settings.deletion.reason": z.string().max(500).optional()
}).strict();

// Temporary placeholder to satisfy TypeScript/Next.js build
export async function PATCH(req: NextRequest) {
  const session = getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  
}