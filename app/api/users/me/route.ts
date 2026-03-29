import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";
import { uploadImage } from "@/lib/cloudinary";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import z from "zod";
import bcrypt from "bcryptjs"

const SettingsSchema = z.object({
  tripReminders: z.boolean().optional(),
  friendRequests: z.boolean().optional(),
  groupInvites: z.boolean().optional(),
  groupNotifications: z.boolean().optional(),
  newPassword: z.string().min(8).max(64).optional(),
  deleteAccount: z.boolean().optional(),
  deletionReason: z.string().optional()
});

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unaauthorized" }, { status: 401 });
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
    deleteAccount,
    deletionReason
  } = parsed.data;

  await dbConnect();
  const user = await User.findOne({ email: session.user.email })
  if (!user) {
    return NextResponse.json({ errror: "User not found" }, { status: 404 });
  }

  if (deleteAccount !== undefined) {
    user.settings.deletion.requested = deleteAccount;
    user.settings.deletion.reason = deletionReason;
  }

  if (tripReminders !== undefined) {
    user.settings.notifications.tripReminders = tripReminders;
  }

  if (friendRequests !== undefined) {
    user.settings.notifications.friendRequests = friendRequests;
  }

  if (groupInvites !== undefined) {
    user.settings.notifications.groupInvites = groupInvites;
  }

  if (groupNotifications !== undefined) {
    user.settings.notifications.groupNotifications = groupNotifications;
  }

  if (newPassword !== undefined) {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    user.settings.security.passwordLastChanged = new Date();
  }

  await user.save();

  return NextResponse.json({ messages: "Success" }, { status: 200 });
}
