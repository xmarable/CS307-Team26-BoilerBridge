"use client";

import { Calendar } from "lucide-react";
import CalendarEventsPanel from "./CalendarEventsPanel";

export function TimelineSection({
  groupId,
  canPublishItinerary = false,
  isLeader = false,
  groupName,
}: {
  groupId: string;
  canPublishItinerary?: boolean;
  isLeader?: boolean;
  groupName?: string;
}) {
  return (
    <section className="space-y-6 flex-1 min-w-0">
      <div className="flex items-center gap-3 px-2">
        <div className="p-3 bg-amber-50 rounded-xl text-amber-600 shadow-sm">
          <Calendar size={24} />
        </div>
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">
          Timeline
        </h2>
      </div>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 h-187.5 overflow-y-auto custom-scrollbar">
        <CalendarEventsPanel
          groupId={groupId}
          groupName={groupName}
          canPublishItinerary={canPublishItinerary}
          isLeader={isLeader}
        />
      </div>
    </section>
  );
}
