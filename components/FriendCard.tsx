/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

interface FriendCardProps {
  targetUserId: string;
  username: string;
  email: string;
  school?: string;
}

export default function FriendCard({
  targetUserId,
  username,
  email,
  school,
}: FriendCardProps) {
  const { data: session, status: sessionStatus } = useSession();
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState("");

  const handleAddFriend = async () => {
    if (sessionStatus === "unauthenticated") {
      setErrorMessage("You must be logged in");
      return;
    }

    // THE FIX: use session.user.userId (the UUID) instead of session.user.id
    const requesterUserId = (session?.user as any)?.userId;

    if (sessionStatus === "loading" || !requesterUserId) {
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterId: requesterUserId,
          recipientId: targetUserId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send request");
      }

      setStatus("sent");
    } catch (err) {
      setStatus("error");
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("An unknown error occurred");
      }
    }
  };

  const currentUserId = (session?.user as any)?.userId;
  const isSelf = currentUserId === targetUserId;

  const userFriendsList =
    (session?.user as any)?.friendsList ||
    (session?.user as any)?.friends ||
    [];

  // logic fix: ensure we compare strings to strings for the includes check
  const isAlreadyFriend = userFriendsList.some(
    (id: any) => id.toString() === targetUserId.toString(),
  );

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg shadow-sm bg-white mb-3">
      <div className="flex flex-col">
        <span className="font-bold text-lg text-gray-800">{username}</span>
        <span className="text-sm text-gray-500">{email}</span>
        {school && (
          <span className="text-xs text-blue-600 font-medium">{school}</span>
        )}
      </div>

      <div className="flex flex-col items-end">
        {!isSelf && (
          <button
            onClick={handleAddFriend}
            disabled={
              status === "loading" ||
              status === "sent" ||
              sessionStatus === "loading" ||
              isAlreadyFriend
            }
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
              isAlreadyFriend
                ? "bg-gray-100 text-gray-500 cursor-default border border-gray-200"
                : status === "sent"
                  ? "bg-green-100 text-green-700 cursor-default"
                  : status === "error"
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300"
            }`}
          >
            {isAlreadyFriend
              ? "Friends"
              : sessionStatus === "loading"
                ? "Checking..."
                : status === "loading"
                  ? "Sending..."
                  : status === "sent"
                    ? "Request Sent"
                    : "Add Friend"}
          </button>
        )}

        {errorMessage && (
          <span className="text-xs text-red-500 mt-1 max-w-36 text-right">
            {errorMessage}
          </span>
        )}
      </div>
    </div>
  );
}
