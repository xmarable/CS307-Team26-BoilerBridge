import mongoose from "mongoose";
import { randomUUID } from "crypto";

const userSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.UUID,
    default: () => randomUUID(),
    unique: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
  },
  usernameLastChanged: {
    type: Date,
    default: null,
  },
  name: {
    type: String,
    trim: true,
    default: "",
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  eduEmail: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function (v: string) {
        return !v || v.endsWith(".edu");
      },
      message: (props: any) => `${props.value} is not a valid .edu email!`,
    },
  },
  passwordHash: { type: String, required: true },
  school: { type: String, trim: true },
  location: { type: String, trim: true },
  image: { type: String, default: "" },
  friendsList: [
    {
      type: mongoose.Schema.Types.UUID,
    },
  ],
  preferences: { type: Map, of: Boolean },
  settings: {
    type: {
      notifications: {
        tripReminders: { type: Boolean, default: false },
        friendRequests: { type: Boolean, default: false },
        groupInvite: { type: Boolean, default: false },
      },
      deletion: {
        requested: { type: Boolean, default: false },
        requestedAt: { type: Date, default: null },
        scheduledFor: { type: Date, default: null },
        reason: { type: String, default: "" },
      },
      security: {
        isStudentVerified: { type: Boolean, default: false },
        passwordLastChanged: { type: Date, default: null },
      },
    },
  },
});

const User =
  mongoose.models.User || mongoose.model("User", userSchema, "users");

export default User;
