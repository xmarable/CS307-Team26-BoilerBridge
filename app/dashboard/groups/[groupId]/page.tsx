"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Users, Calendar, ArrowRight } from "lucide-react";

type Group = {
  groupID: string;
  groupName: string;
  description: string;
  membersList: any[];
  createdAt: string;
};

export default function MyGroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tripCountLabel = useMemo(
    () => `${groups.length} group${groups.length === 1 ? "" : "s"}`,
    [groups.length],
  );

  async function loadGroups() {
    try {
      setError(null);
      setLoading(true);
      const res = await fetch("/api/groups", {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (res.status === 401) {
        setGroups([]);
        setError("Please sign in to view your groups.");
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to fetch groups");
      }

      const data = await res.json();

      // Ensure we are setting an array to prevent .map crashes
      if (Array.isArray(data)) {
        setGroups(data);
      } else if (
        data &&
        typeof data === "object" &&
        Array.isArray(data.groups)
      ) {
        setGroups(data.groups);
      } else {
        setGroups([]);
      }
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGroups();
  }, []);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">
            My Groups
          </h1>
          <p className="text-gray-500 mt-1">
            Select a group to manage your trip and view the board.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-block rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm font-bold text-gray-600 shadow-xs">
            {tripCountLabel}
          </span>
          <Link href="/dashboard/groups/new">
            <button className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-6 rounded-2xl shadow-lg shadow-amber-200 transition-all active:scale-95">
              <Plus size={20} />
              Create Group
            </button>
          </Link>
        </div>
      </div>

      {/* States */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-48 bg-gray-100 animate-pulse rounded-[2.5rem]"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-[2.5rem] border border-red-100 bg-red-50 p-8 text-center">
          <p className="text-red-600 font-bold mb-4">{error}</p>
          <button
            onClick={loadGroups}
            className="bg-white border border-red-200 text-red-600 px-6 py-2 rounded-xl font-bold hover:bg-red-100 transition-colors"
          >
            Try again
          </button>
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400">
            <Users size={32} />
          </div>
          <p className="text-gray-400 font-bold text-lg">
            You aren't in any groups yet.
          </p>
          <Link
            href="/dashboard/groups/new"
            className="mt-4 inline-block text-amber-600 font-black hover:underline"
          >
            Create your first group
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <Link
              key={group.groupID}
              href={`/dashboard/groups/${group.groupID}`}
            >
              <div className="group bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-amber-200 transition-all flex flex-col h-full cursor-pointer">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-amber-50 rounded-2xl text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                    <Users size={24} />
                  </div>
                  <ArrowRight
                    size={20}
                    className="text-gray-300 group-hover:text-amber-500 transition-colors"
                  />
                </div>

                <h2 className="text-xl font-black text-gray-900 mb-2 truncate">
                  {group.groupName}
                </h2>
                <p className="text-gray-500 text-sm line-clamp-2 mb-6 grow">
                  {group.description || "No description provided."}
                </p>

                <div className="flex items-center gap-4 pt-4 border-t border-gray-50 mt-auto">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
                    <Users size={14} />
                    <span>{group.membersList?.length || 0} Members</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
                    <Calendar size={14} />
                    <span>Active</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
