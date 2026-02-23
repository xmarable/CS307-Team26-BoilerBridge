import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";

import User from "@/models/User";
import TravelGroup from "@/models/TravelGroup";
import CalendarEvent from "@/models/CalendarEvent";

/**
 * Returns identifiers to use for membership comparisons.
 * - mongoId: session.user.id (Mongo _id string)
 * - uuid: user.userId
 */
async function getUserIdentifiers() {
  const session = await getServerSession(authOptions);
  const mongoId = (session?.user as any)?.id as string | undefined;
  if (!mongoId) return null;

  await dbConnect();
  const userDoc: any = await User.findById(mongoId).lean();

  return {
    mongoId,
    uuid: userDoc?.userId as string | undefined,
  };
}

function isMember(group: any, ids: { mongoId: string; uuid?: string }) {
  const members: string[] = group?.members ?? [];
  return members.includes(ids.mongoId) || (ids.uuid ? members.includes(ids.uuid) : false);
}

const CreateEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  location: z.string().optional(),
  eventType: z.string().optional(),
  source: z.enum(["manual", "itinerary"]).optional(),
  externalId: z.string().optional(),
  timezone: z.string().optional(),
});
