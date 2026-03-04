import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Parallel fetch for session and DB connection
  const [session, client] = await Promise.all([
    getServerSession(authOptions),
    clientPromise,
  ]);

  if (!session || !session.user?.email) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar session={session} />
        <div className="flex">
          <Sidebar />
          <main className="flex-1">{children}</main>
        </div>
      </div>
    );
  }

  const db = client.db("BoilerBridge");

  const userData = await db
    .collection("users")
    .findOne(
      { email: session.user.email },
      { projection: { name: 1, username: 1, image: 1 } },
    );

  const enhancedSession = {
    ...session,
    user: {
      ...session.user,
      name: userData?.name || session.user.name,
      image: userData?.image || session.user.image,
      username: userData?.username || (session.user as any).username,
    },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* navbar gets display name and pfp instantly */}
      <Navbar session={enhancedSession} />
      <div className="flex">
        <Sidebar />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
