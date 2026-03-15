"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  Shield,
  ShieldCheck,
  Crown,
  Loader2,
  Trash2,
  LogOut,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface Member {
  userId: string;
  name: string;
  role: "Leader" | "Admin" | "Viewer";
}

interface MemberManagementProps {
  groupId: string;
  currentUserId: string;
  onUpdate?: () => void;
}

export function MemberManagement({
  groupId,
  currentUserId,
  onUpdate,
}: MemberManagementProps) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const currentUserRole = members.find((m) => m.userId === currentUserId)?.role;
  const isCurrentUserLeader = currentUserRole === "Leader";
  const isCurrentUserAdmin = currentUserRole === "Admin";

  useEffect(() => {
    fetchMembers();
  }, [groupId]);

  const fetchMembers = async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}/members`);
      const data = await res.json();
      if (res.ok) {
        setMembers(data);
      }
    } catch (err) {
      console.error("failed to fetch members", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleAction = async (
    targetUserId: string,
    action: "TOGGLE_ROLE" | "TRANSFER_LEADERSHIP",
    newRole?: string,
  ) => {
    setProcessingId(targetUserId);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId,
          newRole,
          action,
        }),
      });

      if (res.ok) {
        await fetchMembers();
        if (onUpdate) onUpdate();
      } else {
        const errData = await res.json();
        alert(errData.error || "action failed");
      }
    } catch (err) {
      console.error("error updating role", err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    const isSelf = userId === currentUserId;
    const confirmMsg = isSelf
      ? "Are you sure you want to leave this group?"
      : `Are you sure you want to remove ${name} from the group?`;

    if (!confirm(confirmMsg)) return;

    if (isSelf && isCurrentUserLeader && members.length > 1) {
      alert("You must transfer leadership to another member before leaving.");
      return;
    }

    setProcessingId(userId);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        if (isSelf) {
          router.push("/dashboard/groups");
        } else {
          await fetchMembers();
          if (onUpdate) onUpdate();
        }
      } else {
        const errData = await res.json();
        alert(errData.error || "failed to remove member");
      }
    } catch (err) {
      console.error("error removing member", err);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin text-amber-500" />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-black text-gray-900">Group Members</h3>
        <button
          onClick={() => handleRemoveMember(currentUserId, "myself")}
          className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest text-red-500 hover:bg-red-50 rounded-xl transition-all"
        >
          <LogOut size={14} />
          Leave Group
        </button>
      </div>

      <div className="space-y-3">
        {members.map((member) => (
          <div
            key={member.userId}
            className="flex items-center justify-between p-5 bg-gray-50 rounded-4xl border border-gray-100 transition-all hover:bg-white hover:shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-amber-600 shadow-xs border border-gray-50">
                <User size={24} />
              </div>
              <div>
                <p className="font-black text-gray-900">
                  {member.name} {member.userId === currentUserId && "(You)"}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                      member.role === "Leader"
                        ? "bg-amber-500 text-white shadow-sm shadow-amber-100"
                        : member.role === "Admin"
                          ? "bg-blue-500 text-white shadow-sm shadow-blue-100"
                          : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {member.role}
                  </span>
                </div>
              </div>
            </div>

            {/* Controls */}
            {member.userId !== currentUserId &&
              (isCurrentUserLeader || isCurrentUserAdmin) && (
                <div className="flex items-center gap-2">
                  {processingId === member.userId ? (
                    <Loader2
                      size={18}
                      className="animate-spin text-gray-400 mr-2"
                    />
                  ) : (
                    <>
                      {isCurrentUserLeader && (
                        <>
                          <button
                            onClick={() =>
                              handleRoleAction(
                                member.userId,
                                "TOGGLE_ROLE",
                                member.role === "Admin" ? "Viewer" : "Admin",
                              )
                            }
                            className="p-2.5 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-200 text-gray-400 hover:text-blue-600 shadow-xs"
                            title={
                              member.role === "Admin"
                                ? "Demote to Viewer"
                                : "Promote to Admin"
                            }
                          >
                            {member.role === "Admin" ? (
                              <ShieldCheck size={20} />
                            ) : (
                              <Shield size={20} />
                            )}
                          </button>

                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  `Transfer leadership to ${member.name}? You will become an Admin.`,
                                )
                              ) {
                                handleRoleAction(
                                  member.userId,
                                  "TRANSFER_LEADERSHIP",
                                );
                              }
                            }}
                            className="p-2.5 hover:bg-white rounded-xl transition-all border border-transparent hover:border-amber-200 text-gray-400 hover:text-amber-500 shadow-xs"
                            title="Transfer Leadership"
                          >
                            <Crown size={20} />
                          </button>
                        </>
                      )}

                      {(isCurrentUserLeader ||
                        (isCurrentUserAdmin && member.role === "Viewer")) && (
                        <button
                          onClick={() =>
                            handleRemoveMember(member.userId, member.name)
                          }
                          className="p-2.5 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100 text-gray-400 hover:text-red-500 shadow-xs"
                          title="Remove from Group"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
          </div>
        ))}
      </div>
    </div>
  );
}
