import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICalendarEvent extends Document {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  eventType?: string;
  createdBy: mongoose.Schema.Types.UUID; // User.userId (UUID)
  groupId: mongoose.Schema.Types.UUID; // TravelGroup.groupId (string used in URLs)
  source: "manual" | "itinerary";
  externalId?: string;
  timezone?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CalendarEventSchema = new Schema<ICalendarEvent>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    startTime: { type: Date, required: true },

    endTime: {
      type: Date,
      required: true,
      validate: [
        {
          // Mongoose "this" typing is messy; using any avoids TS errors
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
    createdBy: { type: String, required: true, index: true },
    groupId: { type: String, required: true, index: true },

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

const CalendarEvent: Model<ICalendarEvent> =
  mongoose.models.CalendarEvent ||
  mongoose.model<ICalendarEvent>("CalendarEvent", CalendarEventSchema);

export default CalendarEvent;
