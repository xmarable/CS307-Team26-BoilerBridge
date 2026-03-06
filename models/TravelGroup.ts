import mongoose from "mongoose";
import { randomUUID } from "crypto";
import { unique } from "next/dist/build/utils";

const expenseSchema = new mongoose.Schema(
  {
    expenseID: { type: String },
    payerID: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
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
      sparse: true, // added to allow multiple nulls in unique index
    },
    senderID: { type: String },
    senderName: { type: String, required: true },
    content: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const travelGroupSchema = new mongoose.Schema({
  groupID: {
    type: String,
    default: () => randomUUID(),
    unique: true,
  },
  groupName: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  leaderID: {
    type: String,
    required: true,
  },
  membersList: [
    {
      type: String,
      required: true,
    },
  ],
  ledger: [expenseSchema],
  chatLogs: {
    type: [messageSchema],
    default: []
  }
});

const TravelGroup =
  mongoose.models.TravelGroup ||
  mongoose.model("TravelGroup", travelGroupSchema);

export default TravelGroup;
