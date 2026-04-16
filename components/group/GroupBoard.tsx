"use client";

import "@/app/globals.css";
import { useState } from "react";
import { Pin, Trash2, Megaphone, Clock, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { TripChecklist } from "@/components/TripChecklist";

interface Announcement {
  announcementID: string;
  content: string;
  pinnedBy: string;
  timestamp: string;
}

interface GroupBoardProps {
  groupId: string;
  initialAnnouncements: Announcement[];
  isLeader: boolean;
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
        const newAnnouncement = {
          ...added,
          content: added.content || newContent,
          announcementID: added.announcementID || `temp-${Date.now()}`,
          timestamp: added.timestamp || new Date().toISOString(),
          pinnedBy: added.pinnedBy || "Leader",
        };
        setAnnouncements([newAnnouncement, ...announcements]);
        setNewContent("");
      }
    } catch (error) {
      console.error("Failed to pin announcement", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (announcementID: string) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/announcements`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ announcementID }),
      });
      if (res.ok) {
        setAnnouncements((prev) =>
          prev.filter((a) => a.announcementID !== announcementID),
        );
      }
    } catch (error) {
      console.error("Failed to delete announcement", error);
    }
  };

  return (
    <div className="space-y-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="border-none bg-bb-surface shadow-sm rounded-[2.5rem] overflow-hidden">
        <CardHeader className="bg-amber-50/40 p-8 border-b border-bb-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-bb-brand rounded-2xl text-white shadow-lg shadow-amber-200">
                <Megaphone size={28} />
              </div>
              <div>
                <CardTitle className="text-2xl font-black text-bb-text tracking-tight">
                  Group Board
                </CardTitle>
                <p className="text-sm font-bold text-amber-600 uppercase tracking-widest mt-1">
                  Pinned Announcements
                </p>
              </div>
            </div>
            <div className="px-5 py-2 bg-bb-surface border-2 border-amber-100 rounded-2xl shadow-sm">
              <span className="text-lg font-black text-amber-600">
                {announcements.length}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-8">
          {isLeader && (
            <div className="flex flex-col sm:flex-row gap-4 mb-10">
              <Input
                placeholder="Pin an important update for the group..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="h-16 rounded-2xl border-2 border-bb-border-input bg-bb-surface-subtle text-lg text-bb-text font-medium px-8 flex-1 focus:ring-bb-ring"
              />
              <Button
                onClick={handlePostAnnouncement}
                disabled={isSubmitting}
                className="h-16 bg-bb-brand hover:bg-bb-brand-to text-white font-black rounded-2xl px-10 transition-transform active:scale-95 shadow-lg shadow-amber-100"
              >
                <Pin size={22} className="mr-3 fill-white" />
                PIN
              </Button>
            </div>
          )}

          <div className="space-y-6">
            {announcements.length > 0 ? (
              [...announcements]
                .sort(
                  (a, b) =>
                    new Date(b.timestamp).getTime() -
                    new Date(a.timestamp).getTime(),
                )
                .map((item) => (
                  <div
                    key={item.announcementID}
                    className="group relative bg-bb-surface border-2 border-bb-border p-8 rounded-4xl hover:border-amber-200 hover:shadow-xl hover:shadow-amber-50/50 transition-all"
                  >
                    <p className="text-bb-text font-bold text-xl mb-6 leading-snug">
                      {item.content}
                    </p>

                    <div className="flex items-center justify-between border-t-2 border-bb-border pt-6 mt-auto">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 px-4 py-2 bg-bb-surface-inset rounded-xl">
                          <UserIcon size={16} className="text-bb-brand" />
                          <span className="text-sm font-black text-bb-text-sub uppercase tracking-wider">
                            {item.pinnedBy}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-bb-text-muted">
                          <Clock size={16} />
                          <span className="text-sm font-bold">
                            {formatDistanceToNow(new Date(item.timestamp))} ago
                          </span>
                        </div>
                      </div>

                      {isLeader && (
                        <button
                          onClick={() =>
                            handleDeleteAnnouncement(item.announcementID)
                          }
                          className="text-bb-placeholder hover:text-bb-danger transition-colors p-2 cursor-pointer"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center py-16 border-4 border-dashed border-bb-surface-inset rounded-[2.5rem]">
                <div className="flex flex-col items-center gap-4">
                  <Pin size={32} className="text-bb-placeholder" />
                  <p className="text-bb-placeholder font-bold text-lg">
                    No pinned announcements yet.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="px-2">
        <TripChecklist groupId={groupId} />
      </div>
    </div>
  );
}
