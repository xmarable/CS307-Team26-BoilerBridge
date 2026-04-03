"use client";

import { useState, useEffect } from "react";
import {
  CheckSquare,
  Plus,
  Bell,
  CalendarClock,
  Trash2,
  ShoppingBag,
  CheckCircle2,
  Link as LinkIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface Reminder {
  id: string;
  task: string;
  isCompleted: boolean;
  dueDate?: string;
  linkedEventId?: string;
}

interface CalendarEvent {
  _id: string;
  title: string;
}

export function TripChecklist({ groupId }: { groupId: string }) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [newTask, setNewTask] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string>("none");

  // fetch reminders and events for linking
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const [remRes, evRes] = await Promise.all([
          fetch(`/api/groups/${groupId}/reminders`),
          fetch(`/api/groups/${groupId}/calendar/events`),
        ]);

        if (!remRes.ok || !evRes.ok) return;

        const remData = await remRes.json();
        const evData = await evRes.json();

        // ONLY update state if the component hasn't unmounted
        if (isMounted) {
          setReminders(Array.isArray(remData) ? remData : []);
          setEvents(evData.events || []);
        }
      } catch (err) {
        console.error("Failed to fetch trip data", err);
      }
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [groupId]);

  const handleAddReminder = async () => {
    if (!newTask.trim()) return;

    const payload = {
      task: newTask,
      linkedEventId: selectedEventId === "none" ? null : selectedEventId,
      offsetMinutes: selectedEventId === "none" ? 0 : 180, // default 3 hours before
    };

    try {
      const res = await fetch(`/api/groups/${groupId}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const added = await res.json();
        setReminders([...reminders, added]);
        setNewTask("");
        setSelectedEventId("none");
      }
    } catch (err) {
      console.error("failed to add reminder", err);
    }
  };

  const toggleCompletion = async (id: string, currentStatus: boolean) => {
    setReminders((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, isCompleted: !currentStatus } : r,
      ),
    );

    try {
      await fetch(`/api/groups/${groupId}/reminders`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isCompleted: !currentStatus }),
      });
    } catch (err) {
      console.error("failed to update status", err);
    }
  };

  const handleDelete = async (id: string) => {
    // optimistic delete
    setReminders((prev) => prev.filter((r) => r.id !== id));

    try {
      await fetch(`/api/groups/${groupId}/reminders`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch (err) {
      console.error("failed to delete reminder", err);
    }
  };

  return (
    <Card className="bg-white rounded-[2.5rem] shadow-sm border border-gray-200 overflow-hidden">
      <CardHeader className="p-8 border-b border-gray-100 bg-linear-to-b from-gray-50/50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-linear-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-200">
              <CheckSquare className="text-white" size={28} />
            </div>
            <div>
              <CardTitle className="text-2xl font-black text-gray-900 tracking-tight">
                Trip Checklist
              </CardTitle>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                {Array.isArray(reminders)
                  ? reminders.filter((r) => r.isCompleted).length
                  : 0}{" "}
                / {Array.isArray(reminders) ? reminders.length : 0} Completed
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-8">
        <div className="space-y-3 mb-10">
          <div className="flex gap-3">
            <Input
              placeholder="Add a new packing item or task..."
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              className="h-14 rounded-2xl border-gray-200 bg-gray-50/50 px-6 font-medium focus:ring-amber-500 focus:border-amber-500 transition-all"
              onKeyDown={(e) => e.key === "Enter" && handleAddReminder()}
            />
            <Button
              onClick={handleAddReminder}
              className="h-14 w-14 bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-2xl shadow-md transition-all active:scale-95"
            >
              <Plus size={24} />
            </Button>
          </div>

          {/* event linker dropdown */}
          <div className="flex items-center gap-2 px-2 text-gray-500">
            <LinkIcon size={14} />
            <span className="text-xs font-bold uppercase tracking-tighter">
              Link to Event:
            </span>
            <Select value={selectedEventId} onValueChange={setSelectedEventId}>
              <SelectTrigger className="h-8 border-none bg-transparent shadow-none focus:ring-0 font-bold text-amber-600 w-fit p-0 gap-1 capitalize">
                <SelectValue placeholder="Select Event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Manual Entry Only</SelectItem>
                {events.map((ev) => (
                  <SelectItem key={ev._id} value={ev._id}>
                    {ev.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          {reminders.length > 0 ? (
            reminders.map((item) => (
              <div
                key={item.id}
                className={`group flex items-center justify-between p-6 rounded-3xl border transition-all duration-300 ${
                  item.isCompleted
                    ? "bg-gray-50/50 border-transparent opacity-60"
                    : "bg-white border-gray-100 hover:border-amber-200 hover:shadow-md"
                }`}
              >
                <div className="flex items-center gap-5">
                  <div className="relative flex items-center justify-center">
                    <Checkbox
                      checked={item.isCompleted}
                      onCheckedChange={() =>
                        toggleCompletion(item.id, item.isCompleted)
                      }
                      className="h-8 w-8 rounded-xl border-2 border-gray-200 data-[state=checked]:bg-linear-to-br data-[state=checked]:from-amber-500 data-[state=checked]:to-orange-600 data-[state=checked]:border-transparent transition-all"
                    />
                    {item.isCompleted && (
                      <CheckCircle2
                        className="absolute text-white pointer-events-none"
                        size={18}
                      />
                    )}
                  </div>

                  <div>
                    <span
                      className={`text-xl font-bold tracking-tight transition-all ${
                        item.isCompleted
                          ? "text-gray-400 line-through"
                          : "text-gray-800"
                      }`}
                    >
                      {item.task}
                    </span>
                    {item.linkedEventId && (
                      <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-amber-600 uppercase tracking-tighter">
                        <CalendarClock size={14} />
                        <span>Auto-Synced with Calendar</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Bell
                    className={`${item.isCompleted ? "text-gray-200" : "text-amber-400"} transition-colors`}
                    size={20}
                  />
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-16 bg-gray-50/50 rounded-4xl border-2 border-dashed border-gray-100">
              <ShoppingBag className="mx-auto text-gray-200 mb-4" size={48} />
              <p className="text-gray-400 font-black text-xl">
                No Tasks Added Yet
              </p>
              <p className="text-gray-400 font-medium">
                Start adding items to your packing list.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
