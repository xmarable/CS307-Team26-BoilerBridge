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

  const fetchMembers = async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}/members`);
      const data = await res.json();

      // logic fix: ensure we handle both direct arrays and nested group data
      if (res.ok) {
        setMembers(Array.isArray(data) ? data : data.members || []);
      }
    } catch (err) {
      console.error("failed to fetch members", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

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
      <div className="flex justify-center items-center min-h-37.5">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );

  return (
    <div className="space-y-6 w-full">
      {/* title section updated to match the bold dashboard look */}
      <div className="flex items-center justify-between mb-8 px-2">
        <h3 className="text-2xl font-black text-gray-900 tracking-tight">
          Group Members
        </h3>
        <button
          onClick={() => handleRemoveMember(currentUserId, "myself")}
          className="flex items-center gap-2 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-red-500 hover:bg-red-50 rounded-2xl transition-all border border-transparent hover:border-red-100"
        >
          <LogOut size={16} />
          Leave Group
        </button>
      </div>

      <div className="space-y-4">
        {members.length > 0 ? (
          members.map((member) => (
            <div
              key={member.userId}
              className="flex items-center justify-between p-6 bg-gray-50/50 rounded-4xl border-2 border-gray-50 transition-all hover:bg-white hover:border-amber-100 hover:shadow-xl hover:shadow-amber-50/20 group"
            >
              <div className="flex items-center gap-5">
                {/* rounded icon containers matching the dashboard sidebar icons */}
                <div className="h-14 w-14 bg-white rounded-2xl flex items-center justify-center text-amber-500 shadow-sm border border-gray-100 group-hover:scale-105 transition-transform">
                  <User size={28} />
                </div>
                <div>
                  <p className="text-lg font-black text-gray-900 leading-none">
                    {member.name} {member.userId === currentUserId && "(You)"}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`text-[10px] font-black uppercase tracking-[0.15em] px-3 py-1 rounded-full ${
                        member.role === "Leader"
                          ? "bg-amber-500 text-white shadow-md shadow-amber-100"
                          : member.role === "Admin"
                            ? "bg-blue-500 text-white shadow-md shadow-blue-100"
                            : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {member.role}
                    </span>
                  </div>
                </div>
              </div>

              {/* member controls - only visible to leaders n admins */}
              {member.userId !== currentUserId &&
                (isCurrentUserLeader || isCurrentUserAdmin) && (
                  <div className="flex items-center gap-3">
                    {processingId === member.userId ? (
                      <Loader2
                        size={20}
                        className="animate-spin text-gray-400"
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
                              className="p-3 bg-white hover:bg-blue-50 rounded-2xl transition-all border border-gray-100 hover:border-blue-200 text-gray-400 hover:text-blue-600 shadow-sm"
                              title={
                                member.role === "Admin"
                                  ? "Demote to Viewer"
                                  : "Promote to Admin"
                              }
                            >
                              {member.role === "Admin" ? (
                                <ShieldCheck size={22} />
                              ) : (
                                <Shield size={22} />
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
                              className="p-3 bg-white hover:bg-amber-50 rounded-2xl transition-all border border-gray-100 hover:border-amber-200 text-gray-400 hover:text-amber-500 shadow-sm"
                              title="Transfer Leadership"
                            >
                              <Crown size={22} />
                            </button>
                          </>
                        )}

                        {(isCurrentUserLeader ||
                          (isCurrentUserAdmin && member.role === "Viewer")) && (
                          <button
                            onClick={() =>
                              handleRemoveMember(member.userId, member.name)
                            }
                            className="p-3 bg-white hover:bg-red-50 rounded-2xl transition-all border border-gray-100 hover:border-red-200 text-gray-400 hover:text-red-500 shadow-sm"
                            title="Remove from Group"
                          >
                            <Trash2 size={22} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
            </div>
          ))
        ) : (
          /* logic for empty state if api returns empty array */
          <div className="text-center py-10 border-2 border-dashed border-gray-100 rounded-4xl">
            <p className="text-gray-400 font-bold">
              No members found in this group.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
