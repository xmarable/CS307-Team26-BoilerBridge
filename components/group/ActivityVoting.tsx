"use client";

import { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import Pusher from "pusher-js";

interface Props {
  activityId: string;
  groupId: string;
  initialUpvotes?: number;
  initialDownvotes?: number;
  userVote?: "up" | "down" | null;
}

export function ActivityVoting({
  activityId,
  groupId,
  initialUpvotes = 0,
  initialDownvotes = 0,
  userVote: initialUserVote = null,
}: Props) {
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [downvotes, setDownvotes] = useState(initialDownvotes);
  const [activeVote, setActiveVote] = useState<"up" | "down" | null>(
    initialUserVote,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    // Local dev without Pusher: skip realtime; voting still works via the API.
    if (!key || !cluster) {
      return;
    }

    const pusher = new Pusher(key, { cluster });

    const channel = pusher.subscribe(`group-${groupId}`);

    channel.bind(
      "vote-updated",
      (data: { activityId: string; upvotes: number; downvotes: number }) => {
        if (data.activityId === activityId) {
          setUpvotes(data.upvotes);
          setDownvotes(data.downvotes);
        }
      },
    );

    return () => {
      pusher.unsubscribe(`group-${groupId}`);
    };
  }, [activityId, groupId]);

  const handleVote = async (type: "up" | "down") => {
    if (loading) return;
    setLoading(true);

    const isRetracting = activeVote === type;
    const method = isRetracting ? "DELETE" : "POST";

    try {
      const res = await fetch(`/api/groups/${groupId}/itinerary/vote`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, type }),
      });

      if (res.ok) {
        const data = await res.json();
        setUpvotes(data.upvotes);
        setDownvotes(data.downvotes);
        setActiveVote(isRetracting ? null : type);
      }
    } catch (err) {
      console.error("failed to vote", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1 bg-gray-100/50 p-1 rounded-xl w-fit border border-gray-100">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleVote("up")}
        disabled={loading}
        className={`h-8 gap-1.5 px-2.5 rounded-lg transition-all ${
          activeVote === "up"
            ? "bg-white text-emerald-600 shadow-sm"
            : "text-gray-500"
        }`}
      >
        <ThumbsUp
          size={14}
          className={activeVote === "up" ? "fill-emerald-600" : ""}
        />
        <span className="text-xs font-black">{upvotes}</span>
      </Button>

      <div className="w-px h-4 bg-gray-200 mx-0.5" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleVote("down")}
        disabled={loading}
        className={`h-8 gap-1.5 px-2.5 rounded-lg transition-all ${
          activeVote === "down"
            ? "bg-white text-rose-600 shadow-sm"
            : "text-gray-500"
        }`}
      >
        <ThumbsDown
          size={14}
          className={activeVote === "down" ? "fill-rose-600" : ""}
        />
        <span className="text-xs font-black">{downvotes}</span>
      </Button>
    </div>
  );
}
