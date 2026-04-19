"use client"

import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

type GroupSummary = {
    groupID: string;
    groupName: string;
}

type MessageSummary = {
    senderID: string;
    content: string;
}

export default function GroupMessagesPanel({ activeGroup, userId }: { activeGroup: GroupSummary | null, userId: string }) {
    const [messages, setMessages] = useState<MessageSummary[]>([])
    const [message, setMessage] = useState("");
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [atBottom, setAtBottom] = useState(true);

    const handleScroll = () => {
        const cont = containerRef.current;
        if (!cont) return;

        const tolerance = 100;
        const atBottom = cont.scrollHeight - cont.scrollTop - cont.clientHeight < tolerance;

        setAtBottom(atBottom);
    }

    useEffect(() => {
        const cont = containerRef.current;
        if (!cont) return;

        if (atBottom) {
            cont.scrollTop = cont.scrollHeight;
        }
    }, [messages])

    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!activeGroup) return;

        const res = await fetch(`/api/groups/${activeGroup?.groupID}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                content: message
            }),
            credentials: "include"
        });

        if (!res.ok) return;

        setMessages((prev) => [
            ...prev,
            {
                senderID: userId,
                content: message
            }
        ])

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

    useEffect(() => {
        if (!activeGroup) {
            return;
        }

        const fetchMessages = () => getMessages(activeGroup.groupID);

        fetchMessages();
        const interval = setInterval(fetchMessages, 3000);

        return () => clearInterval(interval);

    }, [activeGroup])

    return (
        <div className="flex flex-col min-w-0 min-h-0 h-full">
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
                ) : ( <div></div> )}
            </div>

            {/* Messages body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-white" ref={containerRef} onScroll={handleScroll}>
                <div className="space-y-4">
                    {/* Placeholder messages */}
                    {messages.map((m, i) => (
                        <div key={`${m.senderID}-${i}`} className={`flex ${m.senderID === userId ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${m.senderID === userId
                                    ? "bg-amber-500 text-white"
                                    : "bg-gray-100 text-gray-800"
                                }`}>
                                {m.content}
                            </div>
                        </div>
                    ))}
                </div>
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
    );
}