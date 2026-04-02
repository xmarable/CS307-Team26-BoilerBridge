import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";
import ProfilePage from "@/components/ProfilePage";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import SettingsPage from "@/components/SettingsPage";

export default async function MePage() {
  await dbConnect();
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) {
    redirect("/signin");
  }
  
  const dbUser = await User.findOne({ email: session.user.email }).lean();

  if (!dbUser) {
    redirect("/signin");
  }

  const profileData = {
    // Only use dbUser.name if it exists; DO NOT fallback to session.user.name
    name: dbUser?.name || "",
    email: dbUser?.email || session.user.email,
    image: dbUser?.image || session.user.image,
    username: dbUser?.username || (session.user as any).username || "",
    school: dbUser?.school || "",
    location: dbUser?.location || "",
    isStudentVerified: Boolean(dbUser?.settings?.security?.isStudentVerified),
    eduEmail: dbUser?.eduEmail || null,
  };

  const settingsData = {
    tripReminders: dbUser.settings.notifications.tripReminders,
    friendRequests: dbUser.settings.notifications.friendRequests,
    groupInvites: dbUser.settings.notifications.groupInvites,
    groupNotifitaions: dbUser.settings.notifications.groupNotifitaions,
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="flex flex-1 overflow-hidden">
        <main className="gap-8 flex-1 overflow-y-auto p-8 md:p-12 flex justify-center items-start">
          <ProfilePage initialData={profileData} />
          <SettingsPage initialData={settingsData} />
        </main>
      </div>
    </div>
  );
}
