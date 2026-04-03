import mongoose from "mongoose";

const ActivitySchema = new mongoose.Schema({
  activityId: { type: String, required: true },
  name: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  isOutdoor: { type: Boolean, default: false },
  category: { type: String },
  location: { type: String },
});

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

    primaryItinerary: [ActivitySchema],
    rainyDayItinerary: [ActivitySchema],

    /** Activity/location names or IDs to exclude from itinerary recommendations (US14) */
    avoidActivities: {
      type: [String],
      default: [],
    },
    avoidLocations: {
      type: [String],
      default: [],
    },
    /** Optional budget range for suggestions (US14) */
    budgetMin: { type: Number, default: undefined },
    budgetMax: { type: Number, default: undefined },
  },

  { timestamps: true },
);

const Trip = mongoose.models.Trip || mongoose.model("Trip", TripSchema);
export default Trip;
