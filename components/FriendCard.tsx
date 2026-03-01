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
    // ONLY show the error if the session is confirmed unauthenticated
    if (sessionStatus === "unauthenticated") {
      setErrorMessage("You must be logged in");
      return;
    }

    // Wait if the session is still fetching to avoid sending 'undefined'
    if (sessionStatus === "loading" || !session?.user?.id) {
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterId: session.user.id,
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

  const isSelf = session?.user?.id === targetUserId;

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
            // Disable if session is loading to prevent early clicks
            disabled={
              status === "loading" ||
              status === "sent" ||
              sessionStatus === "loading"
            }
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
              status === "sent"
                ? "bg-green-100 text-green-700 cursor-default"
                : status === "error"
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300"
            }`}
          >
            {sessionStatus === "loading"
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
