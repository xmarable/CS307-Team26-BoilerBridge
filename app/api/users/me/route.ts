import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import z from "zod";
import bcrypt from "bcryptjs"

const NotificationSettingsSchema = z.object({
  inApp: z.boolean().optional(),
  email: z.boolean().optional()
})

const SettingsSchema = z.object({
  tripReminders: NotificationSettingsSchema.optional(),
  friendRequests: NotificationSettingsSchema.optional(),
  groupInvites: NotificationSettingsSchema.optional(),
  groupNotifications: NotificationSettingsSchema.optional(),
  newPassword: z.string().min(8).max(64).optional(),
  deleteAccount: z.boolean().optional(),
  deletionReason: z.string().optional()
});

const UserDeletionSchema = z.object({
  deletionReason: z.string().max(200).optional()
});

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = UserDeletionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Malformed deletion data" }, { status: 400 });
  }

  const { deletionReason } = parsed.data;

  await dbConnect();
  const user = await User.findOne({ email: session.user.email })
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  user.settings.deletion = {
    requested: true,
    requestedAt: new Date(),
    reason: deletionReason,
  };

  await user.save();

  return NextResponse.json({ message: "Success" }, { status: 200 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = SettingsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Malformed settings data" }, { status: 400 });
  }

  const { 
    tripReminders, 
    friendRequests, 
    groupInvites, 
    groupNotifications, 
    newPassword,
  } = parsed.data;

  await dbConnect();

  const $set: Record<string, unknown> = {};

  if (tripReminders !== undefined) {
    $set["settings.notifications.tripReminders"] = {
      inApp: tripReminders.inApp ?? false,
      email: tripReminders.email ?? false,
    };
  }

  if (friendRequests !== undefined) {
    $set["settings.notifications.friendRequests"] = {
      inApp: friendRequests.inApp ?? false,
      email: friendRequests.email ?? false,
    };
  }

  if (groupInvites !== undefined) {
    $set["settings.notifications.groupInvites"] = {
      inApp: groupInvites.inApp ?? false,
      email: groupInvites.email ?? false,
    };
  }

  if (groupNotifications !== undefined) {
    $set["settings.notifications.groupNotifications"] = {
      inApp: groupNotifications.inApp ?? false,
      email: groupNotifications.email ?? false,
    };
  }

  if (newPassword !== undefined) {
    $set["passwordHash"] = await bcrypt.hash(newPassword, 10);
    $set["settings.security.passwordLastChanged"] = new Date();
  }

  const updated = await User.findOneAndUpdate(
    { email: session.user.email },
    { $set },
    { new: true },
  );

  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Success" }, { status: 200 });
}
