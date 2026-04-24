"use client";

import useSWR, { mutate as globalMutate } from "swr";
import Link from "next/link";
import {
  Bell,
  UserPlus,
  Check,
  X,
  Loader2,
  Banknote,
  Users,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface GroupInvite {
  groupID: string;
  groupName: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type InAppNotification = {
  notificationID: string;
  type: string;
  groupID: string;
  paymentRequestID: string;
  message?: string;
  read: boolean;
  createdAt?: string;
};

type NotificationsPayload = {
  notifications?: InAppNotification[];
  unreadCount?: number;
};

interface FriendRequest {
  id: string;
  senderName: string;
}

export function NotificationBell() {
  const {
    data: friendRequests,
    mutate: mutateFriends,
    isValidating: friendsValidating,
  } = useSWR<FriendRequest[]>("/api/friends/request", fetcher, {
    refreshInterval: 5000,
  });

  const { data: groupInvites, mutate: mutateGroups } = useSWR<GroupInvite[]>(
    "/api/groups/invites",
    fetcher,
    {
      refreshInterval: 5000,
    },
  );

  const {
    data: notifPayload,
    mutate: mutateNotifs,
    isValidating: notifsValidating,
  } = useSWR("/api/notifications?limit=15", fetcher, {
    refreshInterval: 15000,
  });

  const handleFriendAction = async (
    requestId: string,
    action: "accept" | "decline",
  ) => {
    if (!friendRequests || !Array.isArray(friendRequests)) return;

    const previousRequests = friendRequests;
    const target = friendRequests.find((r) => r.id === requestId);
    if (!target) return;

    const updatedRequests = friendRequests.filter(
      (r: { id: string }) => r.id !== requestId,
    );
    mutateFriends(updatedRequests, false);

    const endpoint =
      action === "accept" ? "/api/friends/accept" : "/api/friends/request";
    const method = action === "accept" ? "PATCH" : "DELETE";

    try {
      const res = await fetch(endpoint, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });

      if (!res.ok) throw new Error();
      mutateFriends();
      globalMutate("/api/friends/manage");
    } catch (err) {
      console.error("Friend action request failed:", err);
      mutateFriends(previousRequests);
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

  const markNotificationRead = async (notificationID: string) => {
    try {
      await fetch(`/api/notifications/${notificationID}/read`, {
        method: "PATCH",
        credentials: "include",
      });
      mutateNotifs();
    } catch {
      /* ignore */
    }
  };

  const fList = Array.isArray(friendRequests) ? friendRequests : [];
  const gList = Array.isArray(groupInvites) ? groupInvites : [];
  const payload = notifPayload as NotificationsPayload | undefined;
  const inAppList: InAppNotification[] = Array.isArray(payload?.notifications)
    ? payload!.notifications!
    : [];
  const unreadInApp = Number(payload?.unreadCount ?? 0);

  const totalBadge = unreadInApp + fList.length + gList.length;
  const isValidating =
    (friendsValidating && !friendRequests) ||
    (notifsValidating && !notifPayload);
  const isEmpty =
    fList.length === 0 && gList.length === 0 && inAppList.length === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative text-gray-600 hover:text-gray-900 p-2 outline-none"
          aria-label="Notifications"
        >
          <Bell
            size={20}
            className={isValidating && !friendRequests ? "animate-pulse" : ""}
          />
          {totalBadge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 px-1 flex items-center justify-center text-[10px] font-bold text-white bg-amber-600 rounded-full border-2 border-white">
              {totalBadge > 99 ? "99+" : totalBadge}
            </span>
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
          {(friendsValidating || notifsValidating) && (
            <Loader2 size={12} className="animate-spin text-gray-400" />
          )}
        </div>
        <DropdownMenuSeparator className="bg-gray-100" />

        <div className="max-h-72 overflow-y-auto space-y-3">
          {fList.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide px-2 mb-1">
                Friend requests
              </p>
              <ul className="space-y-1">
                {fList.map((req) => (
                  <li
                    key={req.id}
                    className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 shrink-0">
                        <UserPlus size={16} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <p className="text-sm font-medium text-gray-900 leading-tight truncate">
                          @{req.senderName}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          Sent a friend request
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleFriendAction(req.id, "accept")}
                        className="p-1.5 hover:bg-green-50 text-green-600 rounded-md transition-colors"
                        aria-label="Accept friend request"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFriendAction(req.id, "decline")}
                        className="p-1.5 hover:bg-red-50 text-red-600 rounded-md transition-colors"
                        aria-label="Decline friend request"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {gList.length > 0 && (
            <div>
              {fList.length > 0 ? (
                <DropdownMenuSeparator className="bg-gray-100 my-2" />
              ) : null}
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide px-2 mb-1">
                Group invitations
              </p>
              <ul className="space-y-1">
                {gList.map((invite) => (
                  <li
                    key={invite.groupID}
                    className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shrink-0">
                        <Users size={16} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <p className="text-sm font-medium text-gray-900 leading-tight truncate">
                          {invite.groupName}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          Group invitation
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          handleGroupAction(invite.groupID, "accept")
                        }
                        className="p-1.5 hover:bg-green-50 text-green-600 rounded-md transition-colors"
                        aria-label="Accept group invitation"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleGroupAction(invite.groupID, "decline")
                        }
                        className="p-1.5 hover:bg-red-50 text-red-600 rounded-md transition-colors"
                        aria-label="Decline group invitation"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {inAppList.length > 0 && (
            <div>
              {fList.length > 0 || gList.length > 0 ? (
                <DropdownMenuSeparator className="bg-gray-100 my-2" />
              ) : null}
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide px-2 mb-1">
                Activity
              </p>
              <ul className="space-y-1">
                {inAppList.map((n) => (
                  <li key={n.notificationID}>
                    <Link
                      href={`/dashboard/groups/${n.groupID}`}
                      className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${
                        n.read
                          ? "hover:bg-gray-50"
                          : "bg-amber-50/80 hover:bg-amber-50"
                      }`}
                      onClick={() => {
                        if (!n.read)
                          void markNotificationRead(n.notificationID);
                      }}
                    >
                      <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 shrink-0 mt-0.5">
                        <Banknote size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-900 leading-snug">
                          {n.message ?? "Payment update"}
                        </p>
                        <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                          Open group
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isEmpty && (
            <div className="py-6 text-center text-sm text-gray-500">
              {isValidating && !friendRequests && !notifPayload
                ? "Loading..."
                : "No new notifications"}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
