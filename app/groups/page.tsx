"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type GroupSummary = {
  _id: string;
  groupID?: string;
  groupName?: string;
  description?: string;
  leaderID?: string;
  membersList?: string[];
};

export default function MyGroupsPage() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/groups", { credentials: "include" })
      .then((res) => {
        if (res.status === 401) {
          setError("Please log in to view your groups.");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.groups) setGroups(data.groups);
        else if (!error) setError("Failed to load groups.");
      })
      .catch(() => setError("Failed to load groups."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p className="text-gray-600">Loading your groups…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My groups</h1>
          <Link href="/groups/new">
            <Button>Create group</Button>
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
            <Link href="/dashboard" className="inline-block mt-2">
              <Button variant="outline" size="sm">
                Back to dashboard
              </Button>
            </Link>
          </div>
        )}

        {!error && groups.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-600 mb-4">You’re not in any groups yet.</p>
            <Link href="/groups/new">
              <Button>Create your first group</Button>
            </Link>
          </div>
        )}

        {!error && groups.length > 0 && (
          <ul className="space-y-3">
            {groups.map((g) => (
              <li key={g._id}>
                <Link href={`/groups/${g._id}`}>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:border-amber-300 hover:shadow-md transition-all">
                    <h2 className="font-semibold text-gray-900">
                      {g.groupName ?? "Unnamed group"}
                    </h2>
                    {g.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                        {g.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      {g.membersList?.length ?? 0} member
                      {(g.membersList?.length ?? 0) !== 1 ? "s" : ""}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6">
          <Link href="/dashboard">
            <Button variant="outline">Back to dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
