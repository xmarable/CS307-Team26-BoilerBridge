"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GroupPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string | undefined;
  const [group, setGroup] = useState<{
    groupName?: string;
    groupID?: string;
  } | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/groups/${id}`, { credentials: "include" })
      .then((res) => {
        if (res.status === 403 || res.status === 404) {
          setError("You don’t have access to this group.");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.group) setGroup(data.group);
        else if (!error) setError("Failed to load group.");
      })
      .catch(() => setError("Failed to load group."))
      .finally(() => setLoading(false));
  }, [id]);

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

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-900">{group.groupName}</h1>
          <p className="text-gray-600 mt-1">
            Your group was created. You’re the leader and a member.
          </p>
          <div className="mt-6 flex gap-3">
            <Link href="/dashboard">
              <Button variant="outline">Back to dashboard</Button>
            </Link>
            <Link href="/groups/new">
              <Button>Create another group</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
