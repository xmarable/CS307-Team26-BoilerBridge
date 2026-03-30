import mongoose, { Schema, Document, Model } from "mongoose";

export type SplitType = "equal" | "custom-amount" | "custom-percentage";

export interface ICostSplitParticipant {
  userId: string;      // User id/UUID used by your app
  amount: number;      // final calculated share amount
  percentage?: number; // only used for custom-percentage
}

export interface ICostSplit extends Document {
  groupId: string;     // TravelGroup _id or group identifier used in route
  tripId?: string;     // optional Trip id
  expenseId: string;   // expenseID from the group ledger / expense record
  participants: ICostSplitParticipant[];
  splitType: SplitType;
  totalAmount: number; // original expense total
  createdBy: string;   // user id / UUID
  createdAt: Date;
  updatedAt: Date;
}

const CostSplitParticipantSchema = new Schema<ICostSplitParticipant>(
  {
    userId: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    percentage: { type: Number, min: 0, max: 100 },
  },
  { _id: false }
);

const CostSplitSchema = new Schema<ICostSplit>(
  {
    groupId: { type: String, required: true, index: true },
    tripId: { type: String, index: true },
    expenseId: { type: String, required: true, index: true },

    participants: {
      type: [CostSplitParticipantSchema],
      required: true,
      validate: {
        validator: function (value: ICostSplitParticipant[]) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "At least one participant is required",
      },
    },

    splitType: {
      type: String,
      enum: ["equal", "custom-amount", "custom-percentage"],
      required: true,
      index: true,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    createdBy: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

// Helpful indexes for group lookups and filters
CostSplitSchema.index({ groupId: 1, tripId: 1 });
CostSplitSchema.index({ groupId: 1, expenseId: 1 });
CostSplitSchema.index({ groupId: 1, createdBy: 1 });

const CostSplit: Model<ICostSplit> =
  mongoose.models.CostSplit ||
  mongoose.model<ICostSplit>("CostSplit", CostSplitSchema);

export default CostSplit;

