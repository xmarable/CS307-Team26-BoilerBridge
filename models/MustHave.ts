import mongoose, { Schema, Document, Model } from "mongoose";

export type MustHaveStatus = "proposed" | "approved" | "rejected";

export interface IMustHave extends Document {
  groupId: mongoose.Schema.Types.UUID; // TravelGroup Mongo _id (string)
  tripId?: mongoose.Schema.Types.UUID; // optional (Trip Mongo _id as string)
  placeId?: string; // Google Places place_id
  name: string;
  category?: string;
  address?: string;
  lat?: number;
  lng?: number;
  notes?: string;
  priority?: number; // 1..5 (scale to rate the priority)
  addedBy: mongoose.Schema.Types.UUID; // User Mongo _id
  status: MustHaveStatus;
  createdAt: Date;
  updatedAt: Date;
}

const MustHaveSchema = new Schema<IMustHave>(
  {
    groupId: { type: mongoose.Schema.Types.UUID, required: true, index: true },
    tripId: { type: mongoose.Schema.Types.UUID, index: true },

    placeId: { type: String, index: true },

    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    address: { type: String, trim: true },
    lat: { type: Number },
    lng: { type: Number },

    notes: { type: String, trim: true },
    priority: { type: Number, default: 3 },

    addedBy: { type: mongoose.Schema.Types.UUID, required: true, index: true },

    status: {
      type: String,
      enum: ["proposed", "approved", "rejected"],
      default: "proposed",
      index: true,
    },
  },
  { timestamps: true },
);

// Optional helpful indexes for querying/filtering
MustHaveSchema.index({ groupId: 1, status: 1 });
MustHaveSchema.index({ groupId: 1, category: 1 });
MustHaveSchema.index({ groupId: 1, priority: 1 });

const MustHave: Model<IMustHave> =
  mongoose.models.MustHave ||
  mongoose.model<IMustHave>("MustHave", MustHaveSchema);

export default MustHave;
