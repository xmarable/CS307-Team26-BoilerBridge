import mongoose from "mongoose";

const ActivitySchema = new mongoose.Schema({
  activityId: { type: String, required: false },
  /** Stable id for PATCH /api/itinerary/:id/section (distinct from catalog activityId). Assigned in application code / ensureItinerarySectionIds. */
  itineraryActivityId: {
    type: String,
  },
  /** Groups activities into an editable day section (shared by all acts on that calendar day). */
  dayId: { type: String },
  name: { type: String, required: false },
  startTime: { type: Date, required: false },
  endTime: { type: Date, required: false },
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

    /** Incremented on successful PATCH /api/itinerary/:id/section; optional optimistic check via request body `version`. */
    itineraryVersion: { type: Number, default: 0 },
  },

  { timestamps: true },
);

const Trip = mongoose.models.Trip || mongoose.model("Trip", TripSchema);
export default Trip;
