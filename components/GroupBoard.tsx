"use client";

import { useState } from "react";
import { Pin, Trash2, Megaphone, Clock, User as UserIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { formatDistanceToNow } from "date-fns";

interface Announcement {
  announcementID: string;
  content: string;
  pinnedBy: string;
  timestamp: string;
}

interface GroupBoardProps {
  groupId: string;
  initialAnnouncements: Announcement[];
  isLeader: boolean; // for user story 3
}

export function GroupBoard({
  groupId,
  initialAnnouncements,
  isLeader,
}: GroupBoardProps) {
  const [announcements, setAnnouncements] =
    useState<Announcement[]>(initialAnnouncements);
  const [newContent, setNewContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePostAnnouncement = async () => {
    if (!newContent.trim()) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/groups/${groupId}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent }),
      });

      if (res.ok) {
        const added = await res.json();
        setAnnouncements([added, ...announcements]); // Add to top of list
        setNewContent("");
      }
    } catch (error) {
      console.error("Failed to pin announcement", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-2 border-amber-100 shadow-sm rounded-3xl overflow-hidden">
      <CardHeader className="bg-amber-50/50 border-b border-amber-100 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 rounded-xl text-white">
              <Megaphone size={20} />
            </div>
            <CardTitle className="text-xl font-bold text-gray-900">
              Group Board
            </CardTitle>
          </div>
          <span className="text-xs font-bold text-amber-600 bg-amber-100 px-3 py-1 rounded-full uppercase tracking-wider">
            {announcements.length} Pinned
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* Leader-only Posting UI */}
        {isLeader && (
          <div className="flex gap-2 mb-8">
            <Input
              placeholder="Pin an important update for the group..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="rounded-xl border-gray-200 focus:ring-amber-500"
            />
            <Button
              onClick={handlePostAnnouncement}
              disabled={isSubmitting}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl px-6"
            >
              <Pin size={18} className="mr-2" />
              Pin
            </Button>
          </div>
        )}

        <div className="space-y-4">
          {announcements.length > 0 ? (
            announcements.map((item) => (
              <div
                key={item.announcementID}
                className="group relative bg-white border border-gray-100 p-5 rounded-2xl hover:border-amber-200 hover:bg-amber-50/10 transition-all shadow-xs"
              >
                <p className="text-gray-800 font-medium text-lg mb-4 leading-relaxed">
                  {item.content}
                </p>

                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-4 text-xs font-semibold text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <UserIcon size={14} className="text-amber-500" />
                      <span>{item.pinnedBy}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={14} />
                      <span>
                        {formatDistanceToNow(new Date(item.timestamp))} ago
                      </span>
                    </div>
                  </div>

                  {isLeader && (
                    <button className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10 border-2 border-dashed border-gray-100 rounded-3xl">
              <p className="text-gray-400 font-medium">
                No pinned announcements yet.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
