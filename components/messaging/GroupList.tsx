"use client"

import { MessageSquare } from "lucide-react";

type GroupSummary = {
  groupID: string;
  groupName: string;
  members: string[];
}

export default function GroupList({ groups, activeGroupId, setActiveGroupId }: { groups: GroupSummary[], activeGroupId: string | null | undefined, setActiveGroupId: (groupId: string) => void }) {
  return (
    <div className="border-r border-gray-200 bg-gray-50/50 flex flex-col">
      <div className="p-4 border-b border-gray-200 bg-white">
        <h2 className="font-semibold text-gray-900">Your Groups</h2>
        <p className="text-sm text-gray-500">
          Select a group to view messages
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {groups.length > 0 ? (
          groups.map((g) => {
            const isActive = g.groupID === activeGroupId;

            return (
              <button
                key={g.groupID}
                onClick={() => setActiveGroupId(g.groupID)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${isActive
                  ? "bg-white border-amber-200 shadow-sm"
                  : "bg-transparent border-transparent hover:bg-white hover:border-gray-200"
                  }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className={`font-semibold truncate ${isActive ? "text-amber-700" : "text-gray-900"
                        }`}
                    >
                      {g.groupName}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {g.members.length ?? 0} members
                    </p>
                  </div>

                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isActive
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-500"
                      }`}
                  >
                    <MessageSquare size={18} />
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="p-6 text-sm text-center text-gray-500">
            No groups yet.
          </div>
        )}
      </div>
    </div>
  );
}