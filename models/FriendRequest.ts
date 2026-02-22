/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import { randomUUID } from "crypto";

const friendRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.UUID,
      default: () => randomUUID(),
      unique: true
    },
    requesterId: {
      type: mongoose.Schema.Types.UUID,
      required: true,
      ref: "User"
    },
    recipientId: {
      type: mongoose.Schema.Types.UUID,
      required: true,
      ref: "User"
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending"
    }
  },
  {
    timestamps: true
  }
);

friendRequestSchema.pre("save", function (next: any) {
  const doc = this as any;
  const requester = String(doc.requesterId);
  const recipient = String(doc.recipientId);

  if (requester === recipient) {
    next(new Error("Cannot send a friend request to yourself."));
  }
  else {
    next();
  }
});

const FriendRequest = mongoose.models.FriendRequest || mongoose.model("FriendRequest", friendRequestSchema);

export default FriendRequest;