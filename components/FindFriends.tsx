"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import FriendCard from "@/components/FriendCard";

// defines what a user object looks like from our search api
interface SearchedUser {
  userId: string;
  username: string;
  email: string;
  school?: string;
}

export function FindFriends() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchedUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // waits 500ms after you stop typing before running the search
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
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Find Friends</h1>

      <div className="mb-8">
        <input
          type="text"
          placeholder="Search by email..."
          className="w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-black"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {loading && <p className="text-gray-500">Searching...</p>}

        {/* loops through the results and creates a card for each user */}
        {!loading &&
          results.length > 0 &&
          results.map((user) => (
            <FriendCard
              key={user.userId}
              targetUserId={user.userId}
              username={user.username}
              email={user.email}
              school={user.school}
            />
          ))}

        {/* shows a message if nothing matches the email */}
        {!loading && query.length > 2 && results.length === 0 && (
          <p className="text-gray-500">No users found with that email.</p>
        )}
      </div>
    </div>
  );
}
