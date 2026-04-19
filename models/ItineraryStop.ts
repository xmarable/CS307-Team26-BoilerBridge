import mongoose, { Schema, Document, Model } from "mongoose";
import { randomUUID } from "crypto";

export interface IItineraryStop extends Document {
  stopId: any;
  groupId: string;
  tripId?: string;
  calendarEventId?: string;
  title: string;
  placeName?: string;
  address?: string;
  lat?: number;
  lng?: number;
  order: number;
  startTime?: Date;
  endTime?: Date;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const ItineraryStopSchema = new Schema<IItineraryStop>(
  {
    stopId: {
      type: mongoose.Schema.Types.UUID,
      default: () => randomUUID(),
      unique: true,
    },
    groupId: { type: String, required: true, index: true },
    tripId: { type: String },
    calendarEventId: { type: String },
    title: { type: String, required: true, trim: true },
    placeName: { type: String, trim: true },
    address: { type: String, trim: true },
    lat: { type: Number },
    lng: { type: Number },
    order: { type: Number, required: true, default: 0 },
    startTime: { type: Date },
    endTime: { type: Date },
    notes: { type: String, trim: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

ItineraryStopSchema.index({ groupId: 1, order: 1 });

const ItineraryStop: Model<IItineraryStop> =
  mongoose.models.ItineraryStop ||
  mongoose.model<IItineraryStop>("ItineraryStop", ItineraryStopSchema);

export default ItineraryStop;
