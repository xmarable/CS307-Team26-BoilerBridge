"use client";

import Link from "next/link";
import { Search, LogOut, Settings, CheckCircle2 } from "lucide-react";
import { Input } from "./ui/input";
import { NotificationBell } from "./NotificationBell";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const navItems = [
  { name: "My Trips", href: "/dashboard" },
  { name: "Groups", href: "/dashboard/groups" },
  { name: "All Trips", href: "/dashboard/alltrips" },
  { name: "Public Feed", href: "/dashboard/public-itineraries" },
  { name: "Friends", href: "/dashboard/friends" },
  { name: "Discover", href: "/dashboard/discover" },
  { name: "Activities", href: "/dashboard/activities" },
  { name: "Settings", href: "/dashboard/profile" },
];

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function Navbar({ session }: { session?: any }) {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const user = session?.user;

  useEffect(() => {
    setMounted(true);
  }, []);

  const displayName = user?.name || user?.username || "User";
  const displayInitial = displayName.charAt(0).toUpperCase();
  const profileImage = user?.image;
  const isVerified = user?.isStudentVerified;

  return (
    <header className="bg-bb-surface border-b border-bb-border sticky top-0 z-40 w-full">
      {/* Top row: logo, search, actions */}
      <div className="w-full px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 bg-linear-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">B</span>
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
              BoilerBridge
            </span>
          </Link>
          <div className="hidden md:block relative w-80">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
              size={18}
            />
            <Input
              placeholder="Search trips or friends..."
              className="pl-10 rounded-xl bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:ring-amber-500 text-black dark:text-gray-100 placeholder:text-gray-400 outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <NotificationBell />

          {mounted && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <span className="relative cursor-pointer hover:ring-2 hover:ring-amber-500 transition-all rounded-full border border-gray-100 dark:border-gray-700 w-10 h-10 bg-gray-100 dark:bg-gray-800 flex items-center justify-center outline-none">
                  <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
                    {profileImage ? (
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
                  {isVerified && (
                    <div className="absolute -top-1 -right-1 bg-white dark:bg-gray-800 rounded-full p-0.5 shadow-sm z-50">
                      <CheckCircle2
                        size={14}
                        className="text-green-600 fill-green-50"
                      />
                    </div>
                  )}
                </span>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="w-56 mt-2 rounded-xl shadow-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1"
              >
                <DropdownMenuLabel className="font-normal px-2 py-2">
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold leading-none text-gray-900 dark:text-gray-100">
                        {user?.name || `@${user?.username}` || "User"}
                      </p>
                      {isVerified && (
                        <CheckCircle2 size={12} className="text-green-600" />
                      )}
                    </div>
                    <p className="text-xs leading-none text-gray-500 dark:text-gray-400 truncate">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator className="bg-gray-100 dark:bg-gray-800" />

                <DropdownMenuItem asChild>
                  <Link
                    href="/dashboard/profile"
                    className="flex items-center w-full px-2 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-700 dark:hover:text-amber-400 transition-colors cursor-pointer"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Account Settings</span>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-gray-100 dark:bg-gray-800" />

                <DropdownMenuItem asChild>
                  <Link
                    href="/signout"
                    className="flex items-center w-full px-2 py-2 text-sm text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Nav row */}
      <nav className="w-full px-4 flex items-end gap-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-t border-bb-border/40">
        {navItems.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? "border-amber-500 text-amber-600 dark:text-amber-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
