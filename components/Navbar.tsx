"use client";

import Link from "next/link";
import { Search, LogOut, Settings } from "lucide-react";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { NotificationBell } from "./NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function Navbar({ session }: { session?: { user?: { name?: string; username?: string; image?: string; email?: string } } }) {
  const user = session?.user;

  const displayName = user?.name || user?.username || "User";
  const displayInitial = displayName.charAt(0).toUpperCase();
  const profileImage = user?.image;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 w-full h-18.25 flex items-center">
      <div className="w-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-linear-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">B</span>
            </div>
            <span className="text-xl font-bold text-gray-900">
              BoilerBridge
            </span>
          </Link>
          <div className="hidden md:block relative w-96">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <Input
              placeholder="Search trips or friends..."
              className="pl-10 rounded-xl bg-gray-50 border-gray-200 focus:ring-amber-500 text-black placeholder:text-gray-400 outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="relative cursor-pointer hover:ring-2 hover:ring-amber-500 transition-all rounded-full border border-gray-100 w-10 h-10 overflow-hidden bg-gray-100 flex items-center justify-center">
                {profileImage ? (
                  /* Standard img tag bypasses Shadcn/Avatar hydration lag */
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={profileImage}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    loading="eager"
                  />
                ) : (
                  <div className="w-full h-full bg-linear-to-br from-amber-500 to-orange-600 text-white font-bold flex items-center justify-center">
                    {displayInitial}
                  </div>
                )}
              </div>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              className="w-56 mt-2 rounded-xl shadow-lg border-gray-200 bg-white p-1"
            >
              <DropdownMenuLabel className="font-normal px-2 py-2">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-bold leading-none text-gray-900">
                    {user?.name || `@${user?.username}` || "User"}
                  </p>
                  <p className="text-xs leading-none text-gray-500 truncate">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator className="bg-gray-100" />

              <DropdownMenuItem asChild>
                <Link
                  href="/settings"
                  className="flex items-center w-full px-2 py-2 text-sm text-gray-700 rounded-lg hover:bg-amber-50 hover:text-amber-700 transition-colors cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Account Settings</span>
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-gray-100" />

              <DropdownMenuItem asChild>
                <Link
                  href="/signout"
                  className="flex items-center w-full px-2 py-2 text-sm text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
