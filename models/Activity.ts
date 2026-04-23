import { randomUUID } from "crypto";
import mongoose, { Schema, Document, Model, mongo } from "mongoose";


export interface IReview {
  reviewId: string;
  authorId: string;
  author: string;
  text: string;
  rating: number;
  time: Date;
}

export interface IReferenceLink {
  title: string;
  url: string;
}

export interface IActivity extends Document {
  activityId: string;
  /** Google Place ID (Places API) — used for details + reviews enrichment */
  placeId?: string;
  name: string;
  address?: string;
  rating?: number;
  reviewCount: number;
  reviews: IReview[];
  /** Optional estimated cost for budget-based recommendations (US14) */
  estimatedCost?: number;
  /** US15: primary informational URL (e.g. official site) */
  infoUrl?: string;
  /** US15: long-form description for the activity info page */
  description?: string;
  /** US15: curated external references (open in new tab) */
  referenceLinks?: IReferenceLink[];
  /** US16: optional deep link to a booking vendor (Expedia, venue, etc.) */
  bookingUrl?: string;
  /** Deep link to the place in Google Maps (persisted from Places). */
  googleMapsUri?: string;
  /** Google place types (e.g. museum, park). */
  googleTypes?: string[];
  /** 0–4 price level from Google when available. */
  priceLevel?: number;
  phoneNumber?: string;
  /** Weekday hour lines joined with newlines. */
  openingHoursSummary?: string;
  /** Legacy Places photo_reference. */
  googlePhotoReference?: string;
  /** Places API (New) photo resource name for server-side media fetch. */
  googlePhotoMediaResource?: string;
  /** Expedia Rapid property id — enables US16 property deep link when Rapid keys are set */
  expediaPropertyId?: string;
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
    reviewId: {type: String, default: randomUUID()},
    authorId: { type: String, required: true },
    author: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
    rating: { type: Number, required: true },
    time: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ReferenceLinkSchema = new Schema<IReferenceLink>(
  {
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const ActivitySchema = new Schema<IActivity>(
  {
    activityId: { type: String, default: randomUUID(), unique: true },
    placeId: { type: String, index: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    rating: { type: Number },
    reviewCount: { type: Number, default: 0 },
    reviews: {
      type: [ReviewSchema],
      default: [],
    },
    estimatedCost: { type: Number },
    infoUrl: { type: String, trim: true },
    description: { type: String, trim: true },
    referenceLinks: { type: [ReferenceLinkSchema], default: [] },
    bookingUrl: { type: String, trim: true },
    googleMapsUri: { type: String, trim: true },
    googleTypes: { type: [String], required: false, default: undefined },
    priceLevel: { type: Number, min: 0, max: 4 },
    phoneNumber: { type: String, trim: true },
    openingHoursSummary: { type: String, trim: true },
    googlePhotoReference: { type: String, trim: true },
    googlePhotoMediaResource: { type: String, trim: true },
    expediaPropertyId: { type: String, trim: true },
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
