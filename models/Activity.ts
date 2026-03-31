import mongoose, { Schema, Document, Model } from "mongoose";

export interface IReview {
  author: string;
  text: string;
  rating: number;
  time: Date;
}

export interface IActivity extends Document {
  placeId?: string;
  name: string;
  address?: string;
  rating?: number;
  reviewCount: number;
  reviews: IReview[];
  /** Cached summary fields */
  sentimentSummary?: string;
  highlights?: string[];
  pros?: string[];
  cons?: string[];
  summaryCachedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    author: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
    rating: { type: Number, required: true },
    time: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ActivitySchema = new Schema<IActivity>(
  {
    placeId: { type: String, index: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    rating: { type: Number },
    reviewCount: { type: Number, default: 0 },
    reviews: {
      type: [ReviewSchema],
      default: [],
    },
    sentimentSummary: { type: String },
    highlights: [{ type: String }],
    pros: [{ type: String }],
    cons: [{ type: String }],
    summaryCachedAt: { type: Date },
  },
  { timestamps: true }
);

const Activity: Model<IActivity> =
  mongoose.models.Activity || mongoose.model<IActivity>("Activity", ActivitySchema);

export default Activity;
