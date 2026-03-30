"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
  Lock,
  Loader2,
  ArrowRight,
  Heart,
  UserPlus,
  Search,
  X,
  Image,
  AlignEndHorizontal
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MemberManagement } from "@/components/MemberManagement";
import MustHavesPanel from "@/components/group/MustHavesPanel";
import CalendarEventsPanel from "@/components/group/CalendarEventsPanel";
import GroupMessagesPanel from "@/components/messaging/GroupMessagesPanel";
import GroupPhotosPanel from "@/components/photos/GroupPhotoPanel";
import { Badge } from "@/components/ui/badge";
import GroupPollsPanel from "@/components/polls/GroupPollsPanel";

type GroupSummary = {
    groupID: string;
    groupName: string;
    leaderID: string;
    members: string[];
}

type GroupState = {
  _id: string;
  groupID: string;
  groupName: string;
  description?: string;
  leaderID?: string;
  membersList: { userId: string; role: string }[];
  pendingRequests?: { email: string; sentAt: string }[];
  isLeader?: boolean;
  currentUserId: string;
  budget?: { used: number; total: number };
};

type Friend = {
  userId: string;
  username: string;
  email: string;
};

export default function GroupDashboard() {
  const params = useParams();
  const router = useRouter();
  const groupId = params?.groupId as string | undefined;

  const [group, setGroup] = useState<GroupState | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(!!groupId);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("itinerary");

  const [invitationEmail, setInvitationEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");

  const fetchGroup = useCallback(async () => {
    if (!groupId) return;
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        credentials: "include",
      });
      if (res.status === 401) return setError("Please log in.");
      if (res.status === 403 || res.status === 404)
        return setError("Access denied.");

      const data = await res.json();
      if (data?.group) {
        setGroup(data.group);
      }
    } catch {
      setError("Failed to load group.");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const fetchFriends = useCallback(async () => {
    try {
      const res = await fetch("/api/friends", { credentials: "include" });
      const data = await res.json();
      if (res.ok) setFriends(data.friends || []);
    } catch (err) {
      console.error("failed to fetch friends", err);
    }
  }, []);

  useEffect(() => {
    fetchGroup();
    fetchFriends();
  }, [fetchGroup, fetchFriends]);

  const handleInvite = async (email: string) => {
    const targetEmail = email || invitationEmail.trim();
    if (!targetEmail || isInviting) return;

    setIsInviting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });

      const data = await res.json();
      if (res.ok) {
        setInvitationEmail("");
        await fetchGroup();
      } else {
        alert(data.error || "failed to send invitation");
      }
    } catch (err) {
      alert("something went wrong");
    } finally {
      setIsInviting(false);
    }
  };

  const handleCancelInvite = async (email: string) => {
    if (!confirm(`Cancel invitation for ${email}?`)) return;
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        await fetchGroup();
      } else {
        const data = await res.json();
        alert(data.error || "failed to cancel invitation");
      }
    } catch (err) {
      alert("something went wrong");
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-amber-500" size={40} />
      </div>
    );

  if (error || !group)
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-center bg-gray-50">
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-200 shadow-sm max-w-md w-full">
          <p className="text-red-600 font-bold mb-6">
            {error || "Group not found"}
          </p>
          <Link href="/dashboard">
            <Button variant="outline" className="rounded-xl w-full">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );

  const isLeader = group.isLeader === true;
  const userRole =
    group.membersList?.find((m) => m.userId === group.currentUserId)?.role ||
    "Viewer";
  const isViewer = userRole === "Viewer";

  const filteredFriends = friends.filter(
    (f) =>
      f.username.toLowerCase().includes(friendSearch.toLowerCase()) ||
      f.email.toLowerCase().includes(friendSearch.toLowerCase()),
  );

  return (
    <div className="p-6 lg:p-10 max-w-(--突破-7xl) mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <Link href="/dashboard">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-12 w-12 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100 transition-all"
            >
              <ChevronLeft size={28} className="text-gray-600" />
            </Button>
          </Link>
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">
              {group.groupName}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-black text-amber-700 uppercase tracking-widest bg-amber-100 px-3 py-1 rounded-full">
                {userRole}
              </span>
              {isViewer && (
                <span className="flex items-center gap-1 text-[10px] font-black text-gray-400 bg-gray-100 px-2 py-1 rounded-md uppercase">
                  <Lock size={12} /> Read Only
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-gray-100 px-5 py-2.5 rounded-2xl shadow-sm">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-bold text-gray-600">Trip Active</span>
          </div>
          <Button
            variant="outline"
            className="rounded-2xl border-gray-200 bg-white hover:bg-gray-50"
          >
            <MoreVertical size={20} className="text-gray-400" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <aside className="lg:col-span-2">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm space-y-2 sticky top-10 border border-gray-50">
            <SidebarButton
              active={activeSection === "overview"}
              onClick={() => setActiveSection("overview")}
              icon={<LayoutGrid size={22} />}
              label="Overview"
            />
            <SidebarButton
              active={activeSection === "itinerary"}
              onClick={() => setActiveSection("itinerary")}
              icon={<Calendar size={22} />}
              label="Itinerary"
            />
            <SidebarButton
              active={activeSection === "polls"}
              onClick={() => setActiveSection("polls")}
              icon={<AlignEndHorizontal size={22} />}
              label="Polls"
            />
            <SidebarButton
              active={activeSection === "messages"}
              onClick={() => setActiveSection("messages")}
              icon={<MessageSquare size={22}/>}
              label="Messages"
            />
            <SidebarButton
              active={activeSection === "photos"}
              onClick={() => setActiveSection("photos")}
              icon={<Image size={22} />}
              label="Photos"
            />
            <SidebarButton
              active={activeSection === "members"}
              onClick={() => setActiveSection("members")}
              icon={<Users size={22} />}
              label="Members"
            />
          </div>
        </aside>

        <main className="lg:col-span-10">
          {activeSection === "itinerary" && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <section className="space-y-4 h-full flex flex-col">
                <div className="flex items-center gap-3 px-2">
                  <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                    <Calendar size={20} />
                  </div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                    Timeline
                  </h2>
                </div>
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 overflow-hidden flex-1">
                  <CalendarEventsPanel groupId={groupId!} />
                </div>
              </section>

              <section className="space-y-4 h-full flex flex-col">
                <div className="flex items-center gap-3 px-2">
                  <div className="p-2 bg-pink-50 rounded-xl text-pink-600">
                    <Heart size={20} />
                  </div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                    Must-Haves
                  </h2>
                </div>
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 overflow-hidden flex-1">
                  <MustHavesPanel groupId={groupId!} />
                </div>
              </section>
            </div>
          )}

          {activeSection === "members" && (
            <div className="w-full space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 w-full">
                <MemberManagement
                  groupId={groupId!}
                  currentUserId={group.currentUserId || ""}
                  onUpdate={fetchGroup} // added to refresh UI after member updates
                />
              </div>

              {isLeader &&
                group.pendingRequests &&
                group.pendingRequests.length > 0 && (
                  <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 w-full">
                    <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
                      <Clock size={20} className="text-amber-500" /> Pending
                      Invitations
                    </h3>
                    <div className="space-y-3">
                      {group.pendingRequests.map((req, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100"
                        >
                          <span className="font-bold text-gray-700">
                            {req.email}
                          </span>
                          <div className="flex items-center gap-4">
                            <Badge
                              variant="outline"
                              className="text-gray-400 border-gray-200"
                            >
                              Sent {new Date(req.sentAt).toLocaleDateString()}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCancelInvite(req.email)}
                              className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <X size={16} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {isLeader && (
                <div className="bg-linear-to-br from-amber-500 to-orange-600 rounded-[2.5rem] p-10 text-white shadow-xl shadow-amber-100 w-full">
                  <h3 className="text-2xl font-black mb-2 tracking-tight text-white">
                    Invite your squad
                  </h3>
                  <p className="text-white/80 mb-6 font-medium">
                    Add friends to start planning the itinerary together.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                      placeholder="purdue-id@purdue.edu"
                      value={invitationEmail}
                      onChange={(e) => setInvitationEmail(e.target.value)}
                      disabled={isInviting}
                      className="rounded-2xl border-none bg-white/20 backdrop-blur-md text-white placeholder:text-white/60 h-14 focus:ring-2 focus:ring-white flex-1"
                    />
                    <Button
                      onClick={() => handleInvite("")}
                      disabled={isInviting || !invitationEmail.trim()}
                      className="bg-white text-orange-600 hover:bg-gray-100 font-bold px-10 h-14 rounded-2xl transition-all active:scale-95 shadow-lg"
                    >
                      {isInviting ? "Sending..." : "Send Invitation"}
                    </Button>
                  </div>

                  <div className="mt-8 pt-8 border-t border-white/10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                      <h4 className="font-bold text-sm uppercase tracking-widest text-white/60">
                        Quick invite friends
                      </h4>
                      {friends.length > 1 && (
                        <div className="relative w-full md:w-64">
                          <Search
                            className="absolute left-3 top-2.5 text-white/40"
                            size={14}
                          />
                          <input
                            type="text"
                            placeholder="search friends..."
                            value={friendSearch}
                            onChange={(e) => setFriendSearch(e.target.value)}
                            className="w-full bg-white/10 border-none rounded-xl py-2 pl-9 pr-4 text-xs font-bold text-white placeholder:text-white/30 focus:ring-2 focus:ring-white/40 outline-none transition-all"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {friends.length === 0 ? (
                        <p className="text-white/60 italic text-sm">
                          No friends found. Add some in the friends tab!
                        </p>
                      ) : filteredFriends.length === 0 ? (
                        <p className="text-white/40 italic text-sm">
                          No matching friends found.
                        </p>
                      ) : (
                        filteredFriends.map((friend) => {
                          const alreadyIn = group.membersList?.some(
                            (m) => m.userId === friend.userId,
                          );
                          if (alreadyIn) return null;
                          return (
                            <button
                              key={friend.userId}
                              onClick={() => handleInvite(friend.email)}
                              disabled={isInviting}
                              className="bg-white/10 hover:bg-white/20 px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 transition-colors border border-white/10"
                            >
                              <UserPlus size={16} />
                              {friend.username}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSection === "overview" && (
            <div className="bg-white rounded-[2.5rem] p-16 border border-gray-100 shadow-sm text-center animate-in zoom-in-95 duration-500 w-full">
              <div className="w-24 h-24 bg-amber-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 text-amber-600 shadow-inner">
                <LayoutGrid size={48} />
              </div>
              <h3 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">
                Group Hub
              </h3>
              <p className="text-gray-500 text-xl max-w-md mx-auto leading-relaxed font-medium">
                {group.description ||
                  "Every great trip starts with a plan. Welcome to your group's command center!"}
              </p>
            </div>
          )}

          {activeSection === "messages" && (
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden h-[70vh]">
            <GroupMessagesPanel 
              activeGroup={{
                groupID: group.groupID,
                groupName: group.groupName
              }}
              userId={group.currentUserId}
            />
            </div>
          )}

          {activeSection === "photos" && (
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden h-[70vh]">
            <GroupPhotosPanel 
              activeGroup={{
                groupID: group.groupID,
                groupName: group.groupName,
              }}
              userId={group.currentUserId}
              isLeader={isLeader}
            />
            </div>
          )}

          {activeSection === "polls" && (
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden h-[70vh]">
            <GroupPollsPanel 
              activeGroup={{
                groupID: group.groupID,
                groupName: group.groupName,
              }}
              userId={group.currentUserId}
            />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function SidebarButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-6 py-4 rounded-3xl transition-all duration-300 group ${
        active
          ? "bg-linear-to-r from-amber-500 to-orange-600 text-white shadow-xl shadow-amber-200"
          : "text-gray-400 hover:bg-gray-50 hover:text-gray-700"
      }`}
    >
      <span
        className={`${active ? "text-white" : "text-gray-300 group-hover:text-amber-500"} transition-colors`}
      >
        {icon}
      </span>
      <span className="font-bold text-lg tracking-tight">{label}</span>
      {active && (
        <ArrowRight
          size={18}
          className="ml-auto animate-in slide-in-from-left-2"
        />
      )}
    </button>
  );
}
