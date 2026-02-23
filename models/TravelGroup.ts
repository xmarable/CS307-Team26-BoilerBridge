import mongoose from "mongoose";
import { randomUUID } from "crypto";

// Minimal sub-schemas for embedded documents (full schemas can live in models/ later)
const expenseSchema = new mongoose.Schema(
  {
    expenseID: { type: String },
    payerID: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    amount: { type: Number },
    description: { type: String },
    debtors: { type: Map, of: Number },
    isSettled: { type: Boolean, default: false },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    messageID: { type: String },
    senderID: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    content: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
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
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  membersList: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  ledger: [expenseSchema],
  chatLogs: [messageSchema],
});

const TravelGroup =
  mongoose.models.TravelGroup ||
  mongoose.model("TravelGroup", travelGroupSchema);

export default TravelGroup;
