"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  groupName: z.string().min(1, "Group name is required").trim(),
  description: z.string().trim().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function CreateGroupPage() {
  const router = useRouter();
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getValidatedFormData = (): FormData | null => {
    const parsed = formSchema.safeParse({
      groupName: groupName.trim(),
      description: description.trim() || undefined,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Group name is required");
      return null;
    }

    return parsed.data;
  };

  const createGroup = async (formData: FormData) => {
    const res = await fetch("/api/groups/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupName: formData.groupName,
        ...(formData.description && {
          description: formData.description,
        }),
      }),
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));
    return { res, data };
  };

  const handleCreateGroupResponse = (res: Response, data: any) => {
    if (res.status === 401) {
      setError("You must be logged in to create a group.");
      router.push("/login");
      return;
    }

    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    const groupId = data.group?._id;
    if (groupId) {
      router.push(`/groups/${groupId}`);
    } else {
      router.push("/dashboard");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const formData = getValidatedFormData();
    if (!formData) return;

    setIsSubmitting(true);
    try {
      const { res, data } = await createGroup(formData);
      handleCreateGroupResponse(res, data);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 flex justify-center items-center min-h-[calc(100vh-8rem)]">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Create a travel group
          </h1>
          <p className="text-gray-600 mt-1">
            Give your group a name. You’ll be the leader and first member.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-gray-900">
          <div>
            <Label htmlFor="groupName" className="text-gray-900 font-medium">
              Group name *
            </Label>
            <Input
              id="groupName"
              type="text"
              placeholder="e.g. Spring Break 2026"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="mt-1.5 placeholder:text-gray-500 text-gray-900"
              aria-invalid={!!error}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-gray-900 font-medium">
              Description (optional)
            </Label>
            <Input
              id="description"
              type="text"
              placeholder="e.g. Trip to Miami"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5 placeholder:text-gray-500 text-gray-900"
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium rounded-xl shadow-md transition-all"
            >
              {isSubmitting ? "Creating…" : "Create group"}
            </Button>
            <Link href="/dashboard">
              <Button
                type="button"
                variant="outline"
                className="bg-white border-amber-500 text-amber-700 hover:bg-amber-50 hover:text-amber-800 rounded-xl"
              >
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
