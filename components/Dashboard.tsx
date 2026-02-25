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
  TrendingUp
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
    image: "https://images.unsplash.com/photo-1533993192821-2cce3a8267d1?w=400"
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
    image: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400"
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
    image: "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=400"
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
    image: "https://images.unsplash.com/photo-1534430480872-3498386e7856?w=400"
  }
];

const upcomingActivities = [
  { trip: "Spring Break Miami", activity: "Beach Volleyball", date: "Tomorrow", time: "2:00 PM" },
  { trip: "Weekend Camping", activity: "Trail Hike", date: "Apr 5", time: "9:00 AM" },
  { trip: "NYC Museum Tour", activity: "MoMA Visit", date: "May 20", time: "11:00 AM" }
];

export function Dashboard() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState("my-trips");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-linear-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">B</span>
              </div>
              <span className="text-xl font-bold text-gray-900">BoilerBridge</span>
            </Link>
            
            <div className="hidden md:block relative w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input
                placeholder="Search trips..."
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full"></span>
            </Button>
            <Link href="/settings">
              <Avatar className="cursor-pointer hover:ring-2 hover:ring-amber-500 transition-all">
                <AvatarFallback className="bg-linear-to-br from-amber-500 to-orange-600 text-white">
                  {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : "JD"}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden lg:block w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-73px)] sticky top-18.25">
          <nav className="p-4 space-y-1">
            <button
              onClick={() => setActiveTab("my-trips")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                activeTab === "my-trips"
                  ? "bg-amber-50 text-amber-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Map size={20} />
              <span className="font-medium">My Trips</span>
            </button>
            
            <button
              onClick={() => setActiveTab("discover")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                activeTab === "discover"
                  ? "bg-amber-50 text-amber-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <TrendingUp size={20} />
              <span className="font-medium">Discover Trips</span>
            </button>

            <button
              onClick={() => setActiveTab("messages")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                activeTab === "messages"
                  ? "bg-amber-50 text-amber-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <MessageSquare size={20} />
              <span className="font-medium">Messages</span>
              <span className="ml-auto bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                11
              </span>
            </button>

            <button
              onClick={() => setActiveTab("expenses")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                activeTab === "expenses"
                  ? "bg-amber-50 text-amber-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <DollarSign size={20} />
              <span className="font-medium">Expenses</span>
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                activeTab === "settings"
                  ? "bg-amber-50 text-amber-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Settings size={20} />
              <span className="font-medium">Settings</span>
            </button>
          </nav>
        </aside>

        <main className="flex-1 p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-1">Your Trips</h1>
                <p className="text-gray-600">Manage and plan your adventures</p>
              </div>
              <div className="flex gap-2">
                <Link href="/groups/new">
                  <Button variant="outline" className="border-amber-500 text-amber-700 hover:bg-amber-50">
                    Create Group
                  </Button>
                </Link>
                <Link href="/trip/new">
                  <Button className="bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white">
                    <Plus className="mr-2" size={18} />
                    Create Trip
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
              {trips.map((trip) => (
                <Link key={trip.id} href={`/trip/${trip.id}`}>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                    <div className="h-40 overflow-hidden bg-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={trip.image}
                        alt={trip.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-bold text-lg text-gray-900">{trip.name}</h3>
                        {trip.unreadChats > 0 && (
                          <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full">
                            {trip.unreadChats} new
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                        <Calendar size={14} />
                        <span>{trip.dates}</span>
                      </div>

                      <div className="flex items-center gap-1 mb-4">
                        {trip.members.slice(0, 5).map((member, idx) => (
                          <Link 
                            key={idx} 
                            href={`/profile/${member}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Avatar className="w-8 h-8 border-2 border-white -ml-2 first:ml-0 hover:scale-110 transition-transform cursor-pointer">
                              <AvatarFallback className="text-xs bg-linear-to-br from-amber-400 to-orange-500 text-white">
                                {member.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </Link>
                        ))}
                        {trip.members.length > 5 && (
                          <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white -ml-2 flex items-center justify-center text-xs text-gray-600">
                            +{trip.members.length - 5}
                          </div>
                        )}
                      </div>

                      <div className="mb-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Budget</span>
                          <span className="font-medium text-gray-900">
                            ${trip.budget.used} / ${trip.budget.total}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-linear-to-r from-amber-500 to-orange-600 h-2 rounded-full transition-all"
                            style={{ width: `${(trip.budget.used / trip.budget.total) * 100}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>{trip.activities} activities</span>
                        <span>{trip.expenses} expenses</span>
                        <span>{trip.unreadChats} chats</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Upcoming Activities</h2>
              <div className="space-y-3">
                {upcomingActivities.length > 0 ? (
                  upcomingActivities.map((activity, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 bg-amber-50 rounded-xl"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-linear-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                          <Calendar className="text-white" size={20} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{activity.activity}</p>
                          <p className="text-sm text-gray-600">{activity.trip}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{activity.date}</p>
                        <p className="text-sm text-gray-600">{activity.time}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="mx-auto mb-2 text-gray-400" size={32} />
                    <p>No upcoming activities ✈️</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}