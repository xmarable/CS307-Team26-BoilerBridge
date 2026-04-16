"use client"

import React, { useEffect, useState } from "react"

interface SettingsPageProps {
  initialData?: {
    tripReminders?: boolean,
    friendRequests?: boolean,
    groupInvites?: boolean,
    groupNotifications?: boolean,
    newPassword?: string
  }
}

const settingsConfig = [
  {
    key: "tripReminders",
    title: "Trip Reminders",
    description: "Get notified about important upcoming trip updates"
  },
  {
    key: "friendRequests",
    title: "Friend Requests",
    description: "Get notified about incoming friend requests"
  },
  {
    key: "groupInvites",
    title: "Group Invites",
    description: "Get notified when you are invited to a group"
  },
  {
    key: "groupNotifications",
    title: "Group Notifications",
    description: "Recieve notifications from group updates, messages, etc."
  }
]


export default function SettingsPage({ initialData }: SettingsPageProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [settings, setSettings] = useState({
    tripReminders: false,
    friendRequests: false,
    groupInvites: false,
    groupNotifications: false
  })

  useEffect(() => {
    setSettings({
      tripReminders: initialData?.tripReminders ?? false,
      friendRequests: initialData?.friendRequests ?? false,
      groupInvites: initialData?.groupInvites ?? false,
      groupNotifications: initialData?.groupNotifications ?? false
    })
  }, [initialData]);

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    setSuccess(false);
    setLoading(true);

    const res = await fetch("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify(settings)
    });

    if (!res.ok) {
      alert("Failed to update settings")
      return;
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => setSuccess(false), 3000);
  }

  const handleToggle = async (key: string) => {
    setSettings((p) => ({
      ...p,
      [key]: !p[key as keyof typeof p]
    }));
  }

  return (
    <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <div className="mb-8 flex justify-between items-start">
        <div className="text-left">
          <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
          <p className="text-gray-500 text-sm">
            Update your notification and account settings.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-6">
          {settingsConfig.map((setting) => (
            <div key={setting.key} className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50/50 p-5">
              <div>
                <h3 className="text-sm font-bold text-gray-800">
                  {setting.title}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {setting.description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleToggle(setting.key)}
                className={`relative h-7 w-12 rounded-full transition-all ${settings[setting.key as keyof typeof settings] ? "bg-amber-500" : "bg-gray-200"
                  }`}
              >
                <span
                  className={`absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${settings[setting.key as keyof typeof settings] ? "translate-x-6" : "translate-x-1"
                    }`}
                />
              </button>
            </div>
          ))}
        </div>

        <div>
          <div className="pt-4 space-y-3">
            <button
              type="submit"
              /*disabled={loading}*/
              className="w-full bg-red-500 text-white font-bold py-3.5 rounded-xl hover:bg-amber-600 shadow-md disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              Delete Account
            </button>
          </div>

          <div className="pt-4 space-y-3">
            <button
              type="submit"
              disabled={loading}
              onClick={() => handleSubmit}
              className="w-full bg-amber-500 text-white font-bold py-3.5 rounded-xl hover:bg-amber-600 shadow-md disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {loading ? "Saving Changes..." : "Save Settings"}
            </button>
            {success && (
              <p className="text-center text-sm font-medium text-green-600 animate-pulse">
                Settings updated successfully!
              </p>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}