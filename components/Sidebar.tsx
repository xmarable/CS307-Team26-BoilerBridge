"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Map,
  TrendingUp,
  MessageSquare,
  DollarSign,
  Settings,
  Users,
} from "lucide-react";

const navItems = [
  { name: "My Trips", href: "/dashboard", icon: Map },
  { name: "Friends", href: "/dashboard/friends", icon: Users },
  { name: "Discover", href: "/discover", icon: TrendingUp },
  { name: "Messages", href: "/dashboard/messages", icon: MessageSquare, badge: 11 },
  { name: "Expenses", href: "/expenses", icon: DollarSign },
  { name: "Settings", href: "/dashboard/profile", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:block w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-73px)] sticky top-18.25">
      <nav className="p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link key={item.name} href={item.href}>
              <div
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer ${
                  isActive
                    ? "bg-amber-50 text-amber-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.name}</span>
                {item.badge && (
                  <span className="ml-auto bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
