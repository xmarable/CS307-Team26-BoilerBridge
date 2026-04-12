import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";
import { uploadImage } from "@/lib/cloudinary";
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
    return NextResponse.json({ errror: "User not found" }, { status: 404 });
  }

  user.settings.deletion = {
    requested: true,
    reason: deletionReason
  }

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
  const user = await User.findOne({ email: session.user.email })
  if (!user) {
    return NextResponse.json({ errror: "User not found" }, { status: 404 });
  }

  if (tripReminders !== undefined) {
    user.settings.notifications.tripReminders.inApp = tripReminders.inApp;
    user.settings.notifications.tripReminders.email = tripReminders.email;
  }

  if (friendRequests !== undefined) {
    user.settings.notifications.friendRequests.inApp = friendRequests.inApp;
    user.settings.notifications.friendRequests.email = friendRequests.inApp;
  }

  if (groupInvites !== undefined) {
    user.settings.notifications.groupInvites.inApp = groupInvites.inApp;
    user.settings.notifications.groupInvites.email = groupInvites.email;
  }

  if (groupNotifications !== undefined) {
    user.settings.notifications.groupNotifications.inApp = groupNotifications.inApp;
    user.settings.notifications.groupNotifications.email = groupNotifications.email;
  }

  if (newPassword !== undefined) {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    user.settings.security.passwordLastChanged = new Date();
  }

  await user.save();

  return NextResponse.json({ messages: "Success" }, { status: 200 });
}
