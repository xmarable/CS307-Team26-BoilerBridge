"use client";

import {
  Plus,
  Calendar,
  ArrowUpRight,
  MapPin,
  Users,
  Wallet,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import Link from "next/link";

interface DashboardProps {
  initialData: {
    displayName: string;
    profileImage?: string | null;
    groups: any[];
    upcomingSchedule: {
      id: string;
      groupId: string;
      groupName: string;
      destination: string;
      title: string;
      startTime: string;
      endTime?: string;
      location?: string;
    }[];
  };
}

function getGroupImageSrc(group: any, index: number) {
  if (group.groupImage) return group.groupImage;

  const fallbackImages = [
    "https://images.unsplash.com/photo-1586195518174-b88cd52f6571?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1200",
    "https://images.unsplash.com/photo-1758270705172-07b53627dfcb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1200",
    "https://images.unsplash.com/photo-1758272959140-e727ef77bbda?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1200",
    "https://images.unsplash.com/photo-1770563182248-165e7c6b4492?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1200",
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1200",
  ];

  const seed = String(group.groupID || group._id || index);
  const hash = [...seed].reduce((value, char) => value + char.charCodeAt(0), 0);

  return fallbackImages[hash % fallbackImages.length];
}

export function Dashboard({ initialData }: DashboardProps) {
  const groups = initialData.groups || [];
  const upcomingSchedule = initialData.upcomingSchedule || [];

  const formatScheduleTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* welcome header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-black text-bb-text mb-1 tracking-tight">
              Welcome back, {initialData.displayName}!
            </h1>
            <p className="text-bb-text-muted font-medium">
              Manage and plan your adventures
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/groups/new">
              <Button
                aria-label="Create Group"
                className="bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black rounded-xl shadow-md transition-all px-6"
              >
                <Plus className="mr-2" size={18} />
                Create Group
              </Button>
            </Link>
            <Link href="/dashboard/trip">
              <Button className="bg-bb-surface border border-bb-border text-bb-text font-black rounded-xl shadow-sm hover:bg-bb-surface-subtle transition-all px-6">
                Plan a trip
              </Button>
            </Link>
          </div>
        </div>

        {/* groups grid - 3 columns on desktop */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {groups.length > 0 ? (
            groups.map((group, index) => {
              const spent = group.totalExpenses || 0;
              const total = group.budgetLimit || 1;
              const progress = Math.min((spent / total) * 100, 100);

              return (
                <Link
                  key={group.groupID || group._id}
                  href={`/dashboard/groups/${group.groupID || group._id}`}
                >
                  <Card className="bg-bb-surface rounded-[2.5rem] border border-bb-border overflow-hidden hover:border-bb-brand hover:shadow-xl transition-all group h-full flex flex-col">
                    {/* group image with destination fallback */}
                    <div className="h-48 overflow-hidden relative bg-bb-surface-subtle">
                      <img
                        src={getGroupImageSrc(group, index)}
                        alt={group.groupName}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />

                      {!group.groupImage && (
                        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center opacity-20 pointer-events-none">
                          <ImageIcon size={48} className="text-bb-text-muted" />
                          <span className="text-[10px] font-black uppercase tracking-widest mt-2">
                            Searching for photo...
                          </span>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-linear-to-t from-bb-surface via-transparent to-transparent opacity-60" />

                      <div className="absolute top-4 right-4 p-2 rounded-xl bg-bb-surface/80 backdrop-blur-md border border-bb-border group-hover:bg-bb-brand group-hover:text-white transition-colors shadow-sm">
                        <ArrowUpRight size={20} />
                      </div>

                      <div className="absolute bottom-4 left-6">
                        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                          <MapPin size={12} className="text-amber-400" />
                          <span className="text-[10px] font-black text-white uppercase tracking-widest">
                            {group.tripToCity ||
                              group.destination ||
                              "Trip destination TBD"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-8 flex-1 flex flex-col pt-4">
                      <h3 className="font-black text-2xl text-bb-text tracking-tight mb-6">
                        {group.groupName}
                      </h3>

                      <div className="flex items-center gap-6 mb-8">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-bb-text-muted uppercase tracking-widest">
                            Members
                          </span>
                          <div className="flex -space-x-2 mt-1.5">
                            {(group.membersList || [])
                              .slice(0, 4)
                              .map((m: any, idx: number) => (
                                <Avatar
                                  key={idx}
                                  className="h-7 w-7 ring-2 ring-bb-surface border-none shadow-sm"
                                >
                                  <AvatarFallback className="bg-bb-surface-subtle text-bb-text text-[10px] font-black">
                                    {String(m.username || "U")
                                      .charAt(0)
                                      .toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                            {group.membersList?.length > 4 && (
                              <div className="h-7 w-7 rounded-full bg-bb-surface-subtle ring-2 ring-bb-surface flex items-center justify-center text-[10px] font-black text-bb-text-muted">
                                +{group.membersList.length - 4}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="w-px h-8 bg-bb-border" />
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-bb-text-muted uppercase tracking-widest">
                            Activities
                          </span>
                          <span className="text-sm font-black text-bb-text mt-1">
                            {group.activitiesCount || 0} Total
                          </span>
                        </div>
                      </div>

                      <div className="mt-auto pt-6 border-t border-bb-border">
                        <div className="flex justify-between text-[10px] font-black text-bb-text-muted uppercase tracking-widest mb-3">
                          <div className="flex items-center gap-1.5">
                            <Wallet size={12} className="text-bb-brand" />
                            <span>Budget Progress</span>
                          </div>
                          <span className="text-bb-text">
                            ${spent} / ${total}
                          </span>
                        </div>
                        <div className="w-full bg-bb-surface-subtle rounded-full h-2.5">
                          <div
                            className="bg-linear-to-r from-amber-500 to-orange-600 h-2.5 rounded-full transition-all duration-1000 shadow-sm"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })
          ) : (
            <div className="col-span-full py-24 text-center bg-bb-surface rounded-[2.5rem] border-2 border-dashed border-bb-border">
              <Plus className="mx-auto text-bb-text-muted mb-4" size={48} />
              <p className="text-bb-text-muted font-black text-xl">
                No groups joined yet. Create one now!
              </p>
              <Link
                href="/dashboard/groups/new"
                className="mt-4 inline-block font-bold text-bb-brand hover:underline"
              >
                Create your first group →
              </Link>
            </div>
          )}
        </div>

        {/* upcoming schedule card */}
        <Card className="bg-bb-surface rounded-[2.5rem] border border-bb-border overflow-hidden">
          <CardHeader className="p-8 border-b border-bb-border bg-linear-to-b from-bb-surface-subtle to-bb-surface">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-bb-surface rounded-2xl flex items-center justify-center border border-bb-border shadow-sm">
                  <Calendar className="text-bb-brand" size={28} />
                </div>
                <div>
                  <CardTitle className="text-2xl font-black text-bb-text tracking-tight">
                    Upcoming Schedule
                  </CardTitle>
                  <p className="text-sm font-bold text-bb-text-muted uppercase tracking-widest">
                    Your next 7 days
                  </p>
                </div>
              </div>
              <Link href="/dashboard/alltrips">
                <Button
                  variant="ghost"
                  className="text-amber-600 font-black text-xs uppercase tracking-widest hover:bg-bb-surface-subtle"
                >
                  View Full Itinerary
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-12 text-center">
            {upcomingSchedule.length > 0 ? (
              <div className="space-y-4 text-left">
                {upcomingSchedule.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-bb-border bg-bb-surface-subtle p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-bb-text-muted">
                          {item.groupName}
                        </p>
                        <h3 className="mt-1 text-lg font-black text-bb-text">
                          {item.title}
                        </h3>
                        <p className="mt-1 text-sm font-medium text-bb-text-muted">
                          {item.destination}
                          {item.location ? ` · ${item.location}` : ""}
                        </p>
                      </div>
                      <div className="text-sm font-bold text-bb-text-sub sm:text-right">
                        {formatScheduleTime(item.startTime)}
                        {item.endTime ? (
                          <p className="text-xs font-black uppercase tracking-widest text-bb-text-muted">
                            until {formatScheduleTime(item.endTime)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="p-6 bg-bb-surface-subtle rounded-full mb-2">
                  <Calendar className="text-bb-text-muted/40" size={48} />
                </div>
                <p className="text-bb-text-muted font-black text-xl">
                  No upcoming events.
                </p>
                <p className="text-bb-text-muted/60 font-medium">
                  Add activities to your trip to see them here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
