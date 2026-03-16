import mongoose from "mongoose";

const TripSchema = new mongoose.Schema(
  {
    groupID: {
      type: mongoose.Schema.Types.UUID,
      required: true,
      ref: "TravelGroup",
    },
    userId: {
      type: mongoose.Schema.Types.UUID,
      required: true,
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
      enum: ["flight", "train", "bus", "taxi"],
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

    /** Activity/location names or IDs to exclude from itinerary recommendations (US14) */
    avoidActivities: {
      type: [String],
      default: [],
    },
    avoidLocations: {
      type: [String],
      default: [],
    },
    /** Optional budget range for suggestions (US14); if set, recommendations respect this range */
    budgetMin: { type: Number, default: undefined },
    budgetMax: { type: Number, default: undefined },
  },
  { timestamps: true },
);

const Trip = mongoose.models.Trip || mongoose.model("Trip", TripSchema);

export default Trip;
