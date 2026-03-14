import mongoose, { Schema, Document, Model } from "mongoose";
import { randomUUID } from "crypto";

export interface ICalendarEvent extends Document {
  eventID: any;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  eventType?: string;
  createdBy: any; // User.userId (UUID)
  groupId: any; // TravelGroup.groupId (string used in URLs)
  source: "manual" | "itinerary";
  externalId?: string;
  timezone?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CalendarEventSchema = new Schema<ICalendarEvent>(
  {
    eventID: {
      type: mongoose.Schema.Types.UUID,
      default: () => randomUUID(),
      required: true,
      unique: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    startTime: { type: Date, required: true },
    endTime: {
      type: Date,
      required: true,
      validate: [
        {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          validator: function (this: any, value: Date) {
            return value > this.startTime;
          },
          message: "End time must be after start time",
        },
      ],
    },
    location: { type: String, trim: true },
    eventType: { type: String, default: "general" },

    createdBy: {
      type: mongoose.Schema.Types.UUID,
      required: true,
      index: true,
    },
    groupId: {
      type: mongoose.Schema.Types.UUID,
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ["manual", "itinerary"],
      default: "manual",
    },

    externalId: { type: String },
    timezone: { type: String, default: "UTC" },
  },
  { timestamps: true },
);

CalendarEventSchema.index({ groupId: 1, startTime: 1 });

const CalendarEvent: Model<ICalendarEvent> =
  mongoose.models.CalendarEvent ||
  mongoose.model<ICalendarEvent>("CalendarEvent", CalendarEventSchema);

export default CalendarEvent;
