"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Map,
  List,
  TrendingUp,
  DollarSign,
  Settings,
  Users,
  Group,
  Globe2,
  Activity,
} from "lucide-react";

const navItems = [
  { name: "My Trips", href: "/dashboard", icon: Map },
  {
    name: "Groups",
    href: "/dashboard/groups",
    icon: Group,
  },
  { name: "All Trips", href: "/dashboard/alltrips", icon: List },
  {
    name: "Public Feed",
    href: "/dashboard/public-itineraries",
    icon: Globe2,
  },
  { name: "Friends", href: "/dashboard/friends", icon: Users },
  { name: "Discover", href: "/dashboard/discover", icon: TrendingUp },
  {
    name: "Activities",
    href: "/dashboard/activities",
    icon: Activity,
  },
  { name: "Settings", href: "/dashboard/profile", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:block w-64 bg-bb-surface border-r border-bb-border min-h-[calc(100vh-73px)] sticky top-18.25">
      <nav className="p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard/public-itineraries"
              ? pathname === item.href || pathname.startsWith(`${item.href}/`)
              : pathname === item.href;

          return (
            <Link key={item.name} href={item.href} className="block group">
              <div
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer ${
                  isActive
                    ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                    : "text-bb-text-sub dark:text-bb-text-muted hover:bg-bb-surface-subtle dark:hover:bg-bb-surface-subtle"
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.name}</span>
              </div>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
