import { randomUUID } from "crypto";
import mongoose from "mongoose";
import { unique } from "next/dist/build/utils";

const itenerarySchema = new mongoose.Schema(
    {
        iteneraryID: {
            type: mongoose.Schema.Types.UUID,
            default: () => randomUUID(),
            unique: true
        },
        settings: {
            isShareable: {
                type: Boolean,
                default: false
            }
        },
        token: {
            type: String,
            default: ""
        }
    }
)

const Itenerary = 
    mongoose.models.Itenerary || 
    mongoose.model("Itenerary", itenerarySchema);
export default Itenerary;