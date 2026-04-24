import mongoose from "mongoose";


const sharedItineraryLinkSchema = new mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.UUID,
        required: true,
        ref: "TravelGroup",
    },
    tripId: {
        type: mongoose.Schema.Types.UUID,
        required: true,
        ref: "Trip"
    },
    token: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    isActive: {
        type: Boolean,
        default: true,
    },
});

const SharedItineraryLink = mongoose.models.SharedIteneraryLink || mongoose.model("SharedIteneraryLink", sharedItineraryLinkSchema);

export default SharedItineraryLink;