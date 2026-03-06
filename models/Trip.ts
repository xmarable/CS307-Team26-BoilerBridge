import mongoose from "mongoose";

const mustHaveActivitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
  },
  { _id: false }
);

const TripSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    fromCity: {
        type: String,
        required: true,
    },
    toCity: {
        type: String,
        required: true,
    },
    fromDate: {
        type: Date,
        required: true,
    },
    toDate: {
        type: Date,
        required: true,
    },
    mode: {
        type: String,
        enum: ['flight', 'train', 'bus', 'taxi'],
        required: true,
    },
    budget: {
        type: Number,
        required: true,
    },
    tripConfirmed: {
        type: Boolean,
        default: false,
    },
    mustHaves: {
        type: [mustHaveActivitySchema],
        default: [],
    },
},
{ timestamps: true });

const Trip = mongoose.models.Trip || mongoose.model('Trip', TripSchema);

export default Trip;