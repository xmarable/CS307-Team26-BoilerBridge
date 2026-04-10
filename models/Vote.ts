import mongoose, { Schema, Document } from "mongoose";

export interface IVote extends Document {
  activityId: string;
  groupId: string;
  userId: string;
  type: "up" | "down";
  createdAt: Date;
}

const VoteSchema: Schema = new Schema({
  activityId: { type: String, required: true },
  groupId: { type: String, required: true },
  userId: { type: String, required: true },
  type: { type: String, enum: ["up", "down"], required: true },
  createdAt: { type: Date, default: Date.now },
});

/**
 * logic: prevents a user from voting on the same activity in a group more than once.
 * satisfies story requirement: "users can only vote once per activity."
 */
VoteSchema.index({ activityId: 1, userId: 1, groupId: 1 }, { unique: true });

export default mongoose.models.Vote ||
  mongoose.model<IVote>("Vote", VoteSchema);
