"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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

export default function CalendarEventsPanel({ groupId }: Props) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [from, setFrom] = useState(() => toDatetimeLocalValue(new Date()));
  const [to, setTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return toDatetimeLocalValue(d);
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState(() => toDatetimeLocalValue(new Date()));
  const [endTime, setEndTime] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    return toDatetimeLocalValue(d);
  });
  const [location, setLocation] = useState("");
  const [eventType, setEventType] = useState("activity");
  const [creating, setCreating] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const rangeQuery = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("from", new Date(from).toISOString());
    qs.set("to", new Date(to).toISOString());
    return `?${qs.toString()}`;
  }, [from, to]);

  async function fetchEvents() {
    try {
      setLoading(true);
      setErr(null);
      const res = await fetch(`/api/groups/${groupId}/calendar/events${rangeQuery}`, {
        method: "GET",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load events");
      setEvents(data.events ?? data.calendarEvents ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load events");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (!res.ok) throw new Error(data?.error || "Failed to create event");

      setTitle("");
      setDescription("");
      setLocation("");
      setEventType("activity");

      await fetchEvents();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create event");
    } finally {
      setCreating(false);
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
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update event");

      setEditOpen(false);
      setEditEvent(null);
      await fetchEvents();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update event");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(eventId: string) {
    try {
      setErr(null);
      const res = await fetch(`/api/groups/${groupId}/calendar/events/${eventId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete event");
      await fetchEvents();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to delete event");
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Calendar</h2>
        <Badge variant="secondary">{events.length} events</Badge>
      </div>

      <Card className="p-4 mb-6 bg-white border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-gray-800">From</Label>
            <Input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="text-gray-900 placeholder:text-gray-500"
            />
          </div>
          <div>
            <Label className="text-gray-800">To</Label>
            <Input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="text-gray-900 placeholder:text-gray-500"
            />
          </div>
        </div>
        <div className="mt-3">
          <Button variant="outline" onClick={fetchEvents}>
            Refresh
          </Button>
        </div>
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      </Card>

      <Card className="p-4 mb-6 bg-white border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-3">Add event</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label className="text-gray-800">Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Dinner reservation, museum, flight..."
              className="text-gray-900 placeholder:text-gray-500"
            />
          </div>

          <div>
            <Label className="text-gray-800">Start</Label>
            <Input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="text-gray-900 placeholder:text-gray-500"
            />
          </div>

          <div>
            <Label className="text-gray-800">End</Label>
            <Input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="text-gray-900 placeholder:text-gray-500"
            />
          </div>

          <div className="md:col-span-2">
            <Label className="text-gray-800">Location</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Address or place name"
              className="text-gray-900 placeholder:text-gray-500"
            />
          </div>

          <div className="md:col-span-2">
            <Label className="text-gray-800">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes/details..."
              className="text-gray-900 placeholder:text-gray-500"
            />
          </div>

          <div>
            <Label className="text-gray-800">Type</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="text-gray-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
              className="w-full"
            >
              {creating ? "Adding…" : "Add event"}
            </Button>
          </div>
        </div>

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      </Card>

      {loading ? (
        <p className="text-gray-600">Loading events…</p>
      ) : events.length === 0 ? (
        <p className="text-gray-600">No events in this range.</p>
      ) : (
        <ul className="space-y-3">
          {events
            .slice()
            .sort(
              (a, b) =>
                new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
            )
            .map((ev) => (
              <li
                key={ev._id}
                className="border border-gray-200 rounded-xl p-4 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{ev.title}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(ev.startTime).toLocaleString()} →{" "}
                      {new Date(ev.endTime).toLocaleString()}
                    </p>
                    {(ev.location || ev.eventType) && (
                      <p className="text-sm text-gray-600 truncate">
                        {ev.location ? ev.location : ""}
                        {ev.location && ev.eventType ? " • " : ""}
                        {ev.eventType ? ev.eventType : ""}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => openEdit(ev)}>
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => handleDelete(ev._id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                {ev.description && (
                  <p className="text-sm text-gray-700">{ev.description}</p>
                )}
              </li>
            ))}
        </ul>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit event</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-gray-800">Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-gray-900 placeholder:text-gray-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-800">Start</Label>
                <Input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="text-gray-900 placeholder:text-gray-500"
                />
              </div>
              <div>
                <Label className="text-gray-800">End</Label>
                <Input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="text-gray-900 placeholder:text-gray-500"
                />
              </div>
            </div>

            <div>
              <Label className="text-gray-800">Location</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="text-gray-900 placeholder:text-gray-500"
              />
            </div>

            <div>
              <Label className="text-gray-800">Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-gray-900 placeholder:text-gray-500"
              />
            </div>

            <div>
              <Label className="text-gray-800">Type</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger className="text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activity">Activity</SelectItem>
                  <SelectItem value="travel">Travel</SelectItem>
                  <SelectItem value="food">Food</SelectItem>
                  <SelectItem value="lodging">Lodging</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {err && <p className="text-sm text-red-600">{err}</p>}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={savingEdit}
            >
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={savingEdit || !title.trim()}>
              {savingEdit ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}