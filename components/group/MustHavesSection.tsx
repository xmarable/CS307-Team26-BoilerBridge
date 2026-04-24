"use client";

import { Heart } from "lucide-react";
import MustHavesPanel from "./MustHavesPanel";

export function MustHavesSection({ groupId }: { groupId: string }) {
  return (
    <section className="flex flex-col space-y-6 h-full min-w-0">
      <div className="flex items-center gap-3 px-2">
        <div className="p-3 bg-pink-50 rounded-xl text-pink-600 shadow-sm">
          <Heart size={24} />
        </div>
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">
          Must-Haves
        </h2>
      </div>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 h-187.5 overflow-y-auto custom-scrollbar">
        <MustHavesPanel groupId={groupId} />
      </div>
    </section>
  );
}
