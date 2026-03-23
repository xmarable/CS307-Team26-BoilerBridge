"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { CheckCircle2, GraduationCap } from "lucide-react";

interface ProfilePageProps {
  initialData?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    username?: string | null;
    school?: string | null;
    location?: string | null;
    isStudentVerified?: boolean;
    eduEmail?: string | null;
  };
}

export default function ProfilePage({ initialData }: ProfilePageProps) {
  const { update, data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const [isVerified, setIsVerified] = useState(
    initialData?.isStudentVerified || false,
  );
  const [step, setStep] = useState<"idle" | "email" | "code">("idle");
  const [eduEmail, setEduEmail] = useState(initialData?.eduEmail || "");
  const [vCode, setVCode] = useState("");
  const [vLoading, setVLoading] = useState(false);

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
      setIsVerified(initialData.isStudentVerified || false);
    }
  }, [initialData]);

  const handleRequestCode = async () => {
    if (!eduEmail.endsWith(".edu")) return alert("Please use a .edu email");
    setVLoading(true);
    try {
      const res = await fetch("/api/auth/verify-student", {
        method: "POST",
        body: JSON.stringify({ action: "request", email: eduEmail }),
      });
      if (res.ok) setStep("code");
      else alert("Failed to send code");
    } catch (error) {
      alert("Error sending code");
    } finally {
      setVLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setVLoading(true);
    try {
      const res = await fetch("/api/auth/verify-student", {
        method: "POST",
        body: JSON.stringify({ action: "confirm", code: vCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsVerified(true);
        setEduEmail(data.eduEmail);
        setStep("idle");

        await update({
          ...session,
          user: {
            ...session?.user,
            isStudentVerified: true,
            eduEmail: data.eduEmail,
          },
        });

        router.refresh(); // force next.js to refresh server components (navbar)
      } else {
        alert(data.error || "Invalid code");
      }
    } catch (error) {
      alert("Error verifying code");
    } finally {
      setVLoading(false);
    }
  };

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
        router.refresh(); // force next.js to refresh server components (navbar)

        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (error) {
      alert("An error occurred while saving.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyles =
    "rounded-xl border-gray-300 text-black font-medium placeholder:text-gray-300 placeholder:font-normal focus:ring-amber-500 focus:border-amber-500 bg-white opacity-100";

  return (
    <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <div className="mb-8 flex justify-between items-start">
        <div className="text-left">
          <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
          <p className="text-gray-500 text-sm">
            Update your public profile and verification status.
          </p>
        </div>
        {isVerified && (
          <div className="mt-3 inline-flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-full border border-green-200">
            <CheckCircle2 size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">
              Verified Student
            </span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col items-center gap-4 mb-8">
          <label className="align-center font-semibold text-gray-700">
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
              placeholder="e.g. John Doe"
            />
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
          </div>

          <div className="p-5 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 space-y-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="text-amber-600" size={20} />
              <h3 className="font-bold text-gray-800">Student Verification</h3>
            </div>

            {!isVerified ? (
              <div className="space-y-3">
                {step === "idle" && (
                  <button
                    type="button"
                    onClick={() => setStep("email")}
                    className="text-sm text-amber-600 font-semibold hover:underline"
                  >
                    + Verify your student status with a .edu email
                  </button>
                )}
                {step === "email" && (
                  <div className="flex gap-2">
                    <Input
                      value={eduEmail}
                      onChange={(e) => setEduEmail(e.target.value)}
                      placeholder="student@university.edu"
                      className={inputStyles}
                    />
                    <button
                      type="button"
                      onClick={handleRequestCode}
                      disabled={vLoading}
                      className="bg-black text-white px-4 rounded-xl text-sm font-bold"
                    >
                      {vLoading ? "..." : "Send"}
                    </button>
                  </div>
                )}
                {step === "code" && (
                  <div className="flex gap-2">
                    <Input
                      value={vCode}
                      onChange={(e) => setVCode(e.target.value)}
                      placeholder="6-digit code"
                      className={inputStyles}
                    />
                    <button
                      type="button"
                      onClick={handleVerifyCode}
                      disabled={vLoading}
                      className="bg-green-600 text-white px-4 rounded-xl text-sm font-bold"
                    >
                      {vLoading ? "..." : "Verify"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                Verified via <b>{eduEmail}</b>
              </p>
            )}
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
