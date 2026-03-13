export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/dbConnect";
import TravelGroup from "@/models/TravelGroup";
import {
  ChevronLeft,
  Megaphone,
  Pin,
  Clock,
  User as UserIcon,
  Plus,
} from "lucide-react";
import Link from "next/link";

interface Announcement {
  content: string;
  pinnedBy: string;
  timestamp: Date;
}

export default async function AnnouncementsPage(context: {
  params: Promise<{ groupId: string }>;
}) {
  const session = await getServerSession(authOptions);
  const { groupId } = await context.params;

  if (!session || !session.user?.email) {
    redirect("/signin");
    return null;
  }

  await dbConnect();

  // Fetch the group and its announcements
  const group = await TravelGroup.findOne({ groupID: groupId }).lean();

  if (!group) {
    redirect("/dashboard/groups");
    return null;
  }

  // Cast and clean data for Client Component rendering
  const announcements = (group.pinnedAnnouncements || []) as Announcement[];
  const sortedAnnouncements = [...announcements].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  // Check if current user is the leader to show 'Add' controls
  const isLeader = (session.user as any).userId === group.leaderID;

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/dashboard/groups/${groupId}`}
          className="inline-flex items-center text-sm font-black text-gray-400 hover:text-amber-600 transition-colors mb-6 group"
        >
          <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Group
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">
              Group Board
            </h1>
            <p className="text-gray-500 mt-2">
              Important updates and pinned messages for {group.groupName}.
            </p>
          </div>

          {isLeader && (
            <Link href={`/dashboard/groups/${groupId}/announcements/new`}>
              <button className="bg-gray-900 hover:bg-amber-600 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-gray-200">
                <Plus size={20} />
                New Announcement
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* Announcements List */}
      <div className="space-y-6">
        {sortedAnnouncements.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-gray-100">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-300">
              <Megaphone size={32} />
            </div>
            <p className="text-gray-400 font-bold text-lg">
              No announcements yet.
            </p>
          </div>
        ) : (
          sortedAnnouncements.map((ann, idx) => (
            <div
              key={idx}
              className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden group hover:border-amber-200 transition-all"
            >
              {/* Pin Indicator */}
              <div className="absolute top-0 right-0 p-6">
                <Pin size={20} className="text-amber-500 rotate-45" />
              </div>

              <div className="flex flex-col h-full">
                <div className="mb-6">
                  <p className="text-xl font-bold text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {ann.content}
                  </p>
                </div>

                <div className="mt-auto pt-6 border-t border-gray-50 flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2 text-sm font-black text-gray-400">
                    <UserIcon size={16} />
                    <span className="uppercase tracking-widest">
                      Pinned by {ann.pinnedBy}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm font-bold text-gray-300">
                    <Clock size={16} />
                    <span>{new Date(ann.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
