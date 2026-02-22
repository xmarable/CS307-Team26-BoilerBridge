import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITravelGroup extends Document {
  groupId: string;          // UUID or other unique string used in URLs
  name: string;
  createdBy: string;        // User.userId (UUID)
  members: string[];        // array of User.userId (UUIDs)
  admins: string[];         // subset of members
  createdAt: Date;
  updatedAt: Date;
}

const TravelGroupSchema = new Schema<ITravelGroup>(
  {
    groupId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: String,
      required: true,
      index: true,
    },
    members: {
      type: [String],
      default: [],
    },
    admins: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

// Ensure creator is member + admin if not explicitly added
TravelGroupSchema.pre("save", async function () {
    const g = this as ITravelGroup;
  
    if (g.createdBy) {
      if (!g.members.includes(g.createdBy)) g.members.push(g.createdBy);
      if (!g.admins.includes(g.createdBy)) g.admins.push(g.createdBy);
    }
});

const TravelGroup: Model<ITravelGroup> =
  mongoose.models.TravelGroup ||
  mongoose.model<ITravelGroup>("TravelGroup", TravelGroupSchema);

export default TravelGroup;