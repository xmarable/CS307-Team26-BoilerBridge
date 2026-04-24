import mongoose, { Schema, Document, Model } from "mongoose";
import { randomUUID } from "crypto";

export type CalendarProvider = "google" | "outlook";

export interface ICalendarConnection extends Document {
  connectionId: any;
  userId: string;
  provider: CalendarProvider;
  providerAccountId: string;
  encryptedAccessToken: string;
  encryptedRefreshToken?: string;
  tokenExpiresAt: Date;
  calendarId?: string;
  calendarName?: string;
  syncEnabled: boolean;
  lastSyncedAt?: Date;
  syncError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CalendarConnectionSchema = new Schema<ICalendarConnection>(
  {
    connectionId: {
      type: mongoose.Schema.Types.UUID,
      default: () => randomUUID(),
      unique: true,
    },
    userId: { type: String, required: true, index: true },
    provider: {
      type: String,
      enum: ["google", "outlook"],
      required: true,
    },
    providerAccountId: { type: String, required: true },
    encryptedAccessToken: { type: String, required: true },
    encryptedRefreshToken: { type: String },
    tokenExpiresAt: { type: Date, required: true },
    calendarId: { type: String },
    calendarName: { type: String },
    syncEnabled: { type: Boolean, default: false },
    lastSyncedAt: { type: Date },
    syncError: { type: String },
  },
  { timestamps: true },
);

// One active connection per user per provider
CalendarConnectionSchema.index({ userId: 1, provider: 1 }, { unique: true });

const CalendarConnection: Model<ICalendarConnection> =
  mongoose.models.CalendarConnection ||
  mongoose.model<ICalendarConnection>(
    "CalendarConnection",
    CalendarConnectionSchema,
  );

export default CalendarConnection;
