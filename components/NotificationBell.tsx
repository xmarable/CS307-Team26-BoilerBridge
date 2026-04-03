"use client";

import useSWR, { mutate as globalMutate } from "swr";
import { Bell, UserPlus, Check, X, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface FriendRequest {
  id: string;
  requesterId: string;
  senderName: string;
}

interface GroupInvite {
  groupID: string;
  groupName: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function NotificationBell() {
  const { data: friendRequests, mutate: mutateFriends } = useSWR<
    FriendRequest[]
  >("/api/friends/request", fetcher, {
    refreshInterval: 5000,
  });

  const { data: groupInvites, mutate: mutateGroups } = useSWR<GroupInvite[]>(
    "/api/groups/invites",
    fetcher,
    {
      refreshInterval: 5000,
    },
  );

  const handleFriendAction = async (
    requestId: string,
    action: "accept" | "decline",
  ) => {
    if (!friendRequests || !Array.isArray(friendRequests)) return;
    const target = friendRequests.find((r) => r.id === requestId);
    if (!target) return;

    const endpoint =
      action === "accept" ? "/api/friends/accept" : "/api/friends/request";
    const method = action === "accept" ? "POST" : "DELETE";

    try {
      const res = await fetch(endpoint, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: target.id,
          senderId: target.requesterId,
        }),
      });
      if (res.ok) {
        mutateFriends();
        globalMutate("/api/friends/manage");
      }
    } catch (err) {
      console.error("Friend action request failed:", err);
    }
  };

  const handleGroupAction = async (
    groupId: string,
    action: "accept" | "decline",
  ) => {
    const endpoint =
      action === "accept"
        ? `/api/groups/${groupId}/accept`
        : `/api/groups/${groupId}/members`;

    try {
      const res = await fetch(endpoint, {
        method: action === "accept" ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body:
          action === "decline" ? JSON.stringify({ email: "current" }) : null,
      });

      if (res.ok) {
        mutateGroups();
        globalMutate("/api/groups/list");
      }
    } catch (err) {
      console.error("Group action request failed:", err);
    }
  };

  const fList = Array.isArray(friendRequests) ? friendRequests : [];
  const gList = Array.isArray(groupInvites) ? groupInvites : [];
  const totalCount = fList.length + gList.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative text-gray-600 hover:text-gray-900 p-2 outline-none">
          <Bell size={20} />
          {totalCount > 0 && (
            <span className="absolute top-2 right-2 w-2 h-2 bg-amber-500 rounded-full border-2 border-white"></span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 mt-2 rounded-xl shadow-lg bg-white p-2 border border-gray-100"
      >
        <div className="flex items-center justify-between px-2 py-1">
          <DropdownMenuLabel className="text-gray-900 font-bold p-0">
            Notifications
          </DropdownMenuLabel>
        </div>
        <DropdownMenuSeparator className="bg-gray-100" />

        <div className="max-h-80 overflow-y-auto">
          {totalCount === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400 font-medium">
              No new notifications
            </div>
          ) : (
            <>
              {fList.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
                      <UserPlus size={16} />
                    </div>
                    <div className="flex flex-col">
                      <p className="text-sm font-bold text-gray-900 leading-tight">
                        @{req.senderName}
                      </p>
                      <p className="text-[11px] text-gray-500 font-medium">
                        Friend request
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleFriendAction(req.id, "accept")}
                      className="p-1.5 hover:bg-green-50 text-green-600 rounded-md transition-colors"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => handleFriendAction(req.id, "decline")}
                      className="p-1.5 hover:bg-red-50 text-red-600 rounded-md transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}

              {gList.map((invite) => (
                <div
                  key={invite.groupID}
                  className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                      <Users size={16} />
                    </div>
                    <div className="flex flex-col">
                      <p className="text-sm font-bold text-gray-900 leading-tight">
                        {invite.groupName}
                      </p>
                      <p className="text-[11px] text-gray-500 font-medium">
                        Group invitation
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() =>
                        handleGroupAction(invite.groupID, "accept")
                      }
                      className="p-1.5 hover:bg-green-50 text-green-600 rounded-md transition-colors"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() =>
                        handleGroupAction(invite.groupID, "decline")
                      }
                      className="p-1.5 hover:bg-red-50 text-red-600 rounded-md transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
