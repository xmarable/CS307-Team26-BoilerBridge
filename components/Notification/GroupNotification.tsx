"use client"

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import z from "zod";
import { Button } from "../ui/button";
import Link from "next/link";

const NotificationSchema = z.object({
  topic: z.string().min(1, "A topic is required"),
  content: z.string().min(1, "Message content is required")
})

type FormData = z.infer<typeof NotificationSchema>;

type GroupSummary = {
  groupID: string;
  groupName: string;
}

export default function GroupNotification({ activeGroup }: { activeGroup: GroupSummary | null }) {
  const [topic, setTopic] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateFormData = (): FormData | null => {
    const parsed = NotificationSchema.safeParse({
      content: content,
      topic: topic
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return null;
    }

    return parsed.data;
  }

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const data = validateFormData();

    if (!data) {
      return;
    }

    const res = await fetch(`/api/groups/${activeGroup?.groupID}/notify`, {
      method: "POST",
      body: JSON.stringify({ topic: topic, content: content })
    });

    const body = res.json();
    if (!res.ok) {
      setError("Invalid Message");
      setIsSubmitting(false);
      return;
    }

    setError("Message Sent");
    setIsSubmitting(false);
  };

  return (
    <div className="p-6 lg:p-8 flex justify-center items-start pt-12">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Notify Your Group
          </h1>
          <p className="text-gray-600 mt-1">
            Enter a subject and message content to notify your group.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-gray-900">
          <div>
            <Label htmlFor="topic" className="text-gray-900 font-medium">
              Message Topic
            </Label>
            <Input
              id="topic"
              type="text"
              placeholder="e.g. Spring Break 2026"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="mt-1.5 placeholder:text-gray-500 text-gray-900"
              aria-invalid={!!error}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <Label htmlFor="content" className="text-gray-900 font-medium">
              Message Content
            </Label>
            <textarea
              id="content"
              placeholder="e.g. Trip to Miami"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-gray-300 p-3 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              rows={5}
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
              {isSubmitting ? "Notifying…" : "Notify Group"}
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