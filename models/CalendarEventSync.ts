import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICalendarEventSync extends Document {
  connectionId: string;
  calendarEventId: string;
  externalEventId: string;
  provider: string;
  createdAt: Date;
  updatedAt: Date;
}

const CalendarEventSyncSchema = new Schema<ICalendarEventSync>(
  {
    connectionId: { type: String, required: true, index: true },
    calendarEventId: { type: String, required: true, index: true },
    externalEventId: { type: String, required: true },
    provider: { type: String, required: true },
  },
  { timestamps: true },
);

// Each event can only be synced once per connection
CalendarEventSyncSchema.index(
  { connectionId: 1, calendarEventId: 1 },
  { unique: true },
);

const CalendarEventSync: Model<ICalendarEventSync> =
  mongoose.models.CalendarEventSync ||
  mongoose.model<ICalendarEventSync>(
    "CalendarEventSync",
    CalendarEventSyncSchema,
  );

export default CalendarEventSync;
