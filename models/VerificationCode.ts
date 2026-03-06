import mongoose from "mongoose";

const verificationCodeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.UUID,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  code: {
    type: String,
    required: true,
  },
  attempts: { type: Number, default: 0 },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600, // 10 minutes (TTL index)
  },
});

const VerificationCode =
  mongoose.models.VerificationCode ||
  mongoose.model("VerificationCode", verificationCodeSchema);

export default VerificationCode;
