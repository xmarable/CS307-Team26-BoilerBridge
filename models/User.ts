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
    trim: true,
    minlength: 3,
    maxlength: 30,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  passwordHash: { type: String, required: true },
  school: { type: String, trim: true },
  friendsList: [
    {
      type: mongoose.Schema.Types.UUID,
    },
  ],
  preferences: { type: Map, of: Boolean },
  isStudentVerified: { type: Boolean, default: false },
});

const User =
  mongoose.models.User || mongoose.model("User", userSchema, "users");

export default User;
