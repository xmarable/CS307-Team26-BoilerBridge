import mongoose from "mongoose";

/**
 * Publish layer for itineraries. We store a snapshot at publish time so the
 * public feed does not break when group AI itineraries are regenerated
 * (CalendarEvent deleteMany) or trips are edited/deleted.
 */
const PublicItinerarySchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.UUID,
      required: true,
      ref: "User",
      index: true,
    },
    sourceType: {
      type: String,
      enum: ["trip", "group"],
      required: true,
    },
    /** trip: Trip._id string; group: TravelGroup.groupID (UUID string) */
    sourceId: { type: String, required: true },
    isPublic: { type: Boolean, default: true, index: true },
    publishedAt: { type: Date, default: Date.now, index: true },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true, default: "" },
    /**
     * Minimal snapshot for list + detail. Shape depends on sourceType:
     * - trip: { primaryItinerary, rainyDayItinerary, fromCity, toCity, fromDate, toDate }
     * - group: { groupEvents, fromCity?, toCity?, fromDate?, toDate? } (cities/dates from linked Trip when present)
     */
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

PublicItinerarySchema.index(
  { sourceType: 1, sourceId: 1 },
  { unique: true },
);

const PublicItinerary =
  mongoose.models.PublicItinerary ||
  mongoose.model("PublicItinerary", PublicItinerarySchema);

export default PublicItinerary;
