"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Search, Users, UserMinus, Loader2 } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import FriendCard from "./FriendCard";

interface SearchedUser {
  userId: string;
  username: string;
  email: string;
  school?: string;
}

export function Friends() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"search" | "my-friends">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchedUser[]>([]);
  const [friends, setFriends] = useState<SearchedUser[]>([]);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (activeTab === "my-friends") {
      fetchMyFriends();
    }
  }, [activeTab]);

  const searchUsers = async (searchEmail: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/users/search?email=${encodeURIComponent(searchEmail)}`,
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

  const fetchMyFriends = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/friends/manage");
      if (res.ok) {
        const data = await res.json();
        setFriends(data);
      }
    } catch (error) {
      console.error("Fetch friends error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!confirm("Are you sure you want to remove this friend?")) return;
    try {
      const res = await fetch("/api/friends/remove", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId }),
      });
      if (res.ok) {
        setFriends((prev) => prev.filter((f) => f.userId !== friendId));
      }
    } catch (error) {
      console.error("Remove error:", error);
    }
  };

  const currentUserId = (session?.user as any)?.userId;

  return (
    <div className="min-h-screen bg-gray-50 text-black">
      <div className="flex">
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

            {/* Tab Switcher - Standardized Style */}
            <div className="flex gap-2 p-1 bg-gray-200 rounded-xl mb-8 w-fit">
              <button
                onClick={() => setActiveTab("search")}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all ${
                  activeTab === "search"
                    ? "bg-white text-amber-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Search size={18} />
                Find Friends
              </button>
              <button
                onClick={() => setActiveTab("my-friends")}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all ${
                  activeTab === "my-friends"
                    ? "bg-white text-amber-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Users size={18} />
                My Friends
              </button>
            </div>

            {activeTab === "search" ? (
              <>
                <div className="relative mb-10 max-w-2xl">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                    size={20}
                  />
                  <Input
                    type="text"
                    placeholder="Search by email..."
                    className="pl-12 py-6 text-lg rounded-2xl border-gray-200 focus:ring-amber-500 shadow-sm text-black outline-none bg-white"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>

                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {loading && (
                    <div className="col-span-full py-10 text-center text-gray-500 animate-pulse">
                      Searching the database...
                    </div>
                  )}
                  {!loading &&
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
                      ))}
                </div>
              </>
            ) : (
              /* My Friends Management List */
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {loading ? (
                  <div className="p-20 flex flex-col items-center text-gray-500">
                    <Loader2 className="animate-spin mb-2" />
                    <p>Loading your friends...</p>
                  </div>
                ) : friends.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {friends.map((friend) => (
                      <div
                        key={friend.userId}
                        className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 font-bold text-lg">
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
                          className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <UserMinus size={18} className="mr-2" />
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-20 text-center">
                    <Users className="mx-auto text-gray-300 mb-4" size={48} />
                    <h3 className="text-gray-900 font-medium">
                      No friends yet
                    </h3>
                    <p className="text-gray-500 text-sm mb-6">
                      Start searching to build your travel crew!
                    </p>
                    <Button
                      onClick={() => setActiveTab("search")}
                      variant="outline"
                    >
                      Find People
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
