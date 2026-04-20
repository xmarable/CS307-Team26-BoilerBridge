"use client";

import { useState } from "react";
import { Settings, X } from "lucide-react";
import ProfilePage from "@/components/ProfilePage";
import SettingsPage from "@/components/SettingsPage";

type Props = {
  profileData: React.ComponentProps<typeof ProfilePage>["initialData"];
  settingsData: React.ComponentProps<typeof SettingsPage>["initialData"];
};

export default function ProfileSettingsLayout({ profileData, settingsData }: Props) {
  const [open, setOpen] = useState(false);

  const settingsToggle = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="mt-0.5 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-amber-200 dark:border-amber-800 transition-colors"
    >
      <Settings size={13} />
      {open ? "Close" : "Settings"}
    </button>
  );

  return (
    <div className="flex items-stretch w-full max-w-5xl">
      {/* Profile card — right border merges with settings panel when open */}
      <div
        className={`w-full max-w-2xl shrink-0 bg-white dark:bg-[#161b22] shadow-sm border border-gray-200 dark:border-[#21262d] p-8 transition-[border-radius] duration-300 ${
          open ? "rounded-l-2xl rounded-r-none border-r-0" : "rounded-2xl"
        }`}
      >
        <ProfilePage initialData={profileData} embedded headerAction={settingsToggle} />
      </div>

      {/* Settings panel — slides in flush with the profile card */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out shrink-0 ${
          open ? "w-90 opacity-100" : "w-0 opacity-0"
        }`}
      >
        <div className="w-90 h-full bg-white dark:bg-[#161b22] border border-l-0 border-gray-200 dark:border-[#21262d] rounded-r-2xl shadow-sm flex flex-col">
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-[#21262d]">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Account Settings
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#21262d] transition-colors"
            >
              <X size={15} />
            </button>
          </div>
          <div className="px-6 py-5 overflow-y-auto flex-1">
            <SettingsPage initialData={settingsData} embedded />
          </div>
        </div>
      </div>
    </div>
  );
}
