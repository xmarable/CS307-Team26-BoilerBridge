/* eslint-disable @typescript-eslint/no-explicit-any */
import { Navbar } from "@/components/Navbar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import TravelGroup from "@/models/TravelGroup";
import Trip from "@/models/Trip";
import FriendRequest from "@/models/FriendRequest";
import { redirect } from "next/navigation";
import { SOSButton } from "@/components/SOSButton";
import { Toaster } from "sonner";
import { DashboardWarmer } from "@/components/DashboardWarmer";
import { FetchErrorInterceptor } from "@/components/FetchErrorInterceptor";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) {
    redirect("/signin");
  }

  await dbConnect();

  const userData = await User.findOne(
    { email: session.user.email },
    {
      name: 1,
      username: 1,
      image: 1,
      userId: 1,
      "settings.security.isStudentVerified": 1,
    },
  ).lean();

  if (!userData) {
    redirect("/signin");
  }

  // logic: force the string conversion immediately and store it as a plain string lol
  const userIdString = userData.userId.toString();

  const [userGroups, pendingRequests, activeTrips] = await Promise.all([
    TravelGroup.find({ "membersList.userId": userData.userId }).lean(),
    FriendRequest.find({
      receiverId: userData.userId,
      status: "pending",
    }).lean(),
    Trip.find({ userId: userData.userId })
      .sort({ fromDate: 1 })
      .limit(5)
      .lean(),
  ]);

  const enhancedSession = {
    user: {
      name: userData.name || session.user.name || null,
      email: session.user.email,
      image: userData.image || session.user.image || null,
      username: userData.username || (session.user as any).username || null,
      userId: userIdString,
      isStudentVerified: !!userData.settings?.security?.isStudentVerified,
      groupCount: userGroups.length,
      pendingFriends: pendingRequests.length,
      hasActiveTrips: activeTrips.length > 0,
    },
    expires: session.expires,
  };

  return (
    <div className="min-h-screen bg-bb-surface-subtle dark:bg-bb-surface-subtle flex flex-col">
      <DashboardWarmer />
      <Navbar session={enhancedSession} />
      <main className="flex-1 overflow-y-auto">
        <div className="h-full">{children}</div>
      </main>
      <SOSButton />
      <FetchErrorInterceptor />
      <Toaster richColors position="top-center" />
    </div>
  );
}
