import mongoose, { Mongoose } from "mongoose";
import { randomUUID } from "crypto";

const userSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.UUID,
    default: () => randomUUID(),
    unique: true
  },
  username: { type: String, required: true, trim: true, minlength: 3, maxlength: 30 },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true },
  school: { type: String, trim: true },
  friendsList: [
    {
      type: mongoose.Schema.Types.UUID,
    }
  ],
  preferences: { type: Map, of: Boolean },
  settings: {
    type: {
      notifications: {
        tripReminders: { type: Boolean, default: false },
        friendRequests: { type: Boolean, defualt: false },
        groupInvite: { type: Boolean, default: false }
      },
      deletion: {
        requested: { type: Boolean, default: false },
        requestedAt: { type: Date, default: null },
        scheduledFor: { type: Date, default: null },
        reason: {type: String, default: "" }
      },
      security: {
        isStudentVerified: { type: Boolean, default: false },
        passwordLastChanged: { type: Date, default: null }
      }
    }
  },
});

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;