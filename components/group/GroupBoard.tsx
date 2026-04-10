"use client";

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
      <Card className="border-none bg-white shadow-sm rounded-[2.5rem] overflow-hidden">
        <CardHeader className="bg-amber-50/40 p-8 border-b border-amber-100/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-amber-500 rounded-2xl text-white shadow-lg shadow-amber-200">
                <Megaphone size={28} />
              </div>
              <div>
                <CardTitle className="text-2xl font-black text-gray-900 tracking-tight">
                  Group Board
                </CardTitle>
                <p className="text-sm font-bold text-amber-600 uppercase tracking-widest mt-1">
                  Pinned Announcements
                </p>
              </div>
            </div>
            <div className="px-5 py-2 bg-white border-2 border-amber-100 rounded-2xl shadow-sm">
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
                className="h-16 rounded-2xl border-2 border-gray-100 bg-gray-50/50 text-lg focus:ring-amber-500 font-medium px-8 flex-1"
              />
              <Button
                onClick={handlePostAnnouncement}
                disabled={isSubmitting}
                className="h-16 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl px-10 transition-transform active:scale-95 shadow-lg shadow-amber-100"
              >
                <Pin size={22} className="mr-3 fill-white" />
                PIN
              </Button>
            </div>
          )}

          <div className="space-y-6">
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
                    className="group relative bg-white border-2 border-gray-50 p-8 rounded-4xl hover:border-amber-200 hover:shadow-xl hover:shadow-amber-50/50 transition-all"
                  >
                    <p className="text-gray-800 font-bold text-xl mb-6 leading-snug">
                      {item.content ? String(item.content) : " "}
                    </p>

                    <div className="flex items-center justify-between border-t-2 border-gray-50 pt-6 mt-auto">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl">
                          <UserIcon size={16} className="text-amber-500" />
                          <span className="text-sm font-black text-gray-600 uppercase tracking-wider">
                            {item.pinnedBy || "Leader"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                          <Clock size={16} />
                          <span className="text-sm font-bold">
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
                          className="text-gray-200 hover:text-red-500 transition-colors p-2 cursor-pointer"
                          title="Unpin Announcement"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center py-16 border-4 border-dashed border-gray-50 rounded-[2.5rem]">
                <div className="flex flex-col items-center gap-4">
                  <Pin size={32} className="text-gray-200" />
                  <p className="text-gray-400 font-bold text-lg">
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
