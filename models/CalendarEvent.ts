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
  /** Stored Activity document id for /dashboard/activities/[id] */
  linkedActivityId?: string;
  /** Google Places id when preview detail is used */
  linkedPlaceId?: string;
  /** Trip destination city when row was created from Spark (for destination-aware preview links) */
  itineraryDestinationCity?: string;
  /** Generator-backed option lifecycle (US11/US12); manual rows use "final". */
  itineraryOptionStatus?: "candidate" | "removed" | "final";
  /** Cluster of competing activity options for voting (US12). */
  optionGroupId?: string;
  /** True when an itinerary row passed strict accessibility filtering */
  accessibilityMatched?: boolean;
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
    linkedActivityId: { type: String, trim: true },
    linkedPlaceId: { type: String, trim: true },
    itineraryDestinationCity: { type: String, trim: true },
    itineraryOptionStatus: {
      type: String,
      enum: ["candidate", "removed", "final"],
    },
    optionGroupId: { type: String, trim: true, index: true },
    accessibilityMatched: { type: Boolean, default: undefined },
  },
  { timestamps: true },
);

CalendarEventSchema.index({ groupId: 1, startTime: 1 });

const CalendarEvent: Model<ICalendarEvent> =
  mongoose.models.CalendarEvent ||
  mongoose.model<ICalendarEvent>("CalendarEvent", CalendarEventSchema);

export default CalendarEvent;
