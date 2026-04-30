"use client";

import { useState } from "react";
import { Pin, Trash2, Megaphone, Clock, User as UserIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { formatDistanceToNow } from "date-fns";
import { TripChecklist } from "./TripChecklist";

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

    const currentText = newContent;

    try {
      const res = await fetch(`/api/groups/${groupId}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: currentText }),
      });

      if (res.ok) {
        const added = await res.json();

        const newAnnouncement = {
          ...added,
          content: added.content || currentText,
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
      <Card className="bg-bb-surface rounded-[2.5rem] shadow-sm border border-bb-border overflow-hidden">
        <CardHeader className="p-8 border-b border-bb-border bg-linear-to-b from-bb-surface-subtle to-bb-surface">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-linear-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-200/20">
                <Megaphone className="text-white" size={28} />
              </div>
              <div>
                <CardTitle className="text-2xl font-black text-bb-text tracking-tight">
                  Group Board
                </CardTitle>
                <p className="text-sm font-bold text-bb-text-muted uppercase tracking-widest">
                  {announcements.length} Pinned Announcements
                </p>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-8">
          {isLeader && (
            <div className="space-y-3 mb-10">
              <div className="flex gap-3">
                <Input
                  placeholder="Pin an important update for the group..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="h-14 rounded-2xl border-bb-border-input bg-bb-surface-subtle px-6 font-medium text-bb-text focus:ring-amber-500 transition-all placeholder:text-bb-text-muted"
                  onKeyDown={(e) =>
                    e.key === "Enter" && handlePostAnnouncement()
                  }
                />
                <Button
                  onClick={handlePostAnnouncement}
                  disabled={isSubmitting}
                  aria-label="Pin"
                  className="h-14 w-14 bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-2xl shadow-md transition-all active:scale-95 shrink-0"
                >
                  <Pin size={24} />
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {announcements.length > 0 ? (
              [...announcements]
                .sort((a, b) => {
                  const dateA = new Date(a.timestamp || 0).getTime();
                  const dateB = new Date(
                    b.timestamp || new Date().toISOString(),
                  ).getTime();
                  return dateB - dateA;
                })
                .map((item) => (
                  <div
                    key={item.announcementID || `ann-${Math.random()}`}
                    className="group relative flex flex-col p-6 rounded-3xl border border-bb-border bg-bb-surface hover:border-amber-200 dark:hover:border-amber-900 hover:shadow-md transition-all duration-300"
                  >
                    <p className="text-bb-text font-bold text-xl mb-6 leading-snug">
                      {item.content ? String(item.content) : " "}
                    </p>

                    <div className="flex items-center justify-between border-t border-bb-border pt-6 mt-auto">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-bb-surface-subtle rounded-xl">
                          <UserIcon size={14} className="text-amber-500" />
                          <span className="text-xs font-black text-bb-text-muted uppercase tracking-wider">
                            {item.pinnedBy || "Leader"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-bb-text-muted">
                          <Clock size={14} />
                          <span className="text-xs font-bold">
                            {item.timestamp
                              ? formatDistanceToNow(new Date(item.timestamp))
                              : "just now"}{" "}
                            ago
                          </span>
                        </div>
                      </div>

                      {isLeader && (
                        <button
                          onClick={() =>
                            handleDeleteAnnouncement(item.announcementID)
                          }
                          className="opacity-0 group-hover:opacity-100 text-bb-text-muted hover:text-bb-danger transition-all p-2"
                          title="Unpin Announcement"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center py-16 bg-bb-surface-subtle rounded-4xl border-2 border-dashed border-bb-border">
                <Pin className="mx-auto text-bb-border mb-4" size={48} />
                <p className="text-bb-text-muted font-black text-xl">
                  No pinned announcements yet.
                </p>
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
