import mongoose, { Schema, Document, Model } from "mongoose";

export type SharedCostSplitType =
  | "equal"
  | "custom-amount"
  | "custom-percentage";

export interface ISharedCostParticipant {
  userId: string;
}

export interface ISharedCost extends Document {
  groupId: string;
  tripId?: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  category?: string;
  paidBy: string;
  participants: ISharedCostParticipant[];
  splitType: SharedCostSplitType;
  date: Date;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const SharedCostParticipantSchema = new Schema<ISharedCostParticipant>(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const SharedCostSchema = new Schema<ISharedCost>(
  {
    groupId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    tripId: {
      type: String,
      index: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: "USD",
    },
    category: {
      type: String,
      trim: true,
      index: true,
    },
    paidBy: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    participants: {
      type: [SharedCostParticipantSchema],
      required: true,
      validate: {
        validator: function (value: ISharedCostParticipant[]) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "At least one participant is required",
      },
    },
    splitType: {
      type: String,
      enum: ["equal", "custom-amount", "custom-percentage"],
      required: true,
      default: "equal",
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
  },
  { timestamps: true }
);

SharedCostSchema.index({ groupId: 1, tripId: 1 });
SharedCostSchema.index({ groupId: 1, category: 1 });
SharedCostSchema.index({ groupId: 1, paidBy: 1 });
SharedCostSchema.index({ groupId: 1, date: -1 });

const SharedCost: Model<ISharedCost> =
  mongoose.models.SharedCost ||
  mongoose.model<ISharedCost>("SharedCost", SharedCostSchema);

export default SharedCost;