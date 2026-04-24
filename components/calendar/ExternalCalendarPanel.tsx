"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarDays,
  Link2,
  Link2Off,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

type Connection = {
  _id: string;
  provider: "google" | "outlook";
  providerAccountId: string;
  calendarId?: string;
  calendarName?: string;
  syncEnabled: boolean;
  lastSyncedAt?: string;
  syncError?: string;
};

type ExternalCalendar = {
  id: string;
  name: string;
  primary?: boolean;
};

type Props = {
  groupId: string;
};

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google Calendar",
  outlook: "Outlook Calendar",
};

const PROVIDER_COLORS: Record<string, string> = {
  google: "bg-blue-50 border-blue-200",
  outlook: "bg-sky-50 border-sky-200",
};

export default function ExternalCalendarPanel({ groupId }: Props) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<Record<string, ExternalCalendar[]>>({});
  const [loadingCalendars, setLoadingCalendars] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);
      const res = await fetch("/api/calendar-connections");
      if (!res.ok) throw new Error("Failed to load calendar connections");
      const data = await res.json();
      setConnections(data.connections ?? []);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  // Check for OAuth redirect result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("calendarConnected");
    const calError = params.get("calendarError");
    if (connected || calError) {
      // Remove the query params without reload
      const url = new URL(window.location.href);
      url.searchParams.delete("calendarConnected");
      url.searchParams.delete("calendarError");
      window.history.replaceState({}, "", url.toString());
      if (connected) fetchConnections();
      if (calError) setErr(`OAuth error: ${calError}`);
    }
  }, [fetchConnections]);

  async function fetchAvailableCalendars(connectionId: string) {
    setLoadingCalendars(connectionId);
    try {
      const res = await fetch(
        `/api/calendar-connections/${connectionId}/calendars`,
      );
      if (!res.ok) throw new Error("Failed to fetch calendars");
      const data = await res.json();
      setCalendars((prev) => ({ ...prev, [connectionId]: data.calendars }));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoadingCalendars(null);
    }
  }

  async function handleUpdate(
    connectionId: string,
    patch: Partial<Pick<Connection, "syncEnabled" | "calendarId" | "calendarName">>,
  ) {
    setUpdating(connectionId);
    try {
      const res = await fetch(`/api/calendar-connections/${connectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed to update settings");
      const data = await res.json();
      setConnections((prev) =>
        prev.map((c) => (c._id === connectionId ? { ...c, ...data.connection } : c)),
      );
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setUpdating(null);
    }
  }

  async function handleSync(connectionId: string) {
    setSyncing(connectionId);
    setErr(null);
    try {
      const res = await fetch(
        `/api/calendar-connections/${connectionId}/sync`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupId }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      await fetchConnections();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSyncing(null);
    }
  }

  async function handleUnlink(connectionId: string) {
    if (!confirm("Unlink this calendar? Sync will stop and connection data will be removed.")) return;
    try {
      const res = await fetch(`/api/calendar-connections/${connectionId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to unlink calendar");
      setConnections((prev) => prev.filter((c) => c._id !== connectionId));
    } catch (e: any) {
      setErr(e.message);
    }
  }

  function handleConnect(provider: "google" | "outlook") {
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `/api/calendar-connections/oauth/${provider}?returnUrl=${returnUrl}`;
  }

  const linkedProviders = new Set(connections.map((c) => c.provider));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading calendar connections…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-indigo-500" />
          <h3 className="text-lg font-semibold text-gray-800">
            External Calendars
          </h3>
        </div>
        <div className="flex gap-2">
          {!linkedProviders.has("google") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleConnect("google")}
              className="gap-1"
            >
              <Link2 className="w-4 h-4" />
              Connect Google
            </Button>
          )}
          {!linkedProviders.has("outlook") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleConnect("outlook")}
              className="gap-1"
            >
              <Link2 className="w-4 h-4" />
              Connect Outlook
            </Button>
          )}
        </div>
      </div>

      {err && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {err}
          <button
            onClick={() => setErr(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            ×
          </button>
        </div>
      )}

      {connections.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
          No external calendars linked yet. Connect Google or Outlook to sync
          trip events.
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map((conn) => (
            <div
              key={conn._id}
              className={`rounded-lg border p-4 space-y-3 ${PROVIDER_COLORS[conn.provider] ?? "bg-gray-50 border-gray-200"}`}
            >
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800 text-sm">
                    {PROVIDER_LABELS[conn.provider] ?? conn.provider}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {conn.providerAccountId}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleUnlink(conn._id)}
                  className="text-red-500 hover:text-red-700 gap-1 h-7"
                >
                  <Link2Off className="w-3.5 h-3.5" />
                  Unlink
                </Button>
              </div>

              {/* Sync error banner */}
              {conn.syncError && (
                <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-600">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {conn.syncError}
                </div>
              )}

              {/* Calendar selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-20 shrink-0">Calendar</span>
                {calendars[conn._id] ? (
                  <Select
                    value={conn.calendarId ?? ""}
                    onValueChange={(val) => {
                      const cal = calendars[conn._id].find((c) => c.id === val);
                      handleUpdate(conn._id, {
                        calendarId: val,
                        calendarName: cal?.name,
                      });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="Choose a calendar" />
                    </SelectTrigger>
                    <SelectContent>
                      {calendars[conn._id].map((cal) => (
                        <SelectItem key={cal.id} value={cal.id} className="text-xs">
                          {cal.name}
                          {cal.primary && (
                            <span className="ml-1 text-gray-400">(primary)</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={loadingCalendars === conn._id}
                    onClick={() => fetchAvailableCalendars(conn._id)}
                  >
                    {loadingCalendars === conn._id ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : null}
                    {conn.calendarName ?? "Select calendar…"}
                  </Button>
                )}
              </div>

              {/* Sync toggle + actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      handleUpdate(conn._id, { syncEnabled: !conn.syncEnabled })
                    }
                    disabled={updating === conn._id}
                    className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
                  >
                    {conn.syncEnabled ? (
                      <ToggleRight className="w-5 h-5 text-indigo-500" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-gray-400" />
                    )}
                    {conn.syncEnabled ? "Sync on" : "Sync off"}
                  </button>

                  {conn.lastSyncedAt && (
                    <span className="text-xs text-gray-400">
                      · Last synced{" "}
                      {new Date(conn.lastSyncedAt).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!conn.syncError && conn.lastSyncedAt && (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    disabled={
                      !conn.syncEnabled ||
                      !conn.calendarId ||
                      syncing === conn._id
                    }
                    onClick={() => handleSync(conn._id)}
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${syncing === conn._id ? "animate-spin" : ""}`}
                    />
                    {syncing === conn._id ? "Syncing…" : "Sync now"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
