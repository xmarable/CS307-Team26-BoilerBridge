"use client";

import { useState } from "react";
import { z } from "zod";
import { CalendarPlus, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const exportRangeSchema = z
  .object({
    from: z.string().min(1, "From is required"),
    to: z.string().min(1, "To is required"),
  })
  .refine(
    (d) => {
      const a = new Date(d.from);
      const b = new Date(d.to);
      return (
        !Number.isNaN(a.getTime()) &&
        !Number.isNaN(b.getTime()) &&
        b.getTime() > a.getTime()
      );
    },
    { message: "End must be after start", path: ["to"] },
  );

function buildExportQueryString(from: string, to: string): string {
  const qs = new URLSearchParams();
  qs.set("from", new Date(from).toISOString());
  qs.set("to", new Date(to).toISOString());
  return qs.toString();
}

type Props = {
  groupId: string;
  /** Used for UI label only; server sets Content-Disposition filename */
  groupName?: string;
  rangeFrom: string;
  rangeTo: string;
};

export function ItineraryExportMenu({
  groupId,
  groupName,
  rangeFrom,
  rangeTo,
}: Props) {
  const [busy, setBusy] = useState<"ics" | "google" | "copy" | null>(null);

  function validateRange(): boolean {
    const r = exportRangeSchema.safeParse({ from: rangeFrom, to: rangeTo });
    if (!r.success) {
      const msg =
        r.error.flatten().formErrors[0] ?? r.error.issues[0]?.message;
      toast.error(msg ?? "Invalid date range");
      return false;
    }
    return true;
  }

  async function downloadIcs() {
    if (!validateRange()) return;
    setBusy("ics");
    try {
      const qs = buildExportQueryString(rangeFrom, rangeTo);
      const res = await fetch(
        `/api/groups/${groupId}/itinerary/export/ics?${qs}`,
        { credentials: "include" },
      );
      if (res.status === 401) {
        toast.error("Please sign in to export");
        return;
      }
      if (res.status === 403) {
        toast.error("You do not have access to this group");
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(typeof j.error === "string" ? j.error : "Export failed");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      let fname = `boilerbridge-${(groupName ?? "trip").replace(/[^\w\s-]/g, "").replace(/\s+/g, "-") || "trip"}.ics`;
      const m = /filename="([^"]+)"/.exec(cd ?? "");
      if (m) fname = m[1];
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fname;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Calendar file downloaded");
    } catch {
      toast.error("Download failed");
    } finally {
      setBusy(null);
    }
  }

  async function openGoogleCalendar() {
    if (!validateRange()) return;
    setBusy("google");
    try {
      const qs = buildExportQueryString(rangeFrom, rangeTo);
      const res = await fetch(
        `/api/groups/${groupId}/itinerary/export/google?${qs}&eventIndex=0`,
        { credentials: "include" },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          typeof j.error === "string"
            ? j.error
            : "Could not build Google Calendar link",
        );
        return;
      }
      if (typeof j.url === "string" && j.url.startsWith("http")) {
        window.open(j.url, "_blank", "noopener,noreferrer");
        toast.success("Opened Google Calendar (first event in range)");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setBusy(null);
    }
  }

  async function copySubscriptionLink() {
    setBusy("copy");
    try {
      const res = await fetch(
        `/api/groups/${groupId}/itinerary/export/token`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          typeof j.error === "string" ? j.error : "Could not create link",
        );
        return;
      }
      if (typeof j.subscriptionUrl === "string") {
        await navigator.clipboard.writeText(j.subscriptionUrl);
        toast.success("Subscription link copied — paste into Apple/Google calendar");
      }
    } catch {
      toast.error("Copy failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl border-gray-200 font-bold gap-1"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CalendarPlus className="h-4 w-4" />
          )}
          Export
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-xl">
        <DropdownMenuItem
          className="font-semibold cursor-pointer"
          onClick={() => void downloadIcs()}
          disabled={busy !== null}
        >
          Download .ics
        </DropdownMenuItem>
        <DropdownMenuItem
          className="font-semibold cursor-pointer"
          onClick={() => void openGoogleCalendar()}
          disabled={busy !== null}
        >
          Add to Google Calendar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="font-semibold cursor-pointer"
          onClick={() => void copySubscriptionLink()}
          disabled={busy !== null}
        >
          Copy subscription link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
