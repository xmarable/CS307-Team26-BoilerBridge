"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Search, Users } from "lucide-react";
import { Input } from "./ui/input";
import FriendCard from "./FriendCard";

interface SearchedUser {
  userId: string;
  username: string;
  email: string;
  school?: string;
}

export function FindFriends() {
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchedUser[]>([]);
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

  return (
    <div className="min-h-screen bg-gray-50 text-black">
      <div className="flex">
        <main className="flex-1 p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-1">
                Find Friends
              </h1>
              <p className="text-gray-600">
                Search for fellow Boilermakers and plan your next adventure.
              </p>
            </div>
            <div className="relative mb-10 max-w-2xl">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={20}
              />
              <Input
                type="text"
                placeholder="Search by email..."
                className="pl-12 py-6 text-lg rounded-2xl border-gray-200 focus:ring-amber-500 shadow-sm text-black outline-none"
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
                results.map((user) => (
                  <FriendCard
                    key={user.userId}
                    targetUserId={user.userId}
                    username={user.username}
                    email={user.email}
                    school={user.school}
                  />
                ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
