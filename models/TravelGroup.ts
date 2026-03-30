import mongoose from "mongoose";
import { randomUUID } from "crypto";

const expenseSchema = new mongoose.Schema(
  {
    expenseID: {
      type: mongoose.Schema.Types.UUID,
      default: () => randomUUID(),
    },
    payerID: {
      type: mongoose.Schema.Types.UUID,
      ref: "User",
    },
    amount: { type: Number },
    description: { type: String },
    debtors: { type: Map, of: Number },
    isSettled: { type: Boolean, default: false },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    messageID: {
      type: mongoose.Schema.Types.UUID,
      default: () => randomUUID(),
      unique: true,
      sparse: true,
    },
    senderID: {
      type: mongoose.Schema.Types.UUID,
      ref: "User",
    },
    senderName: {
      type: String,
      required: true,
    },
    content: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const announcementSchema = new mongoose.Schema(
  {
    announcementID: {
      type: mongoose.Schema.Types.UUID,
      default: () => randomUUID(),
    },
    content: { type: String, required: true },
    pinnedBy: { type: String, required: true },
    pinnedByID: {
      type: mongoose.Schema.Types.UUID,
      ref: "User",
      required: true,
    },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const groupMemberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.UUID,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["Leader", "Admin", "Viewer"],
      default: "Viewer",
      required: true,
    },
  },
  { _id: false },
);

const SMSSchema = new mongoose.Schema(
  {
    smsID: {
      type: mongoose.Types.UUID,
      default: () => randomUUID()
    },
    topic: {
      type: String,
      required: true
    },
    sentAt: {
      type: Date,
      required: true,
      defualt: Date.now
    }
  }
);

const photoSchema = new mongoose.Schema(
  {
    photoId: {
      type: mongoose.Types.UUID,
      default: () => randomUUID()
    },
    image: {
      type: String,
      default: ""
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    uploaderID: {
      type: mongoose.Types.UUID,
      ref: "User",
      required: true
    }
  }
);

const paymentRequestSchema = new mongoose.Schema(
  {
    requestID: {
      type: mongoose.Schema.Types.UUID,
      default: () => randomUUID(),
    },
    requesterID: {
      type: mongoose.Schema.Types.UUID,
      ref: "User",
      required: true,
    },
    targetMemberID: {
      type: mongoose.Schema.Types.UUID,
      ref: "User",
      required: true,
    },
    amount: { type: Number, required: true },
    expenseID: {
      type: mongoose.Schema.Types.UUID,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "paid", "declined"],
      default: "pending",
    },
    createdAt: { type: Date, default: Date.now },
    confirmedAt: { type: Date },
    message: { type: String },
    declineReason: { type: String },
  },
  { _id: false },
);

// New schema for tracking invitations that haven't been accepted yet
const pendingRequestSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    sentAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const travelGroupSchema = new mongoose.Schema(
  {
    groupID: {
      type: mongoose.Schema.Types.UUID,
      default: () => randomUUID(),
      unique: true,
    },
    groupName: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    leaderID: {
      type: mongoose.Schema.Types.UUID,
      required: true,
      ref: "User",
    },
    membersList: [groupMemberSchema],
    pendingRequests: {
      type: [pendingRequestSchema],
      default: [],
    },
    pinnedAnnouncements: {
      type: [announcementSchema],
      default: [],
    },
    ledger: [expenseSchema],
    smsLogs: {
      type: [SMSSchema],
      default: []
    },
    chatLogs: {
      type: [messageSchema],
      default: [],
    },
    photos: {
      type: [photoSchema],
      default: []
    },
    paymentRequests: {
      type: [paymentRequestSchema],
      default: [],
    },
  },
  { timestamps: true },
);

const TravelGroup =
  mongoose.models.TravelGroup ||
  mongoose.model("TravelGroup", travelGroupSchema);

export default TravelGroup;
