import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import TravelGroup from "@/models/TravelGroup";
import User from "@/models/User";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";
import sgMail from "@sendgrid/mail"

const MessageSchema = z.object({
  topic: z.string().min(1, "Topic cannot be empty"),
  content: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(500, "Message too long"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const session = await getServerSession(authOptions);

  const userId = (session?.user as any)?.userId as string | undefined;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();
  const user = await User.findOne({ userId: userId });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { groupId } = await params;
  const group = await TravelGroup.findOne({ groupID: groupId });

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  if (
    !group.membersList.some(
      (m: any) => m.userId.toString() === userId && m.role === "Leader",
    )
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const message = MessageSchema.safeParse(body);
  if (!message.success) {
    return NextResponse.json(
      { error: "Invalid Message", details: message.error.flatten() },
      { status: 400 },
    );
  }

  const { topic, content } = message.data;

  const newNotification = {
    topic: topic,
    content: content,
    sentAt: new Date()
  };

  const memberIds = group.membersList.map((m: any) => m.userId.toString()).filter((id: string) => id !== userId);
  const notifiableMembers = await User.find({
    userId: { $in: memberIds },
    "settings.notifications.groupNotifications": true
  })

  sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);
  console.log(notifiableMembers);

  for (const member of notifiableMembers) {
    console.log("member:", member);
    console.log("member.email:", member.email);

    const email = member.email;
    const msg = {
      to: email,
      from: "boilerbridge307@gmail.com",
      subject: `New Message from ${group.groupName}`,
      text: content,
      html:`
            <h3>You have recieved a new message from ${user.username}</h3>
            <p>${content}</p>
          `
    }
    //console.log(JSON.stringify(msg));

    try {
      await sgMail.send(msg);
      console.log(`Email notif sent to ${email}`);
    } catch (e) {
      console.error("Sendgrid Error:", e);
    }
  }
   
  group.notifications.push(newNotification as any);
  await group.save();

  // TODO send sms' with twilio

  return NextResponse.json({ notification: newNotification }, { status: 201 });
}
