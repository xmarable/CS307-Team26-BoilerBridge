import mongoose from "mongoose";
import { randomUUID } from "crypto";

const notificationSchema = new mongoose.Schema(
  {
    notificationID: {
      type: mongoose.Schema.Types.UUID,
      default: () => randomUUID(),
      unique: true,
    },
    recipientID: {
      type: mongoose.Schema.Types.UUID,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["payment_confirmed"],
    },
    groupID: {
      type: String,
      required: true,
    },
    paymentRequestID: {
      type: String,
      required: true,
    },
    actorUserId: {
      type: mongoose.Schema.Types.UUID,
      ref: "User",
    },
    amountDollars: { type: Number },
    message: { type: String },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

notificationSchema.index({ recipientID: 1, createdAt: -1 });

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema, "notifications");

export default Notification;
