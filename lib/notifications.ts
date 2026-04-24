import Reminder from "../models/Reminder";

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
