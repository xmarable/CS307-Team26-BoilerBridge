import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";
import ProfilePage from "@/components/ProfilePage";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";

export default async function MePage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) {
    redirect("/login");
  }

  const client = await clientPromise;
  const db = client.db("BoilerBridge");

  // Fetch the full user document from MongoDB
  const userData = await db.collection("users").findOne({
    email: session.user.email,
  });

  const initialData = {
    // Only use userData.name if it exists; DO NOT fallback to session.user.name
    name: userData?.name || "",
    email: userData?.email || session.user.email,
    image: userData?.image || session.user.image,
    username: userData?.username || (session.user as any).username || "",
    school: userData?.school || "",
    location: userData?.location || "",
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Navbar session={session} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-8 md:p-12 flex justify-center items-start">
          <ProfilePage initialData={initialData} />
        </main>
      </div>
    </div>
  );
}
