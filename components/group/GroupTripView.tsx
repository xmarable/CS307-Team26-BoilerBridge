/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState } from "react";
import { GroupBoard } from "./GroupBoard";
import {
  Users,
  ShieldCheck,
  Calendar,
  MapPin,
  MessageSquare,
  Image as ImageIcon,
  DollarSign,
  LayoutGrid,
  ArrowRight,
} from "lucide-react";
import { RainyDayToggle } from "../RainyDayToggle";
import { MustHavesSection } from "./MustHavesSection";
import { TimelineSection } from "./TimelineSection";
import GroupMessagesPanel from "@/components/messaging/GroupMessagesPanel";
import GroupPhotosPanel from "@/components/photos/GroupPhotoPanel";
import ExpenseSummaryPanel from "./ExpenseSummaryPanel";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function GroupTripView({ initialData }: { initialData: any }) {
  const { group, members, canManage, userRole, trip } = initialData;
  const [activeTab, setActiveTab] = useState("itinerary");

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">
            {group.groupName}
          </h1>
          <p className="text-gray-500 mt-2 text-lg">Trip Planning Hub</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <ShieldCheck className="text-amber-500" />
          <p className="font-bold text-gray-900">{userRole}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-10">
        {/* THE NEW SIDEBAR LOL */}
        <aside className="w-full lg:w-70 shrink-0">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm space-y-2 sticky top-10 border border-gray-50">
            <SidebarButton
              active={activeTab === "overview"}
              onClick={() => setActiveTab("overview")}
              icon={<LayoutGrid size={22} />}
              label="Overview"
            />
            <SidebarButton
              active={activeTab === "itinerary"}
              onClick={() => setActiveTab("itinerary")}
              icon={<Calendar size={22} />}
              label="Itinerary"
            />
            <SidebarButton
              active={activeTab === "messages"}
              onClick={() => setActiveTab("messages")}
              icon={<MessageSquare size={22} />}
              label="Messages"
            />
            <SidebarButton
              active={activeTab === "photos"}
              onClick={() => setActiveTab("photos")}
              icon={<ImageIcon size={22} />}
              label="Photos"
            />
            <SidebarButton
              active={activeTab === "expenses"}
              onClick={() => setActiveTab("expenses")}
              icon={<DollarSign size={22} />}
              label="Expenses"
            />
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          {activeTab === "overview" && (
            <GroupBoard
              groupId={group.groupID}
              initialAnnouncements={group.pinnedAnnouncements || []}
              isLeader={canManage}
            />
          )}

          {activeTab === "itinerary" && (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
              <div className="grid grid-cols-1 2xl:grid-cols-2 gap-10 items-stretch">
                <MustHavesSection groupId={group.groupID} />
                <TimelineSection groupId={group.groupID} />
              </div>

              <section className="space-y-6">
                <h2 className="text-3xl font-black text-gray-900 tracking-tight px-2">
                  Trip Itinerary
                </h2>
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 w-full">
                  <RainyDayToggle trip={trip} />
                </div>
              </section>
            </div>
          )}

          {activeTab === "messages" && (
            <GroupMessagesPanel activeGroup={group} userId={group.leaderID} />
          )}
          {activeTab === "photos" && (
            <GroupPhotosPanel
              activeGroup={group}
              userId={group.leaderID}
              isLeader={canManage}
            />
          )}
          {activeTab === "expenses" && (
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
              <ExpenseSummaryPanel
                groupId={group.groupID}
                currentUserId={group.leaderID}
                onPaymentRequestCreated={() => {}}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function SidebarButton({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-6 py-4 rounded-3xl transition-all group ${active ? "bg-linear-to-r from-amber-500 to-orange-600 text-white shadow-xl" : "text-gray-400 hover:bg-gray-50"}`}
    >
      <span
        className={
          active ? "text-white" : "text-gray-300 group-hover:text-amber-500"
        }
      >
        {icon}
      </span>
      <span className="font-bold text-lg">{label}</span>
      {active && <ArrowRight size={18} className="ml-auto" />}
    </button>
  );
}
