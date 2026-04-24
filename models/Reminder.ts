import { Schema, Document, model, models } from "mongoose";

export interface IReminder extends Document {
  userId: string;
  groupID?: string;
  text: string;
  type: "task" | "notification";
  triggerTime?: Date;
  linkedEventId?: string;
  read: boolean;
  completed: boolean;
  createdAt: Date;
}

const ReminderSchema = new Schema<IReminder>({
  userId: { type: String, required: true },
  groupID: { type: String },
  text: { type: String, required: true },
  type: { type: String, enum: ["task", "notification"], default: "task" },
  triggerTime: { type: Date },
  linkedEventId: { type: String },
  read: { type: Boolean, default: false },
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// we index these fields so the cron job can find them fast.
ReminderSchema.index({ triggerTime: 1, completed: 1 });
ReminderSchema.index({ userId: 1, type: 1 });

export default models.Reminder || model<IReminder>("Reminder", ReminderSchema);
