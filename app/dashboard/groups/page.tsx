export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/dbConnect";
import TravelGroup from "@/models/TravelGroup";
import User from "@/models/User";
import Link from "next/link";
import { Plus, Users, Calendar, ArrowRight } from "lucide-react";

export default async function MyGroupsPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) {
    redirect("/signin");
    return null;
  }

  await dbConnect();

  // Find the user to get their UUID (userId)
  const user = await User.findOne({ email: session.user.email })
    .select("userId")
    .lean();
  if (!user) {
    redirect("/signin");
    return null;
  }

  // Fetch groups where the user's UUID is in the membersList object array
  const groupsRaw = await TravelGroup.find({
    "membersList.userId": user.userId,
  })
    .sort({ createdAt: -1 })
    .lean();

  // Clean the data for the server-to-client boundary
  const groups = JSON.parse(JSON.stringify(groupsRaw));

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

        <Link href="/dashboard/groups/new">
          <button className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-6 rounded-2xl shadow-lg shadow-amber-200 transition-all active:scale-95">
            <Plus size={20} />
            Create New Group
          </button>
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
          <p className="text-gray-400 font-bold text-lg italic">
            You aren't in any travel groups yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group: any) => (
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
                  {group.description}
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
