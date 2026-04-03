/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  Search,
  Users,
  UserMinus,
  Loader2,
  Send,
  Clock,
  XCircle,
  Inbox,
  Check,
} from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import FriendCard from "./FriendCard";

interface SearchedUser {
  userId: string;
  username: string;
  email: string;
  school?: string;
}

interface SentRequest {
  id: string;
  recipientName: string;
  recipientEmail: string;
  createdAt: string;
}

interface InboundRequest {
  id: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  createdAt: string;
}

interface FriendsProps {
  initialData?: {
    friends: SearchedUser[];
    sentRequests: SentRequest[];
    inboundRequests: InboundRequest[];
  };
}

export function Friends({ initialData }: FriendsProps) {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<
    "search" | "my-friends" | "sent" | "incoming"
  >("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchedUser[]>([]);
  const [friends, setFriends] = useState<SearchedUser[]>(
    initialData?.friends || [],
  );
  const [sentRequests, setSentRequests] = useState<SentRequest[]>(
    initialData?.sentRequests || [],
  );
  const [inboundRequests, setInboundRequests] = useState<InboundRequest[]>(
    initialData?.inboundRequests || [],
  );
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(!initialData);

  // References to track state inside the polling interval for cross-session sync
  const friendsRef = useRef(friends);
  const inboundRef = useRef(inboundRequests);
  const sentRef = useRef(sentRequests);

  useEffect(() => {
    friendsRef.current = friends;
    inboundRef.current = inboundRequests;
    sentRef.current = sentRequests;
  }, [friends, inboundRequests, sentRequests]);

  // Search debounce logic
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.length > 2) {
        searchUsers(query);
      } else {
        setResults([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  // Parallel pre-fetching and Polling loop for multi-session synchronization
  useEffect(() => {
    const loadSocialData = async () => {
      try {
        const [friendsRes, sentRes, inboundRes] = await Promise.all([
          fetch("/api/friends/manage"),
          fetch("/api/friends/sent"),
          fetch("/api/friends/request"),
        ]);

        if (friendsRes.ok) {
          const data = await friendsRes.json();
          if (JSON.stringify(data) !== JSON.stringify(friendsRef.current)) {
            setFriends(data);
          }
        }
        if (sentRes.ok) {
          const data = await sentRes.json();
          if (JSON.stringify(data) !== JSON.stringify(sentRef.current)) {
            setSentRequests(data);
          }
        }
        if (inboundRes.ok) {
          const data = await inboundRes.json();
          if (JSON.stringify(data) !== JSON.stringify(inboundRef.current)) {
            setInboundRequests(data);
          }
        }
      } catch (error) {
        console.error("Social data sync error:", error);
      } finally {
        setInitialLoad(false);
      }
    };

    if (session?.user) {
      loadSocialData();
      // Poll every 3 seconds so the sender's screen updates when you accept
      const interval = setInterval(loadSocialData, 3000);
      return () => clearInterval(interval);
    }
  }, [session]);

  const searchUsers = async (searchQuery: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/users/search?query=${encodeURIComponent(searchQuery)}`,
      );
      if (response.ok) {
        const data = await response.json();
        setResults(data);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const cancelRequest = async (requestId: string) => {
    try {
      const res = await fetch("/api/friends/request", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      if (res.ok) {
        setSentRequests((prev) => prev.filter((r) => r.id !== requestId));
      }
    } catch (error) {
      console.error("Cancel error:", error);
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      const res = await fetch("/api/friends/request", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      if (res.ok) {
        setInboundRequests((prev) => prev.filter((r) => r.id !== requestId));
      }
    } catch (error) {
      console.error("Decline error:", error);
    }
  };

  const handleAcceptRequest = async (
    requestId: string,
    senderId: string,
    senderName: string,
    senderEmail: string,
  ) => {
    try {
      const res = await fetch("/api/friends/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: requestId,
          senderId: senderId,
        }),
      });
      if (res.ok) {
        setInboundRequests((prev) => prev.filter((r) => r.id !== requestId));
        setFriends((prev) => [
          ...prev,
          { userId: senderId, username: senderName, email: senderEmail },
        ]);
        // Optional: Manual reload to force global component sync
        // window.location.reload();
      }
    } catch (error) {
      console.error("Accept error:", error);
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      const res = await fetch("/api/friends/remove", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId }),
      });
      if (res.ok)
        setFriends((prev) => prev.filter((f) => f.userId !== friendId));
    } catch (error) {
      console.error("Remove error:", error);
    }
  };

  const currentUserId = (session?.user as any)?.userId;

  return (
    <div className="min-h-screen bg-gray-50 text-black">
      <main className="flex-1 p-6 lg:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-1">
              Social Hub
            </h1>
            <p className="text-gray-600">
              Connect with fellow Boilermakers and manage your bridge.
            </p>
          </div>

          <div className="flex gap-2 p-1 bg-gray-200 rounded-xl mb-8 w-fit overflow-x-auto">
            <button
              onClick={() => setActiveTab("search")}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${activeTab === "search" ? "bg-white text-amber-700 shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <Search size={18} /> Search
            </button>
            <button
              onClick={() => setActiveTab("my-friends")}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${activeTab === "my-friends" ? "bg-white text-amber-700 shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <Users size={18} /> My Friends
              {!initialLoad && friends.length > 0 && (
                <span className="ml-2 bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                  {friends.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("incoming")}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${activeTab === "incoming" ? "bg-white text-amber-700 shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <Inbox size={18} /> Incoming
              {!initialLoad && inboundRequests.length > 0 && (
                <span className="ml-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {inboundRequests.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("sent")}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${activeTab === "sent" ? "bg-white text-amber-700 shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <Send size={18} /> Sent Requests
              {!initialLoad && sentRequests.length > 0 && (
                <span className="ml-2 bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                  {sentRequests.length}
                </span>
              )}
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-100">
            {activeTab === "search" && (
              <div className="p-6">
                <div className="relative mb-10 max-w-2xl">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                    size={20}
                  />
                  <Input
                    type="text"
                    placeholder="Search by username or email..."
                    className="pl-12 py-6 text-lg rounded-2xl border-gray-200 focus:ring-amber-500 shadow-sm text-black outline-none bg-white"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {loading ? (
                    <div className="col-span-full py-10 text-center text-gray-500">
                      Searching...
                    </div>
                  ) : (
                    results
                      .filter((u) => u.userId !== currentUserId)
                      .map((user) => (
                        <FriendCard
                          key={user.userId}
                          targetUserId={user.userId}
                          username={user.username}
                          email={user.email}
                          school={user.school}
                        />
                      ))
                  )}
                  {!loading && query.length > 2 && results.length === 0 && (
                    <div className="col-span-full py-10 text-center text-gray-500">
                      No users found.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "my-friends" && (
              <div className="divide-y divide-gray-100">
                {initialLoad ? (
                  <div className="p-20 text-center text-gray-500">
                    <Loader2 className="animate-spin mx-auto mb-2" />
                    Checking for friends...
                  </div>
                ) : friends.length > 0 ? (
                  friends.map((friend) => (
                    <div
                      key={friend.userId}
                      className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 font-bold">
                          {friend.username[0].toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {friend.username}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {friend.email}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFriend(friend.userId)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <UserMinus size={18} className="mr-2" /> Remove
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="p-20 text-center text-gray-500">
                    No friends yet.
                  </div>
                )}
              </div>
            )}

            {activeTab === "incoming" && (
              <div className="divide-y divide-gray-100">
                {initialLoad ? (
                  <div className="p-20 text-center text-gray-500">
                    <Loader2 className="animate-spin mx-auto mb-2" />
                    Checking incoming requests...
                  </div>
                ) : inboundRequests.length > 0 ? (
                  inboundRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-green-600">
                          <Inbox size={24} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {req.senderName}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {req.senderEmail} wants to connect
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleAcceptRequest(
                              req.id,
                              req.senderId,
                              req.senderName,
                              req.senderEmail,
                            )
                          }
                          className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                        >
                          <Check size={18} className="mr-2" /> Accept
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeclineRequest(req.id)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <XCircle size={18} className="mr-2" /> Decline
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-20 text-center text-gray-500">
                    No incoming requests right now.
                  </div>
                )}
              </div>
            )}

            {activeTab === "sent" && (
              <div className="divide-y divide-gray-100">
                {initialLoad ? (
                  <div className="p-20 text-center text-gray-500">
                    <Loader2 className="animate-spin mx-auto mb-2" />
                    Checking requests...
                  </div>
                ) : sentRequests.length > 0 ? (
                  sentRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                          <Clock size={24} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {req.recipientName}
                          </h3>
                          <p className="text-sm text-gray-500">
                            Sent to {req.recipientEmail}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelRequest(req.id)}
                        className="text-gray-400 hover:text-orange-600"
                      >
                        <XCircle size={18} className="mr-2" /> Cancel Request
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="p-20 text-center text-gray-500">
                    No pending outgoing requests.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
