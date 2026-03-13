"use client";

import { GroupBoard } from "./GroupBoard";
import { Users, ShieldCheck, MapPin, Calendar } from "lucide-react";

export function GroupTripView({ initialData }: { initialData: any }) {
  const { group, members, canManage, userRole } = initialData;

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">
            {group.groupName}
          </h1>
          <p className="text-gray-500 mt-2 text-lg">{group.description}</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-gray-100 px-4">
          <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400 leading-none">
              Your Status
            </p>
            <p className="font-bold text-gray-900">{userRole}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8">
          <GroupBoard
            groupId={group.groupID}
            initialAnnouncements={group.pinnedAnnouncements}
            isLeader={canManage}
          />

          {/* Placeholder for future Sprint tasks (Itinerary/Expenses) */}
          <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-[2.5rem] h-64 flex flex-col items-center justify-center text-gray-400">
            <Calendar size={40} className="mb-2 opacity-20" />
            <p className="font-bold uppercase tracking-widest text-xs">
              Itinerary Coming Soon
            </p>
          </div>
        </div>

        {/* Sidebar Area */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
            <h3 className="font-black text-gray-900 mb-6 flex items-center gap-2 text-lg">
              <Users size={22} className="text-amber-500" />
              Travelers
            </h3>
            <div className="space-y-4">
              {members.map((m: any) => (
                <div
                  key={m.userId}
                  className="flex justify-between items-center bg-gray-50/50 p-3 rounded-2xl"
                >
                  <span className="font-bold text-gray-700">{m.username}</span>
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                      m.role === "Leader"
                        ? "bg-red-500 text-white"
                        : m.role === "Admin"
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
