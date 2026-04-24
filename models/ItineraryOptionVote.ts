import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IItineraryOptionVote extends Document {
  groupId: string;
  optionGroupId: string;
  userId: string;
  /** CalendarEvent _id */
  optionId: string;
}

const ItineraryOptionVoteSchema = new Schema<IItineraryOptionVote>(
  {
    groupId: { type: String, required: true, index: true },
    optionGroupId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    optionId: { type: String, required: true },
  },
  { timestamps: true },
);

ItineraryOptionVoteSchema.index(
  { groupId: 1, optionGroupId: 1, userId: 1 },
  { unique: true },
);

const ItineraryOptionVote: Model<IItineraryOptionVote> =
  mongoose.models.ItineraryOptionVote ||
  mongoose.model<IItineraryOptionVote>(
    "ItineraryOptionVote",
    ItineraryOptionVoteSchema,
  );

export default ItineraryOptionVote;
