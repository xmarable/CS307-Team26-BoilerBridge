import { Messages } from "@/components/messaging/Messages";
import { authOptions } from "@/lib/auth";
import { getUserGroups } from "@/lib/user";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function MessagesPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) {
    redirect("/signin");
    return null;
  }

   
  const userId = (session?.user as any)?.userId as string;
  const groups = await getUserGroups();

  if (groups == null) {
    redirect("/dashboard");
    return null;
  }

  const sanitizedGroups = JSON.parse(JSON.stringify(groups));

  return (
    <div className="h-[calc(100vh-64px)] overflow-hidden bg-white">
      <Messages groups={sanitizedGroups} userId={userId} />
    </div>
  );
}
