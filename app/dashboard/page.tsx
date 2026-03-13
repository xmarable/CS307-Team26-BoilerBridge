export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/dbConnect";
import TravelGroup from "@/models/TravelGroup";
import User from "@/models/User";
import { Dashboard } from "@/components/Dashboard";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) {
    redirect("/signin");
  }

  await dbConnect();

  // 1. Fetch user data using Mongoose to get the UUID (userId)
  const userData = await User.findOne(
    { email: session.user.email },
    { name: 1, username: 1, image: 1, userId: 1 },
  ).lean();

  if (!userData) {
    redirect("/signin");
  }

  // 2. Fetch all groups where the user is a member
  const userGroups = await TravelGroup.find({
    "membersList.userId": userData.userId,
  }).lean();

  // 3. Clean the data for the Client Component
  const initialData = JSON.parse(
    JSON.stringify({
      displayName: userData.name || userData.username || "Boilermaker",
      profileImage: userData.image || null,
      groups: userGroups, // Passing real groups to the Dashboard component
    }),
  );

  return <Dashboard initialData={initialData} />;
}
