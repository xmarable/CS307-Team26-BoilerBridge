import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import { redirect } from "next/navigation";
import { SOSButton } from "@/components/SOSButton";

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
    },
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar session={enhancedSession} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="h-full">{children}</div>
        </main>
      </div>
      <SOSButton />
    </div>
  );
}
