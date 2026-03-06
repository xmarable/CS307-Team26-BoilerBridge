import mongoose from "mongoose";
import User from "../models/User";
import { boolean, float64 } from "zod";

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
    }
},
{ timestamps: true });

const Trip = mongoose.models.Trip || mongoose.model('Trip', TripSchema);

export default Trip;