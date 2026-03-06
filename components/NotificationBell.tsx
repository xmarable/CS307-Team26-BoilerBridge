"use client";

import useSWR from "swr";
import { Bell, UserPlus, Check, X, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function NotificationBell() {
  const {
    data: requests,
    mutate,
    isValidating,
  } = useSWR("/api/friends/request", fetcher, {
    refreshInterval: 10000,
  });

  const handleAction = async (
    requestId: string,
    action: "accept" | "decline",
  ) => {
    if (!requests || !Array.isArray(requests)) return;

    const previousRequests = requests;
    const updatedRequests = requests.filter((r: any) => r.id !== requestId);
    mutate(updatedRequests, false);

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
      mutate();
    } catch (err) {
      mutate(previousRequests);
    }
  };

  const requestList = Array.isArray(requests) ? requests : [];
  const hasNotifications = requestList.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative text-gray-600 hover:text-gray-900 p-2 outline-none">
          <Bell
            size={20}
            className={isValidating && !requests ? "animate-pulse" : ""}
          />
          {hasNotifications && (
            <span className="absolute top-2 right-2 w-2 h-2 bg-amber-500 rounded-full border-2 border-white"></span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 mt-2 rounded-xl shadow-lg bg-white p-2"
      >
        <div className="flex items-center justify-between px-2 py-1">
          <DropdownMenuLabel className="text-gray-900 font-bold p-0">
            Notifications
          </DropdownMenuLabel>
          {isValidating && (
            <Loader2 size={12} className="animate-spin text-gray-400" />
          )}
        </div>
        <DropdownMenuSeparator className="bg-gray-100" />

        <div className="max-h-64 overflow-y-auto">
          {requestList.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500">
              {isValidating && !requests
                ? "Loading..."
                : "No new notifications"}
            </div>
          ) : (
            requestList.map((req: any) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                    <UserPlus size={16} />
                  </div>
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-gray-900 leading-tight">
                      @{req.senderName}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Sent a friend request
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleAction(req.id, "accept")}
                    className="p-1.5 hover:bg-green-50 text-green-600 rounded-md transition-colors"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => handleAction(req.id, "decline")}
                    className="p-1.5 hover:bg-red-50 text-red-600 rounded-md transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
