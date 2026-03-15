"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Map,
  List,
  TrendingUp,
  MessageSquare,
  DollarSign,
  Settings,
  Users,
  ShieldAlert,
  Group
} from "lucide-react";
import { base64 } from "zod";

const navItems = [
  { name: "My Trips", href: "/dashboard", icon: Map },
  {
    name: "Groups",
    href: "/dashboard/groups",
    icon: Group,
    badege: 11,
  },
  { name: "All Trips", href: "/dashboard/alltrips", icon: List },
  { name: "Friends", href: "/dashboard/friends", icon: Users },
  { name: "Discover", href: "/discover", icon: TrendingUp },
  {
    name: "Messages",
    href: "/dashboard/messages",
    icon: MessageSquare,
    badge: 11,
  },
  { name: "Expenses", href: "/dashboard/expenses", icon: DollarSign },
  { name: "Settings", href: "/dashboard/profile", icon: Settings },
  { name: "Safety & SOS", href: "#sos", icon: ShieldAlert },
];

export function Sidebar() {
  const pathname = usePathname();

  const handleSOSClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    console.log("SOS button clicked, dispatching open-sos event");
    // Dispatches a custom event that the SOSButton component is listening for
    window.dispatchEvent(new CustomEvent("open-sos"));
  };

  return (
    <aside className="hidden lg:block w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-73px)] sticky top-18.25">
      <nav className="p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const isSOS = item.href === "#sos";

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={isSOS ? handleSOSClick : undefined}
              className="block group"
            >
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
