import { Messages } from "@/components/group/Messages";
import { authOptions } from "@/lib/auth";
import { getUserGroups } from "@/lib/user";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export default async function MessagesPage() {
    const groups = await getUserGroups();
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId as string;

    if (groups == null) {
        redirect("/signin");
        return null;
    }

    if (!session) {
        redirect("/signin");
        return null;
    }

    return <Messages groups={groups} userId={userId}/>;
}