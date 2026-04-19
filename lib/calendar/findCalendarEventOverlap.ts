import mongoose from "mongoose";
import CalendarEvent from "@/models/CalendarEvent";

export type CalendarOverlapConflict = {
  _id: string;
  title: string;
  startTime: Date;
  endTime: Date;
};

/**
 * Returns another event in the same group whose interval intersects [start, end),
 * excluding a specific event id (for updates).
 */
export async function findCalendarEventOverlap(
  groupId: string,
  window: { start: Date; end: Date },
  excludeEventId?: string,
): Promise<CalendarOverlapConflict | null> {
  const filter: Record<string, unknown> = {
    groupId,
    startTime: { $lt: window.end },
    endTime: { $gt: window.start },
  };

  if (
    excludeEventId &&
    mongoose.Types.ObjectId.isValid(excludeEventId)
  ) {
    filter._id = { $ne: new mongoose.Types.ObjectId(excludeEventId) };
  }

  const doc = await CalendarEvent.findOne(filter)
    .select("title startTime endTime")
    .lean();

  if (!doc) return null;

  const d = doc as {
    _id: { toString(): string };
    title: string;
    startTime: Date;
    endTime: Date;
  };

  return {
    _id: d._id.toString(),
    title: d.title,
    startTime: new Date(d.startTime),
    endTime: new Date(d.endTime),
  };
}
