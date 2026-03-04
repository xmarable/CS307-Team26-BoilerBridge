export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";
import { Dashboard } from "@/components/Dashboard";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const sessionPromise = getServerSession(authOptions);
  const clientPromiseConn = clientPromise;

  const [session, client] = await Promise.all([
    sessionPromise,
    clientPromiseConn,
  ]);

  if (!session || !session.user?.email) {
    redirect("/signin");
  }

  const db = client.db("BoilerBridge");

  // Fetch name and image for the total "intact" look
  const userData = await db
    .collection("users")
    .findOne(
      { email: session.user.email },
      { projection: { name: 1, username: 1, image: 1 } },
    );

  const initialData = {
    displayName: userData?.name || userData?.username || "Boilermaker",
    profileImage: userData?.image || null,
  };

  return <Dashboard initialData={initialData} />;
}
