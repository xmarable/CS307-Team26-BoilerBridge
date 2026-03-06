"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import MustHavesPanel from "@/components/group/MustHavesPanel";
import CalendarEventsPanel from "@/components/group/CalendarEventsPanel";

type Member = { id: string; username: string; email: string };

type GroupState = {
  _id: string;
  groupID?: string;
  groupName?: string;
  description?: string;
  leaderID?: string;
  membersList?: string[];
  isLeader?: boolean;
  members?: Member[];
};

export default function GroupPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const [group, setGroup] = useState<GroupState | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState<string | null>(null);

  const [editName, setEditName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [addEmail, setAddEmail] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const [transferToMemberId, setTransferToMemberId] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const router = useRouter();

  const fetchGroup = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/groups/${id}`, { credentials: "include" });
    if (res.status === 401) {
      setError("Please log in to view this group.");
      return;
    }
    if (res.status === 403 || res.status === 404) {
      setError("You don't have access to this group.");
      return;
    }
    const data = await res.json();
    if (data?.group) {
      setGroup(data.group);
      setEditName(data.group.groupName ?? "");
    } else {
      setError("Failed to load group.");
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetchGroup()
      .catch(() => setError("Failed to load group."))
      .finally(() => setLoading(false));
  }, [id, fetchGroup]);

  useEffect(() => {
    if (group?.groupName !== undefined) setEditName(group.groupName);
  }, [group?.groupName]);

  const handleSaveName = async () => {
    if (!id || !group?.isLeader || savingName) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      setNameError("Group name is required.");
      return;
    }
    setNameError(null);
    setSavingName(true);
    try {
      const res = await fetch(`/api/groups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ groupName: trimmed }),
      });
      const data = await res.json();
      if (res.ok && data?.group) {
        setGroup((prev) => (prev ? { ...prev, groupName: data.group.groupName } : null));
      } else {
        setNameError(data?.error ?? "Failed to update name.");
      }
    } catch {
      setNameError("Failed to update name.");
    } finally {
      setSavingName(false);
    }
  };

  const handleAddMember = async () => {
    if (!id || !group?.isLeader || addingMember) return;
    const trimmed = addEmail.trim();
    if (!trimmed) {
      setAddError("Email is required.");
      return;
    }
    setAddError(null);
    setAddingMember(true);
    try {
      const res = await fetch(`/api/groups/${id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (res.ok) {
        setAddEmail("");
        await fetchGroup();
      } else {
        setAddError(data?.error ?? "Failed to add member.");
      }
    } catch {
      setAddError("Failed to add member.");
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!id || !group?.isLeader || removing) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/groups/${id}/members/${memberId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setRemoveMemberId(null);
        await fetchGroup();
      }
    } finally {
      setRemoving(false);
    }
  };

  const handleTransferLeadership = async () => {
    if (!id || !group?.isLeader || !transferToMemberId || transferring) return;
    setTransferError(null);
    setTransferring(true);
    try {
      const res = await fetch(`/api/groups/${id}/leader`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newLeaderId: transferToMemberId }),
      });
      const data = await res.json();
      if (res.ok && data?.group) {
        setGroup(data.group);
        setTransferToMemberId(null);
      } else {
        setTransferError(data?.error ?? "Failed to transfer leadership.");
      }
    } catch {
      setTransferError("Failed to transfer leadership.");
    } finally {
      setTransferring(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!id || leaving) return;
    setLeaveError(null);
    setLeaving(true);
    try {
      const res = await fetch(`/api/groups/${id}/leave`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setLeaveConfirmOpen(false);
        router.push("/groups");
        return;
      }
      setLeaveError(data?.error ?? "You are not allowed to leave.");
    } catch {
      setLeaveError("Failed to leave group.");
    } finally {
      setLeaving(false);
    }
  };

  if (!id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p className="text-gray-600">Invalid group.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error ?? "Group not found."}</p>
          <Link href="/dashboard">
            <Button variant="outline">Back to dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isLeader = group.isLeader === true;
  const memberCount = group.membersList?.length ?? 0;
  const isOnlyMember = isLeader && memberCount === 1;
  const isLeaderWithOthers = isLeader && memberCount > 1;
  const members = group.members ?? [];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col gap-4 text-black">
            {isLeader ? (
              <div>
                <Label htmlFor="group-name" className="text-gray-700">
                  Group name
                </Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    id="group-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="max-w-sm"
                    placeholder="Group name"
                  />
                  <Button
                    onClick={handleSaveName}
                    disabled={savingName || editName.trim() === (group.groupName ?? "")}
                  >
                    {savingName ? "Saving…" : "Save"}
                  </Button>
                </div>
                {nameError && (
                  <p className="mt-1 text-sm text-red-600">{nameError}</p>
                )}
              </div>
            ) : (
              <h1 className="text-2xl font-bold text-gray-900">
                {group.groupName}
              </h1>
            )}
          </div>

          {group.description && (
            <p className="mt-2 text-gray-600">{group.description}</p>
          )}

          <div className="mt-6 flex flex-wrap gap-3 text-black">
            <Link href="/dashboard">
              <Button variant="outline">Back to dashboard</Button>
            </Link>
            <Link href="/groups">
              <Button variant="ghost">My groups</Button>
            </Link>
            <Link href="/groups/new">
              <Button variant="outline">Create another group</Button>
            </Link>
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => {
                setLeaveError(null);
                setLeaveConfirmOpen(true);
              }}
            >
              Leave group
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Members</h2>
          <ul className="space-y-3">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 py-2 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-amber-100 text-amber-800 text-sm">
                      {(m.username || m.email || "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {m.username || m.email || "Unknown"}
                    </p>
                    <p className="text-sm text-gray-500 truncate">{m.email}</p>
                  </div>
                  {group.leaderID === m.id && (
                    <Badge variant="secondary" className="shrink-0 text-black">
                      Leader
                    </Badge>
                  )}
                </div>
                {isLeader && group.leaderID !== m.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => setRemoveMemberId(m.id)}
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>

          {isLeader && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <Label htmlFor="add-email" className="text-gray-700">
                Add member by email
              </Label>
              <div className="mt-1 flex gap-2 text-gray-700">
                <Input
                  id="add-email"
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="teammate@example.com"
                  className="max-w-sm"
                />
                <Button
                  onClick={handleAddMember}
                  disabled={addingMember || !addEmail.trim()}
                >
                  {addingMember ? "Adding…" : "Add"}
                </Button>
              </div>
              {addError && (
                <p className="mt-1 text-sm text-red-600">{addError}</p>
              )}
            </div>
          )}

          {isLeader && (() => {
            const otherMembers = members.filter((m) => m.id !== group.leaderID);
            if (otherMembers.length === 0) return null;
            return (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <Label className="text-gray-700">Transfer leadership</Label>
                <p className="mt-1 text-sm text-gray-500 mb-2">
                  Make another member the leader. You will become a regular member.
                </p>
                <div className="flex flex-wrap gap-2">
                  {otherMembers.map((m) => (
                    <Button
                      key={m.id}
                      variant="outline"
                      size="sm"
                      onClick={() => setTransferToMemberId(m.id)}
                    >
                      Transfer to {m.username || m.email || "Unknown"}
                    </Button>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
        
        {/* ----------- Must-Haves & CalendarEvents UI ---------------- */}
        {/* Calendar */}
        <CalendarEventsPanel groupId={group._id} />

        {/* Must-haves */}
        <MustHavesPanel groupId={group._id} />

        {/* ----------------------------------------- */}
      </div>

      <AlertDialog
        open={removeMemberId !== null}
        onOpenChange={(open) => !open && setRemoveMemberId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              This person will lose access to the group and will get a 403 when
              trying to view it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                removeMemberId && handleRemoveMember(removeMemberId)
              }
              disabled={removing}
              className="bg-red-600 hover:bg-red-700"
            >
              {removing ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={transferToMemberId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTransferToMemberId(null);
            setTransferError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer leadership?</AlertDialogTitle>
            <AlertDialogDescription>
              You will become a regular member and{" "}
              {transferToMemberId
                ? members.find((m) => m.id === transferToMemberId)?.username ||
                  members.find((m) => m.id === transferToMemberId)?.email ||
                  "this member"
                : "the selected member"}{" "}
              will become the leader. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {transferError && (
              <p className="text-sm text-red-600 mr-auto">{transferError}</p>
            )}
            <AlertDialogCancel disabled={transferring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTransferLeadership}
              disabled={transferring}
            >
              {transferring ? "Transferring…" : "Transfer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={leaveConfirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            setLeaveConfirmOpen(false);
            setLeaveError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isOnlyMember ? "Delete group?" : "Leave group?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isOnlyMember
                ? "Leaving this group will delete it and you will lose access to the group and its data. Are you sure you want to continue?"
                : isLeaderWithOthers
                  ? "You are the group leader. If you leave now, leadership will automatically be transferred to another member and you will leave the group. To choose a specific leader, transfer leadership first."
                  : "Are you sure? You will lose access to this group."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {leaveError && (
              <p className="text-sm text-red-600 mr-auto">{leaveError}</p>
            )}
            <AlertDialogCancel disabled={leaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveGroup}
              disabled={leaving}
              className="bg-red-600 hover:bg-red-700"
            >
              {leaving ? "Leaving…" : "Leave"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
