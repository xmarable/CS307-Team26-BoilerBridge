/* eslint-disable @typescript-eslint/no-explicit-any */
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
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
import { Header } from "@/components/Header";


export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) {
    return (
      <div className="flex flex-col">
        <Header />
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <div className="flex flex-1 overflow-hidden">
            {session && <Sidebar />}
            <main className="flex-1 overflow-y-auto pt-20">
              <div className="h-full">{children}</div>
            </main>
          </div>
          <SOSButton />
          <Toaster richColors position="top-center" />
        </div>
      </div>
    );
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar session={enhancedSession} />
      <div className="flex flex-1 overflow-hidden">
        {session && <Sidebar />}
        <main className="flex-1 overflow-y-auto">
          <div className="h-full">{children}</div>
        </main>
      </div>
      <SOSButton />
      <Toaster richColors position="top-center" />
    </div>
  );
}
