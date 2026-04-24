/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from "next/server";
import dbConnect from "../../../../lib/dbConnect";
import Reminder from "../../../../models/Reminder";
import { sendActualPush } from "../../../../lib/notifications";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && searchParams.get("key") !== cronSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await dbConnect();
    const now = new Date();

    const dueReminders = await Reminder.find({
      type: "notification",
      triggerTime: { $lte: now },
      completed: false,
    });

    if (dueReminders.length === 0) {
      return NextResponse.json({ message: "no reminders due" });
    }

    const results = await Promise.all(
      dueReminders.map(async (reminder) => {
        try {
          await sendActualPush(reminder.userId, reminder.text);
          reminder.completed = true;
          await reminder.save();
          return { id: reminder._id, status: "sent" };
        } catch (err) {
          return { id: reminder._id, status: "failed" };
        }
      }),
    );

    return NextResponse.json({ processed: dueReminders.length, results });
  } catch (error) {
    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 },
    );
  }
}
