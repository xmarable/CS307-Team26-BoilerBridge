"use client"

import { useState } from "react"

interface SettingsPageProps {
    initialData?: {
        tripReminders?: boolean,
        friendRequests?: boolean,
        groupInvites?: boolean,
        groupNotifications?: boolean,
        newPassword?: string
    }
}

export default function SettingsPage({ initialData }: SettingsPageProps) {
    const [tripReminders, setTripReminders] = useState(
        initialData?.tripReminders
    );
    const [friendRequests, setFriendRequests] = useState(
        initialData?.friendRequests
    );
    const [groupInvites, setGroupInvites] = useState(
        initialData?.groupInvites
    );
    const [groupNotification, setGroupNotifications] = useState(
        initialData?.groupNotifications
    )
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async () => {

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
          
        </div>

        <div className="pt-4 space-y-3">
          <button
            type="submit"
            disabled={loading}
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
      </form>
    </div>
  );
}