"use client";

import React, { useState } from "react"; // added useState
import { z } from "zod"; // added z for schema
import { toast } from "sonner"; // or wherever your toast is imported from
import {
  CalendarPlus,
  ChevronDown,
  FileText,
  ExternalLink,
  Link2,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

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
      const msg = r.error.flatten().formErrors[0] ?? r.error.issues[0]?.message;
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

  function subscriptionUrlWithRange(baseUrl: string): string {
    const r = exportRangeSchema.safeParse({ from: rangeFrom, to: rangeTo });
    if (!r.success) return baseUrl;
    const sep = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${sep}${buildExportQueryString(rangeFrom, rangeTo)}`;
  }

  async function copySubscriptionLink() {
    setBusy("copy");
    try {
      const res = await fetch(`/api/groups/${groupId}/itinerary/export/token`, {
        method: "POST",
        credentials: "include",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          typeof j.error === "string" ? j.error : "Could not create link",
        );
        return;
      }
      if (typeof j.subscriptionUrl === "string") {
        const url = subscriptionUrlWithRange(j.subscriptionUrl);
        await navigator.clipboard.writeText(url);
        toast.success(
          "Subscription link copied. Google/Apple will refetch this URL periodically.",
          {
            description:
              typeof window !== "undefined" &&
              window.location.hostname === "localhost"
                ? "Note: Google Calendar cannot fetch http://localhost — use Download .ics for local dev, or deploy and use an HTTPS URL for subscriptions."
                : "If the calendar looks empty, widen the trip date range above before copying so from/to match your events.",
          },
        );
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
          className="rounded-2xl border-bb-border-input bg-bb-surface hover:bg-bb-surface-subtle h-12 px-5 flex items-center gap-2 font-bold text-bb-text-sub transition-all"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CalendarPlus size={18} className="text-bb-brand" />
          )}
          Export
          <ChevronDown size={14} className="text-bb-text-muted" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-64 p-0 overflow-hidden rounded-2xl border border-bb-border bg-white shadow-xl shadow-amber-100/20"
      >
        <div className="px-6 pt-5 pb-4 bg-amber-50 border-b border-bb-border/50">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
            <CalendarPlus size={20} className="text-bb-brand" />
          </div>
          <h2 className="text-sm font-black text-bb-text tracking-tight">
            Export Trip
          </h2>
          <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mt-0.5">
            Choose Format
          </p>
        </div>

        <div className="p-2">
          <DropdownMenuItem
            disabled={busy !== null}
            onClick={() => void downloadIcs()}
            className="flex items-center gap-3 rounded-xl px-3 py-3 font-bold text-bb-text-sub cursor-pointer hover:bg-bb-surface-subtle focus:bg-bb-surface-subtle transition-colors"
          >
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <FileText size={16} />
            </div>
            Download .ics
          </DropdownMenuItem>

          <DropdownMenuItem
            disabled={busy !== null}
            onClick={() => void openGoogleCalendar()}
            className="flex items-center gap-3 rounded-xl px-3 py-3 font-bold text-bb-text-sub cursor-pointer hover:bg-bb-surface-subtle focus:bg-bb-surface-subtle transition-colors mt-1"
          >
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <ExternalLink size={16} />
            </div>
            Add to Google Calendar
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-bb-border my-1 mx-2" />

          <DropdownMenuItem
            disabled={busy !== null}
            onClick={() => void copySubscriptionLink()}
            className="flex items-center gap-3 rounded-xl px-3 py-3 font-bold text-bb-text-sub cursor-pointer hover:bg-bb-surface-subtle focus:bg-bb-surface-subtle transition-colors"
          >
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
              <Link2 size={16} />
            </div>
            Copy subscription link
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
