"use client"

import React, { useEffect, useState } from "react"

interface NotificationSettings {
  inApp: boolean,
  email: boolean
}

interface SettingsPageProps {
  tripReminders: NotificationSettings,
  friendRequests: NotificationSettings,
  groupInvites: NotificationSettings,
  groupNotifications: NotificationSettings,
  newPassword?: NotificationSettings
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
  },
] as const;

type SettingKey = typeof settingsConfig[number]["key"];
type SettingType = "inApp" | "email";

export default function SettingsPage({ initialData }: { initialData: SettingsPageProps }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [settings, setSettings] = useState({
    tripReminders: { inApp: false, email: false },
    friendRequests: { inApp: false, email: false },
    groupInvites: { inApp: false, email: false },
    groupNotifications: { inApp: false, email: false }
  })

  useEffect(() => {
    setSettings({
      tripReminders: initialData?.tripReminders ?? { inApp: false, email: false },
      friendRequests: initialData?.friendRequests ?? { inApp: false, email: false },
      groupInvites: initialData?.groupInvites ?? { inApp: false, email: false },
      groupNotifications: initialData?.groupNotifications ?? { inApp: false, email: false }
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

  const handleToggle = async (key: SettingKey, type: SettingType) => {
    setSettings((p) => ({
      ...p,
      [key]: {
        ...p[key],
        [type]: !p[key][type]
      }
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
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-800">
                  {setting.title}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {setting.description}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-gray-700">In-App</span>
                  <button
                    type="button"
                    onClick={() => handleToggle(setting.key, "inApp")}
                    className={`relative h-7 w-12 rounded-full transition-all ${settings[setting.key].inApp ? "bg-amber-500" : "bg-gray-200"
                      }`}
                  >
                    <span
                      className={`absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${settings[setting.key].inApp ? "translate-x-6" : "translate-x-1"
                        }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-gray-700">Email</span>
                  <button
                    type="button"
                    onClick={() => handleToggle(setting.key, "email")}
                    className={`relative h-7 w-12 rounded-full transition-all ${settings[setting.key].email ? "bg-amber-500" : "bg-gray-200"
                      }`}
                  >
                    <span
                      className={`absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${settings[setting.key].email ? "translate-x-6" : "translate-x-1"
                        }`}
                    />
                  </button>
                </div>
              </div>
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