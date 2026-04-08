"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Plus,
  Clock,
  MapPin,
  RefreshCw,
  Trash2,
  Edit3,
  Loader2,
  Zap,
  Wand2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import ItineraryRegeneratePreviewModal, {
  type PreviewOriginalRow,
  type PreviewProposedRow,
} from "@/components/group/ItineraryRegeneratePreviewModal";

type CalendarEvent = {
  _id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  eventType?: string;
  createdBy?: string;
  groupId: string;
  timezone?: string;
  source?: "manual" | "itinerary";
  updatedAt?: string;
};

type Props = {
  groupId: string;
};

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function calendarDayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CalendarEventsPanel({ groupId }: Props) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // state for error and success popups
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [popupMsg, setPopupMsg] = useState("");
  const [errorPopupTripLink, setErrorPopupTripLink] = useState(false);

  const [from, setFrom] = useState(() => toDatetimeLocalValue(new Date()));
  const [to, setTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return toDatetimeLocalValue(d);
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState(() =>
    toDatetimeLocalValue(new Date()),
  );
  const [endTime, setEndTime] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    return toDatetimeLocalValue(d);
  });
  const [location, setLocation] = useState("");
  const [eventType, setEventType] = useState("activity");
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectDayToken, setSelectDayToken] = useState("__none__");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewOriginals, setPreviewOriginals] = useState<
    PreviewOriginalRow[]
  >([]);
  const [previewProposed, setPreviewProposed] = useState<PreviewProposedRow[]>(
    [],
  );
  const [regenerating, setRegenerating] = useState(false);
  const [applying, setApplying] = useState(false);

  const rangeQuery = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("from", new Date(from).toISOString());
    qs.set("to", new Date(to).toISOString());
    return `?${qs.toString()}`;
  }, [from, to]);

  const daySelectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const ev of events) {
      const key = calendarDayKey(ev.startTime);
      const d = new Date(ev.startTime);
      const label = d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      map.set(key, label);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  async function fetchEvents() {
    try {
      setLoading(true);
      setErr(null);
      const res = await fetch(
        `/api/groups/${groupId}/calendar/events${rangeQuery}`,
        {
          method: "GET",
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load events.");
      setEvents(data.events ?? data.calendarEvents ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load events.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEvents();
  }, [groupId, rangeQuery]);

  async function handleCreate() {
    try {
      setCreating(true);
      setErr(null);
      const startISO = new Date(startTime).toISOString();
      const endISO = new Date(endTime).toISOString();

      const res = await fetch(`/api/groups/${groupId}/calendar/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          startTime: startISO,
          endTime: endISO,
          location: location.trim() || undefined,
          eventType,
          source: "manual",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create event.");

      setTitle("");
      setDescription("");
      setLocation("");
      setEventType("activity");
      await fetchEvents();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create event.");
    } finally {
      setCreating(false);
    }
  }

  async function handleGenerate() {
    try {
      setGenerating(true);
      setErr(null);
      const res = await fetch(`/api/groups/${groupId}/itinerary/generate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setPopupMsg(data?.error || "Failed to generate itinerary.");
        setErrorPopupTripLink(res.status === 404);
        setShowErrorPopup(true);
      } else {
        // show success if it worked
        setPopupMsg(data?.message || "Itinerary sparked successfully.");
        setShowSuccessPopup(true);
        await fetchEvents();
      }
    } catch (e: any) {
      setPopupMsg("An unexpected error occurred during generation.");
      setShowErrorPopup(true);
    } finally {
      setGenerating(false);
    }
  }

  function openEdit(ev: CalendarEvent) {
    setEditEvent(ev);
    setTitle(ev.title);
    setDescription(ev.description ?? "");
    setLocation(ev.location ?? "");
    setEventType(ev.eventType ?? "activity");
    setStartTime(toDatetimeLocalValue(new Date(ev.startTime)));
    setEndTime(toDatetimeLocalValue(new Date(ev.endTime)));
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editEvent) return;
    try {
      setSavingEdit(true);
      setErr(null);
      const res = await fetch(
        `/api/groups/${groupId}/calendar/events/${editEvent._id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || undefined,
            startTime: new Date(startTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
            location: location.trim() || undefined,
            eventType,
          }),
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update event.");

      setEditOpen(false);
      setEditEvent(null);
      await fetchEvents();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update event.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(eventId: string) {
    try {
      setErr(null);
      const res = await fetch(
        `/api/groups/${groupId}/calendar/events/${eventId}`,
        {
          method: "DELETE",
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete event.");
      await fetchEvents();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to delete event.");
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllForDay(dayKey: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const ev of events) {
        if (calendarDayKey(ev.startTime) === dayKey) next.add(ev._id);
      }
      return next;
    });
  }

  async function handleRegenerateSelected() {
    if (selectedIds.size === 0) return;
    try {
      setRegenerating(true);
      setErr(null);
      const res = await fetch(`/api/groups/${groupId}/itinerary/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Regeneration failed");
      setPreviewOriginals(data.originals ?? []);
      setPreviewProposed(data.proposed ?? []);
      setPreviewOpen(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Regeneration failed";
      setErr(msg);
    } finally {
      setRegenerating(false);
    }
  }

  async function handleApplyPreview() {
    try {
      setApplying(true);
      setErr(null);
      const res = await fetch(
        `/api/groups/${groupId}/itinerary/regenerate/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            replaceEventIds: previewOriginals.map((o) => o._id),
            proposedEvents: previewProposed,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to apply changes");
      setPreviewOpen(false);
      setPreviewOriginals([]);
      setPreviewProposed([]);
      setSelectedIds(new Set());
      await fetchEvents();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to apply changes";
      setErr(msg);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-8">
      {err && <p className="text-sm text-red-600 font-bold px-2">{err}</p>}
      {/* Search/Range Controls */}
      <div className="bg-gray-50 rounded-4xl p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Clock size={16} /> View Window
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchEvents}
            className="rounded-xl text-amber-600 hover:bg-amber-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-gray-700 font-bold ml-1">From</Label>
            <Input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-2xl border-gray-200 h-12 bg-white text-gray-900"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-gray-700 font-bold ml-1">To</Label>
            <Input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-2xl border-gray-200 h-12 bg-white text-gray-900"
            />
          </div>
        </div>
      </div>

      {/* Baseline Itinerary Generator Trigger */}
      <div className="bg-gray-900 rounded-[2.5rem] p-8 text-white shadow-2xl border border-gray-800">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-2xl font-black tracking-tighter flex items-center justify-center md:justify-start gap-2 uppercase">
              <Zap className="text-amber-400 fill-amber-400" size={24} /> spark
              itinerary
            </h3>
            <p className="text-gray-400 font-bold text-sm">
              Builds a full timeline with Ollama (local) from your trip and
              approved must-haves
            </p>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-amber-500 hover:bg-amber-400 text-black font-black px-10 h-14 rounded-2xl shadow-lg shadow-amber-500/20 transition-all active:scale-95 uppercase tracking-widest"
          >
            {generating ? (
              <RefreshCw className="animate-spin mr-2" size={20} />
            ) : (
              "Generate Plan"
            )}
          </Button>
        </div>
      </div>

      {/* Add Event Form */}
      <div className="bg-amber-50/50 rounded-[2.5rem] p-8 border border-amber-100/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-amber-500 rounded-2xl text-white shadow-lg shadow-amber-200">
            <Plus size={24} />
          </div>
          <h3 className="text-2xl font-black text-gray-900 tracking-tight">
            Add to Timeline
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-gray-700 font-bold ml-1">
              Event Title *
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Dinner reservation, museum, flight..."
              className="rounded-2xl border-gray-200 h-14 bg-white text-gray-900 shadow-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-700 font-bold ml-1">Start Time</Label>
            <Input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="rounded-2xl border-gray-200 h-14 bg-white text-gray-900 shadow-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-700 font-bold ml-1">End Time</Label>
            <Input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="rounded-2xl border-gray-200 h-14 bg-white text-gray-900 shadow-sm"
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-gray-700 font-bold ml-1">Location</Label>
            <div className="relative">
              <MapPin
                className="absolute left-4 top-4 text-gray-400"
                size={20}
              />
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Where is it happening?"
                className="rounded-2xl border-gray-200 h-14 bg-white text-gray-900 pl-12 shadow-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-700 font-bold ml-1">Type</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="rounded-2xl border-gray-200 h-14 bg-white text-gray-900 shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="activity">Activity</SelectItem>
                <SelectItem value="travel">Travel</SelectItem>
                <SelectItem value="food">Food</SelectItem>
                <SelectItem value="lodging">Lodging</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleCreate}
              disabled={creating || !title.trim()}
              className="w-full h-14 bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black rounded-2xl shadow-xl shadow-amber-200 transition-all active:scale-95"
            >
              {creating ? "Adding…" : "Add Event"}
            </Button>
          </div>
        </div>
      </div>

      {/* Events Feed */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 px-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-black text-gray-900">
              Upcoming Activities
            </h3>
            <Badge className="bg-amber-100 text-amber-700 border-none px-3 py-1 rounded-full font-bold">
              {events.length} Events Found
            </Badge>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
            <div className="flex-1 min-w-50 max-w-md">
              <Label className="text-xs font-bold text-gray-500 mb-1 block">
                Select by day
              </Label>
              <Select
                value={selectDayToken}
                onValueChange={(v) => {
                  setSelectDayToken(v);
                  if (v !== "__none__") selectAllForDay(v);
                }}
              >
                <SelectTrigger className="rounded-2xl border-gray-200 h-11 bg-white">
                  <SelectValue placeholder="Choose a day…" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="__none__">Clear day filter</SelectItem>
                  {daySelectOptions.map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl h-11 border-amber-200 text-amber-800 font-bold"
                onClick={() => {
                  setSelectedIds(new Set());
                  setSelectDayToken("__none__");
                }}
                disabled={selectedIds.size === 0}
              >
                Clear selection
              </Button>
              <Button
                type="button"
                onClick={() => void handleRegenerateSelected()}
                disabled={selectedIds.size === 0 || regenerating || loading}
                className="rounded-2xl h-11 bg-linear-to-r from-violet-600 to-amber-600 hover:from-violet-700 hover:to-amber-700 text-white font-black gap-2"
              >
                {regenerating ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Wand2 size={18} />
                )}
                Regenerate Selected
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-amber-500" size={32} />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-200">
            <Calendar className="mx-auto text-gray-300 mb-2" size={40} />
            <p className="text-gray-400 font-bold">
              No events scheduled for this window.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {events
              .slice()
              .sort(
                (a, b) =>
                  new Date(a.startTime).getTime() -
                  new Date(b.startTime).getTime(),
              )
              .map((ev) => (
                <div
                  key={ev._id}
                  className="group bg-white p-6 rounded-4xl border border-gray-100 shadow-sm hover:shadow-md hover:border-amber-200 transition-all flex flex-col md:flex-row md:items-center gap-4"
                >
                  <div className="flex items-start gap-3 shrink-0 md:items-center">
                    <Checkbox
                      checked={selectedIds.has(ev._id)}
                      onCheckedChange={() => toggleSelected(ev._id)}
                      className="mt-1 md:mt-0"
                      aria-label={`Select ${ev.title}`}
                    />
                    <div className="h-14 w-14 bg-amber-50 rounded-2xl flex flex-col items-center justify-center">
                      <span className="text-xs font-black text-amber-600 uppercase">
                        {new Date(ev.startTime).toLocaleString("default", {
                          month: "short",
                        })}
                      </span>
                      <span className="text-xl font-black text-amber-700 leading-none">
                        {new Date(ev.startTime).getDate()}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-black text-gray-900 text-lg truncate">
                        {ev.title}
                      </h4>
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase border-gray-200 text-gray-400 font-bold"
                      >
                        {ev.eventType}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock size={14} className="text-amber-500" />
                        {new Date(ev.startTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        →{" "}
                        {new Date(ev.endTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {ev.location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={14} className="text-amber-500" />
                          {ev.location}
                        </span>
                      )}
                    </div>
                    {ev.description && (
                      <p className="mt-2 text-sm text-gray-600 line-clamp-1">
                        {ev.description}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(ev)}
                      className="rounded-xl hover:bg-amber-50 hover:text-amber-600"
                    >
                      <Edit3 size={18} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(ev._id)}
                      className="rounded-xl hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={18} />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-[2.5rem] p-8 border-none">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-gray-900">
              Edit Event
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="font-bold text-gray-700 ml-1">Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-2xl border-gray-200 h-12 bg-gray-50 text-gray-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-bold text-gray-700 ml-1">Start</Label>
                <Input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="rounded-2xl border-gray-200 h-12 bg-gray-50 text-gray-900"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold text-gray-700 ml-1">End</Label>
                <Input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="rounded-2xl border-gray-200 h-12 bg-gray-50 text-gray-900"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold text-gray-700 ml-1">Location</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="rounded-2xl border-gray-200 h-12 bg-gray-50 text-gray-900"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold text-gray-700 ml-1">Type</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger className="rounded-2xl border-gray-200 h-12 bg-gray-50 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="activity">Activity</SelectItem>
                  <SelectItem value="travel">Travel</SelectItem>
                  <SelectItem value="food">Food</SelectItem>
                  <SelectItem value="lodging">Lodging</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setEditOpen(false)}
              className="rounded-xl font-bold text-gray-500"
            >
              Cancel
            </Button>
            <Button
              onClick={saveEdit}
              disabled={savingEdit || !title.trim()}
              className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black px-6"
            >
              {savingEdit ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Popup Alert */}
      <Dialog
        open={showErrorPopup}
        onOpenChange={(open) => {
          setShowErrorPopup(open);
          if (!open) setErrorPopupTripLink(false);
        }}
      >
        <DialogContent className="rounded-[2.5rem] border-4 border-red-600 p-10 bg-white shadow-[10px_10px_0px_0px_rgba(220,38,38,1)] max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="text-4xl font-black text-red-600 uppercase tracking-tighter flex items-center gap-3">
              <Zap fill="currentColor" size={32} /> Trip Error
            </DialogTitle>
          </DialogHeader>

          <div className="py-8 space-y-4">
            <p className="text-xl font-black text-gray-900 leading-tight">
              {popupMsg}
            </p>
            {errorPopupTripLink ? (
              <Link
                href={`/dashboard/groups/${groupId}/trip`}
                className="inline-block text-lg font-bold text-amber-700 hover:text-amber-800 underline underline-offset-2"
              >
                Open trip settings
              </Link>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              onClick={() => setShowErrorPopup(false)}
              className="w-full h-16 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-1 transition-all text-xl uppercase tracking-widest"
            >
              got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Popup Alert */}
      <Dialog open={showSuccessPopup} onOpenChange={setShowSuccessPopup}>
        <DialogContent className="rounded-[2.5rem] border-4 border-amber-500 p-0 bg-white shadow-[10px_10px_0px_0px_rgba(245,158,11,1)] max-w-md mx-auto overflow-hidden">
          {/* forced centering container */}
          <div className="flex flex-col items-center justify-center p-10 w-full text-center">
            {/* title section */}
            <div className="flex flex-col items-center justify-center gap-3 mb-8">
              <h2 className="text-4xl font-black text-amber-500 uppercase tracking-tighter">
                Sparked
              </h2>
            </div>

            {/* body section */}
            <div className="mb-10">
              <p className="text-xl font-black text-gray-900 leading-tight mb-2">
                {popupMsg}
              </p>
              <p className="text-sm font-bold text-gray-400 leading-relaxed">
                Your timeline has been refreshed with the new activities
              </p>
            </div>

            {/* button section - forced full width */}
            <div className="w-full">
              <Button
                onClick={() => setShowSuccessPopup(false)}
                className="w-full h-16 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-1 transition-all text-xl uppercase tracking-widest"
              >
                Nice
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ItineraryRegeneratePreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        originals={previewOriginals}
        proposed={previewProposed}
        applying={applying}
        onAccept={() => void handleApplyPreview()}
        onCancel={() => setPreviewOpen(false)}
      />
    </div>
  );
}
