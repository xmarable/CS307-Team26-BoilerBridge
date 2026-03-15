"use client";

import { useState } from "react";
import {
  ChevronLeft,
  Calendar,
  DollarSign,
  MessageSquare,
  Users,
  LayoutGrid,
  Plus,
  MapPin,
  Clock,
  MoreVertical,
  Send,
  Paperclip,
  Lock,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback } from "./ui/avatar";
import Link from "next/link";
// import your member management component
import { MemberManagement } from "./MemberManagement";

const tripData = {
  id: 1,
  name: "Spring Break Miami",
  dates: "Mar 15-22, 2026",
  members: [
    {
      id: 1,
      initials: "JD",
      name: "John Doe",
      color: "from-blue-400 to-blue-600",
      role: "Leader",
    },
    {
      id: 2,
      initials: "SK",
      name: "Sarah Kim",
      color: "from-purple-400 to-purple-600",
      role: "Admin",
    },
    {
      id: 3,
      initials: "MR",
      name: "Mike Ross",
      color: "from-green-400 to-green-600",
      role: "Viewer",
    },
    {
      id: 4,
      initials: "AL",
      name: "Anna Lee",
      color: "from-pink-400 to-pink-600",
      role: "Viewer",
    },
    {
      id: 5,
      initials: "TC",
      name: "Tom Chen",
      color: "from-amber-400 to-amber-600",
      role: "Viewer",
    },
  ],
  budget: { used: 2400, total: 3500 },
};

const itineraryDays = [
  {
    day: 1,
    date: "March 15",
    title: "Arrival Day",
    activities: [
      {
        id: 1,
        time: "2:00 PM",
        title: "Check into Airbnb",
        location: "South Beach",
        addedBy: "JD",
      },
      {
        id: 2,
        time: "6:00 PM",
        title: "Welcome Dinner",
        location: "Ocean Drive",
        addedBy: "SK",
      },
      {
        id: 3,
        time: "9:00 PM",
        title: "Beach Walk",
        location: "Miami Beach",
        addedBy: "MR",
      },
    ],
  },
  {
    day: 2,
    date: "March 16",
    title: "Beach Day",
    activities: [
      {
        id: 4,
        time: "10:00 AM",
        title: "Beach Volleyball",
        location: "South Beach",
        addedBy: "AL",
      },
      {
        id: 5,
        time: "1:00 PM",
        title: "Lunch at La Sandwicherie",
        location: "South Beach",
        addedBy: "TC",
      },
    ],
  },
  {
    day: 3,
    date: "March 17",
    title: "City Exploration",
    activities: [],
  },
];

const chatMessages = [
  {
    id: 1,
    user: "SK",
    message: "Can't wait for this trip! 🏖️",
    time: "10:30 AM",
    color: "from-purple-400 to-purple-600",
  },
  {
    id: 2,
    user: "JD",
    message: "Just booked our Airbnb! It has an ocean view 🌊",
    time: "11:15 AM",
    color: "from-blue-400 to-blue-600",
  },
  {
    id: 3,
    user: "MR",
    message: "Should we rent a car or use Uber?",
    time: "11:20 AM",
    color: "from-green-400 to-green-600",
  },
  {
    id: 4,
    user: "AL",
    message: "I think Uber would be easier! No parking worries",
    time: "11:45 AM",
    color: "from-pink-400 to-pink-600",
  },
  {
    id: 5,
    user: "TC",
    message: "Agreed! Plus we can split costs easily",
    time: "12:00 PM",
    color: "from-amber-400 to-amber-600",
  },
];

interface TripProps {
  userRole: "Leader" | "Admin" | "Viewer";
  currentUserId: string;
}

export function Trip({ userRole, currentUserId }: TripProps) {
  const [activeSection, setActiveSection] = useState("itinerary");
  const [newMessage, setNewMessage] = useState("");

  const isViewer = userRole === "Viewer";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ChevronLeft size={20} />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {tripData.name}
              </h1>
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-600">{tripData.dates}</p>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-sm ${
                    userRole === "Leader"
                      ? "bg-amber-100 text-amber-700"
                      : userRole === "Admin"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {userRole}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              {tripData.members.map((member) => (
                <Avatar
                  key={member.id}
                  className="w-8 h-8 border-2 border-white -ml-2 first:ml-0"
                >
                  <AvatarFallback
                    className={`text-xs bg-linear-to-br ${member.color} text-white`}
                  >
                    {member.initials}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-xl">
              <DollarSign size={16} className="text-amber-600" />
              <span className="text-sm font-medium text-gray-900">
                ${tripData.budget.used} / ${tripData.budget.total}
              </span>
            </div>

            <Button variant="ghost" size="icon">
              <MoreVertical size={20} />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
          <nav className="p-4 space-y-1">
            <button
              onClick={() => setActiveSection("overview")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                activeSection === "overview"
                  ? "bg-amber-50 text-amber-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <LayoutGrid size={20} />
              <span className="font-medium">Overview</span>
            </button>

            <button
              onClick={() => setActiveSection("itinerary")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                activeSection === "itinerary"
                  ? "bg-amber-50 text-amber-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Calendar size={20} />
              <span className="font-medium">Itinerary</span>
            </button>

            <Link href={`/trip/${tripData.id}/expenses`}>
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-gray-700 hover:bg-gray-50">
                <DollarSign size={20} />
                <span className="font-medium">Expenses</span>
              </button>
            </Link>

            <button
              onClick={() => setActiveSection("chat")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                activeSection === "chat"
                  ? "bg-amber-50 text-amber-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <MessageSquare size={20} />
              <span className="font-medium">Chat</span>
              <span className="ml-auto bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                3
              </span>
            </button>

            <button
              onClick={() => setActiveSection("members")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                activeSection === "members"
                  ? "bg-amber-50 text-amber-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Users size={20} />
              <span className="font-medium">Members</span>
            </button>
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-4xl">
            {activeSection === "itinerary" && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-gray-900">
                      Day-by-Day Itinerary
                    </h2>
                    {isViewer && (
                      <span className="flex items-center gap-1 text-[10px] font-black text-gray-400 bg-gray-100 px-2 py-1 rounded-md uppercase tracking-tighter">
                        <Lock size={12} /> Read Only
                      </span>
                    )}
                  </div>
                  <Button
                    disabled={isViewer}
                    className={`transition-all ${
                      isViewer
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold rounded-xl"
                    }`}
                  >
                    <Plus className="mr-2" size={18} />
                    Add Day
                  </Button>
                </div>

                <div className="space-y-6">
                  {itineraryDays.map((day) => (
                    <div
                      key={day.day}
                      className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
                    >
                      <div className="bg-linear-to-r from-amber-500 to-orange-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white/90 text-sm">
                              Day {day.day}
                            </p>
                            <h3 className="text-white text-xl font-bold">
                              {day.title}
                            </h3>
                            <p className="text-white/90 text-sm">{day.date}</p>
                          </div>
                          <Button
                            disabled={isViewer}
                            variant="ghost"
                            size="sm"
                            className={`text-white ${isViewer ? "opacity-0 pointer-events-none" : "hover:bg-white/20"}`}
                          >
                            <Plus size={18} />
                          </Button>
                        </div>
                      </div>

                      <div className="p-6">
                        {day.activities.length > 0 ? (
                          <div className="space-y-3">
                            {day.activities.map((activity) => (
                              <div
                                key={activity.id}
                                className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                    <Clock
                                      size={20}
                                      className="text-amber-600"
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-gray-900">
                                        {activity.title}
                                      </p>
                                      <span className="text-xs text-gray-500">
                                        • by {activity.addedBy}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                                      <span className="flex items-center gap-1">
                                        <Clock size={14} />
                                        {activity.time}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <MapPin size={14} />
                                        {activity.location}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {!isViewer && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <MoreVertical size={16} />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <button
                            disabled={isViewer}
                            className={`w-full p-8 border-2 border-dashed rounded-xl transition-colors group ${
                              isViewer
                                ? "border-gray-100 cursor-not-allowed"
                                : "border-gray-300 hover:border-amber-400 hover:bg-amber-50/50"
                            }`}
                          >
                            <Plus
                              className={`mx-auto mb-2 ${isViewer ? "text-gray-200" : "text-gray-400 group-hover:text-amber-600"}`}
                              size={24}
                            />
                            <p
                              className={
                                isViewer
                                  ? "text-gray-300"
                                  : "text-gray-600 group-hover:text-amber-700 font-medium"
                              }
                            >
                              {isViewer
                                ? "No activities planned"
                                : "Add your first activity ✈️"}
                            </p>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeSection === "members" && (
              <MemberManagement
                groupId={tripData.id.toString()}
                currentUserId={currentUserId}
              />
            )}

            {/* ... other sections like overview/chat ... */}
          </div>
        </main>

        <aside className="hidden lg:flex w-96 bg-white border-l border-gray-200 flex-col">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-bold text-gray-900">Group Chat</h3>
            <p className="text-sm text-gray-600">
              {tripData.members.length} members
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.map((msg) => (
              <div key={msg.id} className="flex gap-3">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarFallback
                    className={`text-xs bg-linear-to-br ${msg.color} text-white`}
                  >
                    {msg.user}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {msg.user}
                    </span>
                    <span className="text-xs text-gray-500">{msg.time}</span>
                  </div>
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2">
                    <p className="text-sm text-gray-900">{msg.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-gray-200">
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                disabled={isViewer}
              >
                <Paperclip size={18} />
              </Button>
              <Input
                placeholder={
                  isViewer
                    ? "Chat is read-only for viewers"
                    : "Type a message..."
                }
                value={newMessage}
                disabled={isViewer}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 rounded-xl border-gray-200 focus:ring-amber-500"
              />
              <Button
                size="icon"
                disabled={isViewer || !newMessage}
                className={`shrink-0 rounded-xl text-white ${
                  isViewer
                    ? "bg-gray-200"
                    : "bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
                }`}
              >
                <Send size={18} />
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
