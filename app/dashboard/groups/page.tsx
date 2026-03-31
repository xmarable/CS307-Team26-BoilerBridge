export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/dbConnect";
import TravelGroup from "@/models/TravelGroup";
import User from "@/models/User";
import Link from "next/link";
import { Plus, Users, Calendar, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">
            My Groups
          </h1>
          <p className="text-gray-500 mt-1 font-medium">
            Select a group to manage your trip and view the board.
          </p>
        </div>

        <Link href="/dashboard/groups/new">
          <button className="flex items-center gap-2 bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold py-3 px-6 rounded-2xl shadow-lg shadow-amber-200 transition-all active:scale-95">
            <Plus size={20} />
            Create New Group
          </button>
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-24 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400">
            <Users size={32} />
          </div>
          <p className="text-gray-400 font-bold text-lg mb-6">
            You aren't in any travel groups yet.
          </p>
          <Link href="/dashboard/groups/new">
            <Button className="bg-white border-amber-500 text-amber-700 hover:bg-amber-50 rounded-xl font-bold">
              Start your first trip
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {groups.map((group: any) => (
            <Link
              key={group.groupID}
              href={`/dashboard/groups/${group.groupID}`}
              className="block h-full"
            >
              <div className="group bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-amber-200 transition-all duration-300 flex flex-col h-full cursor-pointer relative overflow-hidden">
                {/* Visual Accent */}
                <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-amber-400 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="flex justify-between items-start mb-6">
                  <div className="p-3 bg-amber-50 rounded-2xl text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300 shadow-sm">
                    <Users size={24} />
                  </div>
                  <div className="p-2 rounded-xl bg-gray-50 text-gray-300 group-hover:text-amber-500 group-hover:bg-amber-50 transition-all">
                    <ArrowRight size={20} />
                  </div>
                </div>

                <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight group-hover:text-amber-600 transition-colors">
                  {group.groupName || "Unnamed Trip"}
                </h2>
                
                <p className="text-gray-500 text-sm font-medium line-clamp-2 mb-8 grow leading-relaxed">
                  {group.description || "No description provided for this adventure."}
                </p>

                <div className="flex items-center gap-4 pt-6 border-t border-gray-50 mt-auto">
                  <div className="flex items-center gap-1.5 text-xs font-black text-gray-400 uppercase tracking-widest">
                    <Users size={14} className="text-amber-500/50" />
                    <span>
                      {group.membersList?.length || 0} Member{group.membersList?.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-black text-gray-400 uppercase tracking-widest">
                    <Calendar size={14} className="text-amber-500/50" />
                    <span>Active</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="pt-10">
        <Link href="/dashboard">
          <Button
            variant="ghost"
            className="text-gray-500 font-bold hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
          >
            <ChevronLeft size={18} className="mr-1" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}

// Simple internal icon component to match lucide style
function ChevronLeft({ size, className }: { size: number; className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="m15 18-6-6 6-6"/>
    </svg>
  );
}