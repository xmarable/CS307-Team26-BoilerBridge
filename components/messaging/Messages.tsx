"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/button";
import { MessageSquare, Send } from "lucide-react";
import { Input } from "../ui/input";
import GroupList from "./GroupList";
import GroupMessagesPanel from "./GroupMessagesPanel";

type GroupSummary = {
    groupID: string;
    groupName: string;
    members: string[];
}

export function Messages({ groups, userId }: { groups: GroupSummary[], userId: string }) {
    const [activeGroupId, setActiveGroupId] = useState<string | null>();
    const activeGroup = groups.find((g) => g.groupID === activeGroupId) ?? null

    return (
        <div className="min-h-screen bg-gray-50 text-black">
            <main className="flex-1 p-6 lg:p-8">
                <div className="max-w-6xl mx-auto">
                    {/* Page heading */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-1">Messages</h1>
                        <p className="text-gray-600">
                            Stay in touch with your travel groups and keep plans moving.
                        </p>
                    </div>

                    {/* Main card */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[650px]">
                        <div className="grid md:grid-cols-[280px_minmax(0,1fr)] h-[650px] overflow-hidden">
                            {/* Left side: group list */}
                            < GroupList 
                                groups={groups}
                                activeGroupId={activeGroupId}
                                setActiveGroupId={setActiveGroupId}
                            />

                            {/* Right side: messages */}
                            <GroupMessagesPanel
                                activeGroup={activeGroup}
                                userId={userId}
                            />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}