"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

interface ProfilePageProps {
  initialData?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    username?: string | null;
    school?: string | null;
    location?: string | null;
  };
}

export default function ProfilePage({ initialData }: ProfilePageProps) {
  const { update, data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // username auto-fills, name stays empty if not provided in initialData
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    username: initialData?.username || "",
    school: initialData?.school || "",
    location: initialData?.location || "",
    profileImage: initialData?.image || "",
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        username: initialData.username || "",
        school: initialData.school || "",
        location: initialData.location || "",
        profileImage: initialData.image || "",
      });
    }
  }, [initialData]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File is too large. Max 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          profileImage: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if anything actually changed before hitting the API
    const hasChanged =
      formData.name !== (initialData?.name || "") ||
      formData.username !== (initialData?.username || "") ||
      formData.school !== (initialData?.school || "") ||
      formData.location !== (initialData?.location || "") ||
      formData.profileImage !== (initialData?.image || "");

    if (!hasChanged) {
      alert("No changes detected.");
      return;
    }

    setLoading(true);
    setSuccess(false);

    try {
      const res = await fetch("/api/users/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        await update({
          ...session,
          user: {
            ...session?.user,
            name: formData.name,
            username: formData.username,
            image: data.image || formData.profileImage,
          },
        });
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        alert(data.error || "Update failed");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("An error occurred while saving.");
    } finally {
      setLoading(false);
    }
  };

  // High contrast: User text is bold black, placeholders are faint gray
  const inputStyles =
    "rounded-xl border-gray-300 text-black font-medium placeholder:text-gray-300 placeholder:font-normal focus:ring-amber-500 focus:border-amber-500 bg-white opacity-100";

  return (
    <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <div className="mb-8 text-center sm:text-left">
        <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-gray-500 text-sm">
          Update your public profile, display name, and location details.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col items-center sm:items-start gap-4 mb-8">
          <label className="text-sm font-semibold text-gray-700">
            Profile Picture
          </label>
          <div className="relative group">
            <Avatar
              className="w-28 h-28 border-4 border-white shadow-md cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => fileInputRef.current?.click()}
            >
              <AvatarImage
                src={formData.profileImage}
                className="object-cover"
              />
              <AvatarFallback className="bg-linear-to-br from-amber-500 to-orange-600 text-white text-3xl font-bold">
                {(formData.name || formData.username || "U")
                  .charAt(0)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute bottom-1 right-1 bg-white p-1.5 rounded-full shadow-sm border border-gray-100 cursor-pointer">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-600"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageChange}
            accept="image/*"
            className="hidden"
          />
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">
              Display Name
            </label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className={inputStyles}
              placeholder="e.g. Xavion Marable"
            />
            <p className="text-[10px] text-gray-400 px-1 italic">
              Public name, can be changed anytime.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">
              Username (@)
            </label>
            <Input
              type="text"
              value={formData.username}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  username: e.target.value.toLowerCase().replace(/\s/g, ""),
                })
              }
              className={inputStyles}
              placeholder="username"
            />
            <p className="text-[10px] text-gray-400 px-1 italic">
              Can be changed once every 14 days.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">
              School
            </label>
            <Input
              type="text"
              value={formData.school}
              onChange={(e) =>
                setFormData({ ...formData, school: e.target.value })
              }
              className={inputStyles}
              placeholder="e.g. Purdue University"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">
              Location
            </label>
            <Input
              type="text"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              className={inputStyles}
              placeholder="e.g. West Lafayette, IN"
            />
          </div>
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
              Profile updated successfully!
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
