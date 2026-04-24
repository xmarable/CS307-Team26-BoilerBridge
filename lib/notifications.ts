import TravelGroup from "@/models/TravelGroup";
import Reminder from "../models/Reminder";
import User from "@/models/User";
import Notification from "@/models/Notification";

/**
 * schedules a reminder in the database for the cron job to pick up
 */
export const scheduleReminder = async (
  userId: string,
  text: string,
  triggerTime: Date,
  groupID?: string,
) => {
  return await Reminder.create({
    userId,
    text,
    type: "notification",
    triggerTime,
    groupID,
    read: false,
    completed: false,
  });
};

/**
 * logic to send an actual out-of-app push notification
 * currently logs to console; replace with web-push or FCM for production
 */
export const sendActualPush = async (userId: string, message: string) => {
  // logic for web-push or firebase-admin goes here
  console.log(`[PUSH SENT] to user: ${userId} | message: ${message}`);
  return Promise.resolve();
};

export async function createTripNotif({
  groupID,
  message,
  userId
}: {
  groupID: string,
  message: string,
  userId: string
}) {
  const group = await TravelGroup.findOne({ groupID: groupID });
  if (!group) {
    return { createdCount: 0 };
  }

  const members = group.membersList.map((m) => m.userId).filter((id) => id !== userId);

  const users = await User.find({
    userId: { $in: members },
    "settings.notifications.tripReminders.inApp": true
  });

  if (users.length === 0) {
    return { createdCount: 0 };
  }

  const notifications = users.map((u) => ({
    recipientID: u.userId,
    type: "trip",
    groupID: groupID,
    message: message
  }));

  await Notification.insertMany(notifications);

  return { createdCount: notifications.length };
}