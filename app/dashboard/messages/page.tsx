import { Messages } from "@/components/Messages";
import { authOptions } from "@/lib/auth";
import { getUserGroups } from "@/lib/user";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export default async function MessagesPage() {
    const groups = await getUserGroups();
    const session = await getServerSession(authOptions);

    if (groups == null) {
        return <div>Sign In</div>
    }

    if (groups.length == 0) {
        return <div>No Groups</div>
    }

    return <Messages groups={groups} userId={(session?.user as any)?.userId}/>;
}