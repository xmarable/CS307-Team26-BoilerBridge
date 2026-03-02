export const dynamic = "force-dynamic";

import { Friends } from "@/components/Friends";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function FriendsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/signin");
    return null; // Ensure we don't render anything while redirecting
  }

  return <Friends />;
}
