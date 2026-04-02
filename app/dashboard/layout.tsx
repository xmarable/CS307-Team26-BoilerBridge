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
import { DashboardWarmer } from "@/components/DashboardWarmer";
import { Toaster } from "sonner";

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

  // Fetch the full user document to get the UUID and preferred display names
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

  // extract the userId for parallel data pre-fetching
  const userId = userData.userId;

  // 1. start parallel fetches to "warm up" all dashboard dependencies
  // this ensures that data for groups, trips, and friends is cached or ready
  const [userGroups, pendingRequests, activeTrips] = await Promise.all([
    TravelGroup.find({ "membersList.userId": userId }).lean(),
    FriendRequest.find({ receiverId: userId, status: "pending" }).lean(),
    Trip.find({ userId: userId }).sort({ fromDate: 1 }).limit(5).lean(),
  ]);

  // Create an enhanced session object to pass down to Nav and Sidebar
  const enhancedSession = {
    ...session,
    user: {
      ...session.user,
      name: userData.name || session.user.name,
      image: userData.image || session.user.image,
      username: userData.username || (session.user as any).username,
      userId: userData.userId, // Critical for routing and role checks
      isStudentVerified:
        userData.settings?.security?.isStudentVerified || false, // added for navbar check
      // injecting pre-fetched metadata into the session context
      groupCount: userGroups.length,
      pendingFriends: pendingRequests.length,
      hasActiveTrips: activeTrips.length > 0,
    },
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* this starts the background loading immediately */}
      <DashboardWarmer />
      <Navbar session={enhancedSession} />
      <div className="flex flex-1 overflow-hidden">
        {/* passing enhanced session to sidebar if it needs pre-fetched counts */}
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="h-full">{children}</div>
        </main>
      </div>
      <SOSButton />
      <Toaster richColors position="top-center" />
    </div>
  );
}
