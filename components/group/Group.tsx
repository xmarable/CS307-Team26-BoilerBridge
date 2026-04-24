/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import "@/app/globals.css";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Calendar,
  CalendarDays,
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
  AlignEndHorizontal,
  Trash2,
  CalendarX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MemberManagement } from "@/components/MemberManagement";
import MustHavesPanel from "@/components/group/MustHavesPanel";
import CalendarEventsPanel from "@/components/group/CalendarEventsPanel";
import ExpenseSummaryPanel from "@/components/group/ExpenseSummaryPanel";
import PaymentRequestsPanel from "@/components/group/PaymentRequestsPanel";
import GroupMessagesPanel from "@/components/messaging/GroupMessagesPanel";
import GroupPhotosPanel from "@/components/photos/GroupPhotoPanel";
import { Badge } from "@/components/ui/badge";
import GroupPollsPanel from "@/components/polls/GroupPollsPanel";
import { RainyDayToggle } from "@/components/RainyDayToggle";
import { useGroupItineraryOffline } from "@/hooks/useGroupItineraryOffline";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { ItineraryOfflineControls } from "@/components/offline/ItineraryOfflineControls";
import { setGroupTripPresence } from "@/lib/offline/groupTripPresence";
import {
  cacheGroupShell,
  clearGroupShell,
  readGroupShell,
} from "@/lib/offline/groupShellCache";
import {
  deleteTripItineraryCache,
  getTripIdForGroup,
  putGroupTripIdMapping,
} from "@/lib/offline/tripItineraryCache";
import SplitCostsPanel from "@/components/group/SplitCostsPanel";
import SharedCostsPanel from "@/components/group/SharedCostsPanel";
import ExternalCalendarPanel from "@/components/calendar/ExternalCalendarPanel";
import ItineraryMapPanel from "@/components/group/ItineraryMapPanel";
import GroupNotification from "@/components/Notification/GroupNotification";
import { GroupBoard } from "@/components/GroupBoard";
import { ActivityVoting } from "./ActivityVoting";
import { SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ItinieraryWeather } from "../itineraries/ItineraryWeather";

type GroupState = {
  _id: string;
  groupID: string;
  groupName: string;
  description?: string;
  leaderID?: string;
  membersList: {
    userId: string;
    role: string;
    username?: string;
    email?: string;
  }[];
  pendingRequests?: { email: string; sentAt: string }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pinnedAnnouncements?: any[];
  isLeader?: boolean;
  currentUserId: string;
  budget?: { used: number; total: number };
};

type Friend = {
  userId: string;
  username: string;
  email: string;
};

type Activity = {
  _id: string;
  name: string;
  upvotes?: number;
  downvotes?: number;
  userVote?: "up" | "down" | null;
};

export default function GroupDashboard() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const groupId = params?.groupId as string | undefined;
  const isOnline = useOnlineStatus();

  const [group, setGroup] = useState<GroupState | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(!!groupId);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("itinerary");
  const [paymentRequestsRefresh, setPaymentRequestsRefresh] = useState(0);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);

  const [allowIteneraryShare, setAllowIteneraryShare] = useState(false);

  const [expensesTab, setExpensesTab] = useState<
    "summary" | "ledger" | "splits"
  >("summary");

  const [invitationEmail, setInvitationEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteScope, setDeleteScope] = useState<"trip" | "group" | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    tripActive,
    groupTripDetail,
    tripPlanLoading,
    tripPlanError,
    isOffline,
    onItinerarySynced,
    resetAfterTripDelete,
    refreshTripItinerary,
    userHasOfflineSave,
    savedAt,
    lastSyncedAt,
    idbSupported,
    removeLocalItineraryCopy,
    saveForOffline,
    itinerarySyncState,
    offlineActionBusy,
  } = useGroupItineraryOffline({
    groupId,
    itinerarySectionOpen: activeSection === "itinerary",
  });

  const tripIdInQuery = searchParams.get("tripId");

  const setToggleState = useCallback(async () => {
    if (!isOnline || !groupId) return;
    try {
      const shareSignal =
        typeof AbortSignal !== "undefined" &&
        typeof AbortSignal.timeout === "function"
          ? AbortSignal.timeout(10_000)
          : undefined;
      const res = await fetch(`/api/itineraries/share?groupId=${groupId}`, {
        signal: shareSignal,
      });

      if (!res.ok) return;

      const data = await res.json();
      setAllowIteneraryShare(data.isActive);
    } catch {
      /* ignore */
    }
  }, [groupId, isOnline]);

  const fetchGroup = useCallback(async () => {
    if (!groupId) return;
    const looksOffline =
      !isOnline ||
      (typeof navigator !== "undefined" && navigator.onLine === false);
    if (looksOffline) {
      const cached = readGroupShell<GroupState>(groupId);
      if (
        cached &&
        typeof cached === "object" &&
        typeof cached.groupID === "string"
      ) {
        setGroup(cached);
        setError(null);
      } else {
        setGroup(null);
        setError(
          "You're offline. Open this group once while online so it can load here without internet.",
        );
      }
      setLoading(false);
      return;
    }
    const netSignal =
      typeof AbortSignal !== "undefined" &&
      typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(12_000)
        : undefined;
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        credentials: "include",
        signal: netSignal,
      });
      if (res.status === 401) return setError("Please log in.");
      if (res.status === 403 || res.status === 404) {
        clearGroupShell(groupId);
        router.push("/dashboard");
        return;
      }

      const data = await res.json();
      if (data?.group) {
        setGroup(data.group);
        cacheGroupShell(groupId, data.group);
      }
    } catch {
      const cached = readGroupShell<GroupState>(groupId);
      if (
        cached &&
        typeof cached === "object" &&
        typeof cached.groupID === "string"
      ) {
        setGroup(cached);
        setError(null);
      } else {
        setError("Failed to load group.");
      }
    } finally {
      setLoading(false);
    }
  }, [groupId, router, isOnline]);

  const fetchFriends = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return;
    }
    try {
      const res = await fetch("/api/friends", { credentials: "include" });
      const data = await res.json();
      if (res.ok) setFriends(data.friends || []);
    } catch (err) {
      console.error("failed to fetch friends", err);
    }
  }, []);

  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      return;
    }
    if (!isOnline) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void setToggleState();
    void fetchGroup();
    void fetchFriends();
  }, [fetchGroup, fetchFriends, groupId, isOnline, setToggleState]);

  useEffect(() => {
    if (!groupId || !tripIdInQuery) return;
    void (async () => {
      await putGroupTripIdMapping(groupId, tripIdInQuery);
      setGroupTripPresence(groupId, tripIdInQuery);
      await refreshTripItinerary();
    })();
  }, [groupId, tripIdInQuery, refreshTripItinerary]);

  useLayoutEffect(() => {
    if (!groupId) return;
    const looksOffline =
      !isOnline ||
      (typeof navigator !== "undefined" && navigator.onLine === false);
    if (!looksOffline) return;
    const cached = readGroupShell<GroupState>(groupId);
    if (
      cached &&
      typeof cached === "object" &&
      typeof cached.groupID === "string"
    ) {
      setGroup(cached);
      setError(null);
    } else {
      setGroup(null);
      setError(
        "You're offline. Open this group once while online so it can load here without internet.",
      );
    }
    setLoading(false);
  }, [groupId, isOnline]);

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
    } catch {
      alert("something went wrong");
    } finally {
      setIsInviting(false);
    }
  };

  const handleToggle = async () => {
    try {
      const nextToggle = !allowIteneraryShare;
      setAllowIteneraryShare(nextToggle);
      await fetch(`/api/itineraries/share`, {
        method: "PATCH",
        body: JSON.stringify({ groupId: groupId, isActive: nextToggle }),
      });
    } catch (e) {
      /* ignore */
    }
  };

  const handleDelete = async () => {
    if (!deleteScope || !groupId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}?scope=${deleteScope}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Delete failed");
        return;
      }
      if (deleteScope === "group") {
        clearGroupShell(groupId);
        router.push("/dashboard/groups");
      } else {
        const tid = groupTripDetail?._id ?? (await getTripIdForGroup(groupId));
        if (tid) void deleteTripItineraryCache(tid, groupId);
        resetAfterTripDelete();
        setDeleteDialogOpen(false);
        setDeleteScope(null);
        await fetchGroup();
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setIsDeleting(false);
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
    } catch {
      alert("something went wrong");
    }
  };

  const handleGetShareLink = async () => {
    const res = await fetch(`/api/itineraries/share`, {
      method: "POST",
      body: JSON.stringify({ groupId: groupId }),
    });

    if (!res.ok) return;
    const data = await res.json();

    await navigator.clipboard.writeText(data.shareURL);
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-bb-surface-subtle">
        <Loader2 className="animate-spin text-bb-brand" size={40} />
      </div>
    );

  if (error || !group)
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-center bg-bb-surface-subtle">
        <div className="bg-bb-surface p-8 rounded-[2.5rem] border border-bb-border shadow-sm max-w-md w-full">
          <p className="text-bb-danger font-bold mb-6">
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
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <Link href="/dashboard">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-12 w-12 hover:bg-bb-surface hover:shadow-sm border border-transparent hover:border-bb-border transition-all"
            >
              <ChevronLeft size={28} className="text-bb-text-sub" />
            </Button>
          </Link>
          <div>
            <h1 className="text-4xl font-black text-bb-text tracking-tight">
              {group.groupName}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-black text-amber-700 uppercase tracking-widest bg-amber-100 px-3 py-1 rounded-full">
                {userRole}
              </span>
              {isViewer && (
                <span className="flex items-center gap-1 text-[10px] font-black text-bb-text-muted bg-bb-surface-inset px-2 py-1 rounded-md uppercase">
                  <Lock size={12} /> Read Only
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-bb-surface border border-bb-border px-5 py-2.5 rounded-2xl shadow-sm">
            <div
              className={`h-2 w-2 rounded-full ${
                tripActive ? "bg-green-500 animate-pulse" : "bg-bb-placeholder"
              }`}
            />
            <span className="text-sm font-bold text-bb-text-sub">
              {tripActive ? "Trip Active" : "No Trip Planned"}
            </span>
          </div>
          {isLeader && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="rounded-2xl border-bb-border-input bg-bb-surface hover:bg-bb-surface-subtle"
                >
                  <MoreVertical size={20} className="text-bb-text-muted" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="bottom"
                align="start"
                sideOffset={8}
                avoidCollisions={false}
                className="w-52 rounded-2xl p-2 shadow-lg border border-bb-border bg-white"
              >
                <DropdownMenuItem
                  disabled={!tripActive}
                  className="flex items-center gap-2 rounded-xl px-4 py-3 font-bold text-amber-600 cursor-pointer hover:bg-amber-50 hover:text-amber-700 disabled:text-bb-placeholder disabled:cursor-not-allowed"
                  onSelect={() => {
                    setDeleteScope("trip");
                    setDeleteDialogOpen(true);
                  }}
                >
                  <CalendarX size={16} className="text-bb-brand" />
                  Delete Trip
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="flex items-center gap-2 rounded-xl px-4 py-3 font-bold text-bb-danger cursor-pointer hover:bg-bb-danger-sub"
                  onSelect={() => {
                    setDeleteScope("group");
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 size={16} />
                  Delete Group
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {!isLeader && (
            <Button
              variant="outline"
              className="rounded-2xl border-bb-border-input bg-bb-surface hover:bg-bb-surface-subtle"
            >
              <MoreVertical size={20} className="text-bb-text-muted" />
            </Button>
          )}
        </div>

        <Sheet open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <SheetContent
            side="right"
            className="bg-bb-surface border-l border-bb-border p-0 flex flex-col w-160 max-w-md rounded-2xl"
          >
            <VisuallyHidden>
              <SheetTitle>
                {deleteScope === "group" ? "Delete Group" : "Delete Trip"}
              </SheetTitle>
            </VisuallyHidden>
            <div
              className={`px-8 pt-10 pb-7 ${
                deleteScope === "group" ? "bg-bb-danger-sub" : "bg-amber-50"
              }`}
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${
                  deleteScope === "group" ? "bg-red-100" : "bg-amber-100"
                }`}
              >
                {deleteScope === "group" ? (
                  <Trash2 size={24} className="text-bb-danger" />
                ) : (
                  <CalendarX size={24} className="text-bb-brand" />
                )}
              </div>
              <h2 className="text-2xl font-black text-bb-text tracking-tight">
                {deleteScope === "group" ? "Delete Group?" : "Delete Trip?"}
              </h2>
              <p
                className={`text-sm font-semibold mt-1 ${
                  deleteScope === "group" ? "text-red-400" : "text-amber-500"
                }`}
              >
                {deleteScope === "group"
                  ? "This cannot be undone."
                  : "Trip data will be removed."}
              </p>
            </div>

            <div className="px-8 py-7 flex-1">
              <p className="text-bb-text-muted leading-relaxed font-medium">
                {deleteScope === "group" ? (
                  <>
                    This will permanently delete{" "}
                    <span className="font-bold text-bb-text">
                      {group.groupName}
                    </span>{" "}
                    and everything inside — itinerary, expenses, messages,
                    photos, and all members.
                  </>
                ) : (
                  <>
                    This will permanently delete the trip and all calendar
                    events for{" "}
                    <span className="font-bold text-bb-text">
                      {group.groupName}
                    </span>
                    . The group and its members will remain intact.
                  </>
                )}
              </p>
            </div>

            <div className="px-8 pb-10 flex flex-col gap-3">
              <Button
                onClick={handleDelete}
                disabled={isDeleting}
                className={`h-14 rounded-2xl font-bold text-base text-white w-full transition-all active:scale-[0.98] ${
                  deleteScope === "group"
                    ? "bg-bb-danger hover:bg-red-600 shadow-lg shadow-red-100"
                    : "bg-linear-to-r from-bb-brand to-bb-brand-to hover:opacity-90 shadow-lg shadow-amber-100"
                }`}
              >
                {isDeleting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin" /> Deleting…
                  </span>
                ) : deleteScope === "group" ? (
                  "Delete Group"
                ) : (
                  "Delete Trip"
                )}
              </Button>
              <Button
                variant="outline"
                className="h-14 rounded-2xl border-bb-border-input font-bold text-bb-text-sub w-full hover:bg-bb-surface-subtle"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setDeleteScope(null);
                }}
                disabled={isDeleting}
              >
                Cancel
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex flex-col gap-6">
        <nav className="bg-bb-surface border border-bb-border rounded-4xl p-2 flex gap-1 shadow-sm w-full overflow-x-auto scrollbar-none">
          <TabButton
            active={activeSection === "overview"}
            onClick={() => setActiveSection("overview")}
            icon={<LayoutGrid size={18} />}
            label="Overview"
          />
          <TabButton
            active={activeSection === "itinerary"}
            onClick={() => setActiveSection("itinerary")}
            icon={<Calendar size={18} />}
            label="Itinerary"
          />
          <TabButton
            active={activeSection === "polls"}
            onClick={() => setActiveSection("polls")}
            icon={<AlignEndHorizontal size={18} />}
            label="Polls"
          />
          {isLeader && (
            <TabButton
              active={activeSection === "notify"}
              onClick={() => setActiveSection("notify")}
              icon={<MessageSquare size={18} />}
              label="Notify"
            />
          )}
          <TabButton
            active={activeSection === "messages"}
            onClick={() => setActiveSection("messages")}
            icon={<MessageSquare size={18} />}
            label="Messages"
          />
          <TabButton
            active={activeSection === "photos"}
            onClick={() => setActiveSection("photos")}
            icon={<Image size={18} />}
            label="Photos"
          />
          <TabButton
            active={activeSection === "members"}
            onClick={() => setActiveSection("members")}
            icon={<Users size={18} />}
            label="Members"
          />
          <TabButton
            active={activeSection === "expenses"}
            onClick={() => setActiveSection("expenses")}
            icon={<DollarSign size={18} />}
            label="Expenses"
          />
          <TabButton
            active={activeSection === "map"}
            onClick={() => setActiveSection("map")}
            icon={<MapPin size={18} />}
            label="Map"
          />
          <TabButton
            active={activeSection === "calendar"}
            onClick={() => setActiveSection("calendar")}
            icon={<CalendarDays size={18} />}
            label="Calendar"
          />
        </nav>

        <main className="flex-1 min-w-0">
          {activeSection === "overview" && (
            <div className="w-full min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <GroupBoard
                groupId={groupId!}
                initialAnnouncements={group.pinnedAnnouncements || []}
                isLeader={isLeader}
              />
            </div>
          )}

          {activeSection === "itinerary" && (
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-10 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
              <section className="space-y-6 flex-1">
                {tripActive || isOffline ? (
                  <ItineraryOfflineControls
                    isOnline={!isOffline}
                    userHasOfflineSave={userHasOfflineSave}
                    savedAt={savedAt}
                    lastSyncedAt={lastSyncedAt}
                    tripPlanError={tripPlanError}
                    hasTripContent={!!groupTripDetail}
                    idbSupported={idbSupported}
                    itinerarySyncState={itinerarySyncState}
                    offlineActionBusy={offlineActionBusy}
                    tripPlanLoading={tripPlanLoading}
                    onSaveForOffline={() => {
                      void (async () => {
                        await saveForOffline();
                        if (groupId && group) {
                          cacheGroupShell(groupId, group);
                        }
                      })();
                    }}
                    onRemoveOffline={() => void removeLocalItineraryCopy()}
                    onRetrySync={() => void refreshTripItinerary()}
                  />
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-3 px-2">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                      <Calendar size={24} />
                    </div>
                    <h2 className="text-3xl font-black text-bb-text tracking-tight">
                      Timeline
                    </h2>
                  </div>
                  {groupId && (
                    <div className="flex flex-l space-x-3 items-center">
                      <Link
                        href={`/dashboard/groups/${groupId}/trip`}
                        className="text-sm font-bold text-amber-700 hover:text-amber-800 underline-offset-2 hover:underline"
                      >
                        Create Trip
                      </Link>
                      <div className="flex flex-l gap-4">
                        <button
                          className="text-amber-700 text-sm"
                          onClick={() => handleGetShareLink()}
                        >
                          Copy Share Link
                        </button>
                        <p className="text-sm text-amber-700">Allow Share:</p>
                        <button
                          type="button"
                          onClick={() => handleToggle()}
                          className={`relative h-5 w-8 rounded-full transition-all ${
                            allowIteneraryShare ? "bg-amber-500" : "bg-gray-200"
                          }`}
                        >
                          <span
                            className={`absolute left-0 top-1 h-3 w-3 rounded-full bg-white shadow transition-transform ${
                              allowIteneraryShare
                                ? "translate-x-4"
                                : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="bg-bb-surface rounded-[2.5rem] border border-bb-border shadow-sm p-8 h-fit min-h-125 space-y-6">
                  <CalendarEventsPanel
                    groupId={groupId!}
                    canPublishItinerary={
                      userRole === "Leader" || userRole === "Admin"
                    }
                    canEdit={userRole === "Leader" || userRole === "Admin"}
                  />
                </div>
              </section>

              <section className="space-y-6 flex-1">
                <div className="flex items-center gap-3 px-2">
                  <div className="p-3 bg-pink-50 rounded-xl text-pink-600">
                    <Heart size={24} />
                  </div>
                  <h2 className="text-3xl font-black text-bb-text tracking-tight">
                    Must-Haves
                  </h2>
                </div>
                <div className="bg-bb-surface rounded-[2.5rem] border border-bb-border shadow-sm p-8 h-fit min-h-125">
                  <MustHavesPanel groupId={groupId!} />
                </div>
              </section>

              <section className="col-span-full w-full">
                <div className="bg-bb-surface rounded-[2.5rem] border border-bb-border shadow-sm p-8 h-fit">
                  <ItinieraryWeather groupId={groupId || ""} />
                </div>
              </section>

              {tripActive || isOffline ? (
                <section className="col-span-full w-full space-y-4 mt-6">
                  <div className="flex items-center gap-3 px-2">
                    <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                      <MapPin size={24} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-3xl font-black text-bb-text tracking-tight">
                        Trip plan
                      </h2>
                      {userHasOfflineSave && idbSupported && (
                        <Badge
                          variant="outline"
                          className="text-xs font-bold border-emerald-200 bg-emerald-50 text-emerald-800"
                        >
                          Available offline
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="bg-bb-surface rounded-[2.5rem] border border-bb-border shadow-sm p-8 w-full space-y-4">
                    {tripPlanLoading && !groupTripDetail ? (
                      <div
                        className="flex items-center justify-center py-8 text-amber-700"
                        role="status"
                        aria-label="Loading itinerary"
                      >
                        <Loader2 className="h-8 w-8 animate-spin" />
                      </div>
                    ) : null}
                    {groupTripDetail ? (
                      <RainyDayToggle
                        trip={groupTripDetail}
                        tripId={groupTripDetail._id}
                        canEdit={!isViewer && !isOffline}
                        onItinerarySynced={onItinerarySynced}
                      />
                    ) : null}
                  </div>
                </section>
              ) : null}
            </div>
          )}

          {activeSection === "polls" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
              <GroupPollsPanel
                activeGroup={{
                  groupID: group.groupID,
                  groupName: group.groupName,
                }}
                userId={group.currentUserId}
                isLeader={isLeader}
              />
            </div>
          )}

          {activeSection === "messages" && (
            <div className="bg-bb-surface rounded-[2.5rem] border border-bb-border shadow-sm overflow-hidden h-[70vh] animate-in fade-in slide-in-from-bottom-4 duration-500">
              <GroupMessagesPanel
                activeGroup={{
                  groupID: group.groupID,
                  groupName: group.groupName,
                }}
                userId={group.currentUserId}
              />
            </div>
          )}

          {activeSection === "photos" && (
            <div className="bg-bb-surface rounded-[2.5rem] border border-bb-border shadow-sm overflow-hidden h-[70vh] animate-in fade-in slide-in-from-bottom-4 duration-500">
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

          {activeSection === "members" && (
            <div className="w-full space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-bb-surface rounded-[2.5rem] border border-bb-border shadow-sm p-8 w-full min-h-40">
                <MemberManagement
                  groupId={groupId!}
                  currentUserId={group.currentUserId || ""}
                  onUpdate={fetchGroup}
                />
              </div>

              {isLeader &&
                group.pendingRequests &&
                group.pendingRequests.length > 0 && (
                  <div className="bg-bb-surface rounded-[2.5rem] border border-bb-border shadow-sm p-8 w-full">
                    <h3 className="text-xl font-black text-bb-text mb-6 flex items-center gap-2">
                      <Clock size={20} className="text-bb-brand" /> Pending
                      Invitations
                    </h3>
                    <div className="space-y-3">
                      {group.pendingRequests.map((req, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-4 bg-bb-surface-subtle rounded-2xl border border-bb-border"
                        >
                          <span className="font-bold text-bb-text-sub">
                            {req.email}
                          </span>
                          <div className="flex items-center gap-4">
                            <Badge
                              variant="outline"
                              className="text-bb-text-muted border-bb-border-input"
                            >
                              Sent {new Date(req.sentAt).toLocaleDateString()}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCancelInvite(req.email)}
                              className="h-8 w-8 text-bb-text-muted hover:text-bb-danger hover:bg-bb-danger-sub rounded-lg transition-colors"
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
                <div className="bg-linear-to-br from-bb-brand to-bb-brand-to rounded-[2.5rem] p-10 text-white shadow-xl shadow-amber-100 w-full">
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
                          const alreadyPending = group.pendingRequests?.some(
                            (p) => p.email === friend.email,
                          );
                          if (alreadyIn || alreadyPending) return null;
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

          {activeSection === "expenses" && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-wrap gap-3 px-1">
                {(["summary", "ledger", "splits"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setExpensesTab(tab)}
                    className={`px-6 py-2.5 rounded-2xl font-bold text-sm transition-all ${
                      expensesTab === tab
                        ? "bg-linear-to-r from-bb-brand to-bb-brand-to text-white shadow-lg shadow-amber-100"
                        : "bg-bb-surface text-bb-text-muted border border-bb-border hover:bg-bb-surface-subtle"
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
              <div className="bg-bb-surface rounded-[2.5rem] border border-bb-border shadow-sm p-8 min-w-0">
                {expensesTab === "summary" ? (
                  <ExpenseSummaryPanel
                    groupId={groupId!}
                    currentUserId={group?.currentUserId}
                    onPaymentRequestCreated={() =>
                      setPaymentRequestsRefresh((n) => n + 1)
                    }
                  />
                ) : expensesTab === "ledger" ? (
                  <SharedCostsPanel
                    groupId={groupId!}
                    currentUserId={group.currentUserId}
                    userRole={userRole}
                  />
                ) : (
                  <SplitCostsPanel
                    groupId={groupId!}
                    currentUserId={group.currentUserId}
                    userRole={userRole}
                  />
                )}
              </div>
              {group?.currentUserId && (
                <PaymentRequestsPanel
                  groupId={groupId!}
                  currentUserId={group.currentUserId}
                  refreshKey={paymentRequestsRefresh}
                />
              )}
            </div>
          )}

          {activeSection === "map" && (
            <div className="bg-bb-surface rounded-[2.5rem] border border-bb-border shadow-sm p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ItineraryMapPanel groupId={groupId!} />
            </div>
          )}

          {activeSection === "calendar" && (
            <div className="bg-bb-surface rounded-[2.5rem] border border-bb-border shadow-sm p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ExternalCalendarPanel groupId={groupId!} />
            </div>
          )}

          {isLeader && activeSection === "notify" && (
            <div className="min-w-0 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              <GroupNotification
                activeGroup={{
                  groupID: group.groupID,
                  groupName: group.groupName,
                }}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function TabButton({
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
      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl transition-all duration-200 font-bold text-sm ${
        active
          ? "bg-linear-to-r from-bb-brand to-bb-brand-to text-white shadow-lg shadow-amber-100"
          : "text-bb-text-muted hover:bg-bb-surface-subtle hover:text-bb-text-sub"
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
