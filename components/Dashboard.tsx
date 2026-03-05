"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  Search,
  Bell,
  Plus,
  Map,
  MessageSquare,
  DollarSign,
  Settings,
  Calendar,
  TrendingUp,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback } from "./ui/avatar";
import Link from "next/link";

const trips = [
  {
    id: 1,
    name: "Spring Break Miami",
    dates: "Mar 15-22, 2026",
    members: ["JD", "SK", "MR", "AL", "TC"],
    budget: { used: 2400, total: 3500 },
    activities: 12,
    expenses: 28,
    unreadChats: 3,
    image: "https://images.unsplash.com/photo-1533993192821-2cce3a8267d1?w=400",
  },
  {
    id: 2,
    name: "Summer Road Trip",
    dates: "Jun 10-17, 2026",
    members: ["AM", "BR", "CD"],
    budget: { used: 850, total: 1200 },
    activities: 8,
    expenses: 15,
    unreadChats: 0,
    image: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400",
  },
  {
    id: 3,
    name: "Weekend Camping",
    dates: "Apr 5-7, 2026",
    members: ["PQ", "RS", "TU", "VW", "XY", "ZA"],
    budget: { used: 320, total: 500 },
    activities: 5,
    expenses: 9,
    unreadChats: 7,
    image: "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=400",
  },
  {
    id: 4,
    name: "NYC Museum Tour",
    dates: "May 20-23, 2026",
    members: ["BC", "DE"],
    budget: { used: 150, total: 800 },
    activities: 3,
    expenses: 4,
    unreadChats: 1,
    image: "https://images.unsplash.com/photo-1534430480872-3498386e7856?w=400",
  },
];

const upcomingActivities = [
  {
    trip: "Spring Break Miami",
    activity: "Beach Volleyball",
    date: "Tomorrow",
    time: "2:00 PM",
    location: "South Beach",
  },
  {
    trip: "Weekend Camping",
    activity: "Trail Hike",
    date: "Apr 5",
    time: "9:00 AM",
    location: "State Park",
  },
  {
    trip: "NYC Museum Tour",
    activity: "MoMA Visit",
    date: "May 20",
    time: "11:00 AM",
    location: "Midtown",
  },
];

interface DashboardProps {
  initialData: {
    displayName: string;
    profileImage?: string | null;
  };
}

export function Dashboard({ initialData }: DashboardProps) {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState("my-trips");

  // Determine the best name to display
  const displayName =
    session?.user?.name || (session?.user as any)?.username || "Boilermaker";

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">
              Welcome back, {initialData.displayName}!
            </h1>
            <p className="text-gray-600">Manage and plan your adventures</p>
          </div>
          <div className="flex gap-2">
            <Link href="/groups">
              <Button
                variant="outline"
                className="border-amber-500 text-amber-700 hover:bg-amber-50 rounded-xl"
              >
                My Groups
              </Button>
            </Link>
            <Link href="/groups/new">
              <Button
                variant="outline"
                className="border-amber-500 text-amber-700 hover:bg-amber-50 rounded-xl"
              >
                Create Group
              </Button>
            </Link>
            <Link href="/trip/new">
              <Button className="bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium rounded-xl shadow-md transition-all">
                <Plus className="mr-2" size={18} />
                Create Trip
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
          {trips.map((trip) => (
            <Link key={trip.id} href={`/trip/${trip.id}`}>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all group">
                <div className="h-44 overflow-hidden relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={trip.image}
                    alt={trip.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-4 right-4">
                    {trip.unreadChats > 0 && (
                      <span className="bg-amber-500 text-white text-xs px-2.5 py-1 rounded-full font-bold shadow-sm">
                        {trip.unreadChats} NEW
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-xl text-gray-900">
                      {trip.name}
                    </h3>
                    <ArrowUpRight
                      className="text-gray-400 group-hover:text-amber-500 transition-colors"
                      size={20}
                    />
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                    <Calendar size={14} />
                    <span>{trip.dates}</span>
                  </div>

                  <div className="flex items-center mb-6">
                    <div className="flex -space-x-2 overflow-hidden">
                      {trip.members.slice(0, 5).map((member, idx) => (
                        <Avatar
                          key={idx}
                          className="inline-block h-8 w-8 rounded-full ring-2 ring-white"
                        >
                          <AvatarFallback className="bg-gray-100 text-gray-700 text-xs font-bold">
                            {member.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    {trip.members.length > 5 && (
                      <span className="ml-3 text-xs text-gray-500 font-medium">
                        +{trip.members.length - 5} others
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-gray-600 font-medium">Budget</span>
                      <span className="font-bold text-gray-900">
                        ${trip.budget.used}{" "}
                        <span className="text-gray-400 font-normal">
                          / ${trip.budget.total}
                        </span>
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-linear-to-r from-amber-500 to-orange-600 h-2 rounded-full transition-all duration-1000"
                        style={{
                          width: `${(trip.budget.used / trip.budget.total) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 text-xs text-gray-500 font-medium">
                    <span>{trip.activities} activities</span>
                    <span>{trip.expenses} expenses</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Upcoming Activities
            </h2>
            <Button
              variant="ghost"
              className="text-amber-600 hover:text-amber-700 font-bold"
            >
              View Schedule
            </Button>
          </div>

          <div className="space-y-4">
            {upcomingActivities.length > 0 ? (
              upcomingActivities.map((activity, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-gray-50 rounded-2xl border border-transparent hover:border-amber-200 hover:bg-amber-50/30 transition-all group"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-linear-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-md">
                      <Calendar className="text-white" size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-lg text-gray-900">
                        {activity.activity}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span className="font-medium text-amber-600">
                          {activity.trip}
                        </span>
                        {activity.location && (
                          <>
                            <span>•</span>
                            <span>{activity.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-gray-200">
                    <p className="text-base font-bold text-gray-900">
                      {activity.date}
                    </p>
                    <p className="text-sm font-medium text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm mt-1">
                      {activity.time}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No upcoming activities ✈️</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
