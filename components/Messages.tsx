"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import { MessageSquare, Send } from "lucide-react";
import { Input } from "./ui/input";

type MessageSummary = {
    senderID: string;
    content: string;
}

export function Messages({ groups, userId }: { groups: any[], userId: string }) {
    const initialGroupId = groups[0]?.groupID
    const [messages, setMessages] = useState<MessageSummary[]>([])
    const [activeGroupId, setActiveGroupId] = useState<string | null>();
    const [message, setMessage] = useState("");

    const activeGroup = useMemo(
        () => groups.find((g) => g.groupID === activeGroupId) ?? null,
        [groups, activeGroupId]
    );

    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        const res = await fetch(`/api/groups/${activeGroupId}/messages`, { 
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                content: message
            }),
            credentials: "include"
        });

        const data = await res.json().catch(() => {

        })

        setMessage("");
    }

    const getMessages = async (groupId: string) => {
        await fetch(`/api/groups/${groupId}/messages`, { credentials: "include" }).then((res) => {
            if (res.status === 401) return null;
            return res.json();
        }).then((data) => {
            if (data?.messages) setMessages(data.messages);
        }).catch().finally();
        console.log(messages);
    }

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
                            <div className="border-r border-gray-200 bg-gray-50/50 flex flex-col">
                                <div className="p-4 border-b border-gray-200 bg-white">
                                    <h2 className="font-semibold text-gray-900">Your Groups</h2>
                                    <p className="text-sm text-gray-500">
                                        Select a group to view messages
                                    </p>
                                </div>

                                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                    {groups.length > 0 ? (
                                        groups.map((g) => {
                                            const isActive = g.groupID === activeGroupId;

                                            return (
                                                <button
                                                    key={g.groupID}
                                                    onClick={() => {
                                                        setActiveGroupId(g.groupID);
                                                        getMessages(g.groupID);
                                                    }}
                                                    className={`w-full text-left p-4 rounded-xl border transition-all ${isActive
                                                            ? "bg-white border-amber-200 shadow-sm"
                                                            : "bg-transparent border-transparent hover:bg-white hover:border-gray-200"
                                                        }`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p
                                                                className={`font-semibold truncate ${isActive ? "text-amber-700" : "text-gray-900"
                                                                    }`}
                                                            >
                                                                {g.groupName}
                                                            </p>
                                                            <p className="text-sm text-gray-500 truncate">
                                                                {g.members?.length ?? 0} members
                                                            </p>
                                                        </div>

                                                        <div
                                                            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isActive
                                                                    ? "bg-amber-100 text-amber-700"
                                                                    : "bg-gray-100 text-gray-500"
                                                                }`}
                                                        >
                                                            <MessageSquare size={18} />
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    ) : (
                                        <div className="p-6 text-sm text-center text-gray-500">
                                            No groups yet.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right side: messages */}
                            <div className="flex flex-col min-w-0 min-h-0">
                                {/* Chat header */}
                                <div className="p-5 border-b border-gray-200 bg-white">
                                    {activeGroup ? (
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 font-bold">
                                                {activeGroup.groupName?.[0]?.toUpperCase() ?? "G"}
                                            </div>
                                            <div className="min-w-0">
                                                <h2 className="font-semibold text-gray-900 truncate">
                                                    {activeGroup.groupName}
                                                </h2>
                                                <p className="text-sm text-gray-500">
                                                    Group conversation
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <h2 className="font-semibold text-gray-900">
                                                No Group Selected
                                            </h2>
                                            <p className="text-sm text-gray-500">
                                                Choose a group from the left to start chatting.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Messages body */}
                                <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-white">
                                    {activeGroup ? (
                                        <div className="space-y-4">
                                            {/* Placeholder messages */}
                                            {messages.map((m, i) => (
                                                <div key={`${m.senderID}-${i}`} className={`flex ${m.senderID === userId ? "justify-end" : "justify-start"}`}>
                                                    <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                                                        m.senderID === userId
                                                            ? "bg-amber-500 text-white"
                                                            : "bg-gray-100 test-gray-800"
                                                    }`}>
                                                        {m.content}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-center text-gray-500">
                                            <div>
                                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                                    <MessageSquare size={28} />
                                                </div>
                                                <p className="font-medium text-gray-700 mb-1">
                                                    No conversation selected
                                                </p>
                                                <p className="text-sm text-gray-500">
                                                    Pick a group on the left to view messages.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Composer */}
                                <div className="shrink-0 p-4 border-t border-gray-200 bg-white">
                                    <form
                                        className="flex items-center gap-3"
                                        onSubmit={handleSubmit}
                                    >
                                        <Input
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            placeholder={
                                                activeGroup
                                                    ? `Message ${activeGroup.groupName}...`
                                                    : "Select a group to start messaging"
                                            }
                                            disabled={!activeGroup}
                                            className="rounded-xl border-gray-200 bg-white text-black"
                                        />
                                        <Button
                                            type="submit"
                                            disabled={!activeGroup || !message.trim()}
                                            className="bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl shadow-sm"
                                        >
                                            <Send size={18} className="mr-2" />
                                            Send
                                        </Button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}