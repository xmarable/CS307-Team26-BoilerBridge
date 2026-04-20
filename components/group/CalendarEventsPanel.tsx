"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  SlidersHorizontal,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Checkbox } from "@/components/ui/checkbox";
import ItineraryRegeneratePreviewModal, {
  type PreviewOriginalRow,
  type PreviewProposedRow,
} from "@/components/group/ItineraryRegeneratePreviewModal";
import { ActivityVoting } from "@/components/group/ActivityVoting";
import { ItinerarySourcePublishControls } from "@/components/itineraries/ItinerarySourcePublishControls";
import { buildCalendarActivityDetailHref } from "@/lib/calendarActivityDetailLink";

/* ---------- Types ---------- */
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
  linkedActivityId?: string;
  linkedPlaceId?: string;
  itineraryDestinationCity?: string;
  displayOrder?: number;
};

type GroupTripOption = {
  _id: string;
  fromCity?: string;
  toCity?: string;
  fromDate?: string;
  toDate?: string;
};

type VoteData = Record<
  string,
  { upvotes: number; downvotes: number; userVote: "up" | "down" | null }
>;

type Props = {
  groupId: string;
  canPublishItinerary?: boolean;
  canEdit?: boolean;
};

/* ---------- Helper Functions ---------- */
function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

/** Returns a YYYY‑MM‑DD string for the day part of an ISO date */
function calendarDayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function toDateLabel(value?: string) {
  if (!value) return "Date TBD";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "Date TBD";
  return dt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatScheduleConflictMessage(data: {
  error?: string;
  conflictWith?: { title?: string; startTime?: string; endTime?: string };
}): string {
  const base =
    typeof data.error === "string" && data.error.trim()
      ? data.error.trim()
      : "That time conflicts with another activity.";
  const c = data.conflictWith;
  if (!c?.title || !c.startTime || !c.endTime) return base;
  const startLabel = new Date(c.startTime).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const endLabel = new Date(c.endTime).toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${base} Conflicts with “${c.title}” (${startLabel}–${endLabel}).`;
}

/* ---------- Sortable Event Card ---------- */
type SortableEventCardProps = {
  ev: CalendarEvent;
  canEdit: boolean;
  groupId: string;
  selectedIds: Set<string>;
  voteData: VoteData;
  onToggleSelect: (id: string) => void;
  onEdit: (ev: CalendarEvent) => void;
  onDelete: (id: string) => void;
};

function SortableEventCard({
  ev,
  canEdit,
  groupId,
  selectedIds,
  voteData,
  onToggleSelect,
  onEdit,
  onDelete,
}: SortableEventCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ev._id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const detailHref = buildCalendarActivityDetailHref(ev);
  const linkableClass =
    "flex-1 min-w-0 block rounded-2xl -mx-1 px-1 py-0.5 outline-offset-2 hover:bg-amber-50/50 focus-visible:ring-2 focus-visible:ring-amber-300/80 transition-colors group/link";

  const detailBlock = (
    <div className="min-w-0">
      <div className="flex items-start gap-2 mb-1 flex-wrap">
        <h4
          className={`font-black text-gray-900 text-lg leading-snug flex-1 min-w-0 ${
            detailHref
              ? "underline-offset-2 group-hover/link:underline decoration-amber-200/80"
              : ""
          }`}
        >
          {ev.title}
        </h4>
        <Badge
          variant="outline"
          className="text-[10px] uppercase border-gray-200 text-gray-400 font-bold shrink-0"
        >
          {ev.eventType}
        </Badge>
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-4 gap-y-1.5 text-sm font-bold text-gray-900">
        <span className="flex items-center gap-1.5 tabular-nums">
          <Clock size={14} className="text-amber-500 shrink-0" />
          <span>
            {new Date(ev.startTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span className="text-gray-400 font-black">→</span>
          <span>
            {new Date(ev.endTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </span>
        {ev.location && (
          <span className="flex items-start gap-1.5 text-gray-700 min-w-0">
            <MapPin size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <span className="wrap-break-word font-semibold">{ev.location}</span>
          </span>
        )}
      </div>

      {ev.description && (
        <p className="mt-2 text-sm text-gray-600 line-clamp-2">
          {ev.description}
        </p>
      )}
    </div>
  );

  const dragHandle = canEdit ? (
    <button
      {...attributes}
      {...listeners}
      type="button"
      aria-label="Drag to reorder"
      className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-amber-400 transition-colors shrink-0 touch-none p-1 -ml-1 rounded"
    >
      <GripVertical size={20} />
    </button>
  ) : (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-not-allowed text-gray-200 shrink-0 p-1 -ml-1">
          <GripVertical size={20} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">
        Viewers cannot reorder activities
      </TooltipContent>
    </Tooltip>
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group bg-white p-6 rounded-4xl border border-gray-100 shadow-sm hover:shadow-md hover:border-amber-200 transition-all flex flex-col md:flex-row md:items-start gap-4"
    >
      {/* Drag handle */}
      <div className="flex items-center shrink-0 self-start md:self-center pt-1 md:pt-0">
        {dragHandle}
      </div>

      {/* Checkbox + date badge */}
      <div className="flex items-start gap-3 shrink-0 md:items-center">
        <Checkbox
          checked={selectedIds.has(ev._id)}
          onCheckedChange={() => onToggleSelect(ev._id)}
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

      {/* Main event info */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {detailHref ? (
          <Link href={detailHref} className={linkableClass}>
            {detailBlock}
          </Link>
        ) : (
          <div className="flex-1 min-w-0">{detailBlock}</div>
        )}

        <div className="mt-2">
          <ActivityVoting
            activityId={ev._id}
            groupId={groupId}
            initialUpvotes={voteData[ev._id]?.upvotes ?? 0}
            initialDownvotes={voteData[ev._id]?.downvotes ?? 0}
            userVote={voteData[ev._id]?.userVote ?? null}
          />
        </div>
      </div>

      <div className="flex flex-row md:flex-col gap-2 shrink-0 md:items-end md:ml-auto pt-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onEdit(ev)}
          className="rounded-xl border border-amber-100 bg-amber-50/90 text-amber-950 shadow-none hover:bg-amber-100/90 font-semibold gap-1.5 h-9 px-3 dark:bg-amber-50 dark:text-amber-950 dark:border-amber-200 dark:hover:bg-amber-100"
        >
          <Edit3 size={16} />
          Edit
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onDelete(ev._id)}
          className="rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 font-semibold h-9"
        >
          <Trash2 size={16} className="inline mr-1" />
          Remove
        </Button>
      </div>
    </div>
  );
}

/* ---------- Main Component ---------- */
export default function CalendarEventsPanel({
  groupId,
  canPublishItinerary = false,
  canEdit = false,
}: Props) {
  const searchParams = useSearchParams();
  const showSparkReadyHint = searchParams.get("sparkReady") === "1";
  const tripWasJustCreated = searchParams.get("tripCreated") === "1";
  const prefsUpdatedHint = searchParams.get("prefsUpdated") === "1";
  const tripIdFromUrl = searchParams.get("tripId");

  /* ---------- Local State ---------- */
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // UI pop‑ups
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [popupMsg, setPopupMsg] = useState("");
  const [errorPopupTripLink, setErrorPopupTripLink] = useState(false);

  // Form fields for creating a new event
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

  // UI status flags
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [editDialogError, setEditDialogError] = useState<string | null>(null);
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
  const [tripOptions, setTripOptions] = useState<GroupTripOption[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const [voteData, setVoteData] = useState<VoteData>({});

  /* ---------- Derived Values ---------- */
  // Query string for the date range picker
  const rangeQuery = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("from", new Date(from).toISOString());
    qs.set("to", new Date(to).toISOString());
    return `?${qs.toString()}`;
  }, [from, to]);

  // Options for the “select by day” dropdown
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

  const hasGeneratedItinerary = useMemo(
    () => events.some((e) => e.source === "itinerary"),
    [events],
  );

  const eventsGroupedByDay = useMemo(() => {
    const sorted = events.slice().sort((a, b) => {
      const dayA = calendarDayKey(a.startTime);
      const dayB = calendarDayKey(b.startTime);
      if (dayA !== dayB) return dayA.localeCompare(dayB);
      // Within the same day, respect explicit displayOrder; fall back to startTime
      const orderA = a.displayOrder ?? new Date(a.startTime).getTime();
      const orderB = b.displayOrder ?? new Date(b.startTime).getTime();
      return orderA - orderB;
    });
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of sorted) {
      const k = calendarDayKey(ev.startTime);
      const arr = map.get(k) ?? [];
      arr.push(ev);
      map.set(k, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  /* ---------- API Calls ---------- */
  async function fetchEvents() {
    try {
      setLoading(true);
      setErr(null);
      const res = await fetch(
        `/api/groups/${groupId}/calendar/events${rangeQuery}`,
        { credentials: "include" },
      );
      const data = await res.json();
      console.log("[fetchEvents] status:", res.status, "| data:", data);
      if (!res.ok) throw new Error(data?.error || "Failed to load events.");
      const loaded: CalendarEvent[] = data.events ?? data.calendarEvents ?? [];
      setEvents(loaded);

      if (loaded.length > 0) {
        const ids = loaded.map((e) => e._id).join(",");
        const voteRes = await fetch(
          `/api/groups/${groupId}/itinerary/vote?activityIds=${ids}`,
        );
        if (voteRes.ok) {
          const voteJson = await voteRes.json();
          setVoteData(voteJson.votes ?? {});
        }
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load events.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchTripOptions() {
    try {
      setLoadingTrips(true);
      const res = await fetch(`/api/groups/${groupId}/trips`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load trips.");
      }
      const loadedTrips: GroupTripOption[] = Array.isArray(data?.trips)
        ? data.trips
        : [];
      setTripOptions(loadedTrips);
      setSelectedTripId((prev) => {
        if (prev && loadedTrips.some((trip) => trip._id === prev)) return prev;
        return loadedTrips[0]?._id ?? "";
      });
    } catch (e: any) {
      setTripOptions([]);
      setSelectedTripId("");
      setErr(e?.message ?? "Failed to load group trips.");
    } finally {
      setLoadingTrips(false);
    }
  }

  async function handleCreate() {
    try {
      setCreating(true);
      setErr(null);
      const res = await fetch(`/api/groups/${groupId}/calendar/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          location: location.trim() || undefined,
          eventType,
          source: "manual",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          res.status === 409 && data?.conflictWith
            ? formatScheduleConflictMessage(data)
            : data?.error || "Failed to create event.";
        throw new Error(msg);
      }
      // Reset the form
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
      if (!selectedTripId) {
        setPopupMsg("Select a trip first, then generate the itinerary.");
        setShowErrorPopup(true);
        return;
      }
      const res = await fetch(`/api/groups/${groupId}/itinerary/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: selectedTripId }),
      });
      const data = await res.json();
      if (!res.ok) {
        const primary = data?.error || "Failed to generate itinerary.";
        const details =
          typeof data?.details === "string" && data.details.trim()
            ? data.details.trim()
            : "";
        setPopupMsg(details ? `${primary}\n\n${details}` : primary);
        setErrorPopupTripLink(res.status === 404);
        setShowErrorPopup(true);
      } else {
        const generatedCount =
          typeof data?.count === "number"
            ? data.count
            : Number(data?.count ?? 0);
        if (!Number.isFinite(generatedCount) || generatedCount <= 0) {
          setPopupMsg(
            "Spark finished but returned no itinerary events. Add or approve must-haves, then try again.",
          );
          setShowErrorPopup(true);
        } else {
          setPopupMsg(data?.message || "Itinerary sparked successfully.");
          setShowSuccessPopup(true);
          await fetchEvents();
        }
      }
    } catch (e: any) {
      setPopupMsg("An unexpected error occurred during generation.");
      setShowErrorPopup(true);
    } finally {
      setGenerating(false);
    }
  }

  async function saveEdit() {
    if (!editEvent) return;
    try {
      setSavingEdit(true);
      setEditDialogError(null);
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
      if (!res.ok) {
        const msg =
          res.status === 409 && data?.conflictWith
            ? formatScheduleConflictMessage(data)
            : data?.error || "Failed to update event.";
        setEditDialogError(msg);
        return;
      }
      setEditOpen(false);
      setEditEvent(null);
      setErr(null);
      await fetchEvents();
    } catch (e: unknown) {
      setEditDialogError(
        e instanceof Error ? e.message : "Failed to update event.",
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(eventId: string) {
    try {
      setErr(null);
      const res = await fetch(
        `/api/groups/${groupId}/calendar/events/${eventId}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete event.");
      await fetchEvents();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to delete event.");
    }
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

  /* ---------- UI Helpers ---------- */
  function openEdit(ev: CalendarEvent) {
    setEditEvent(ev);
    setEditDialogError(null);
    setTitle(ev.title);
    setDescription(ev.description ?? "");
    setLocation(ev.location ?? "");
    setEventType(ev.eventType ?? "activity");
    setStartTime(toDatetimeLocalValue(new Date(ev.startTime)));
    setEndTime(toDatetimeLocalValue(new Date(ev.endTime)));
    setEditOpen(true);
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
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

  /* ---------- Drag-and-Drop ---------- */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  async function handleDragEnd(dragEvent: DragEndEvent) {
    const { active, over } = dragEvent;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const dayEntry = eventsGroupedByDay.find(([, dayEvents]) =>
      dayEvents.some((e) => e._id === activeId),
    );
    if (!dayEntry) return;

    const [, dayEvents] = dayEntry;
    const oldIndex = dayEvents.findIndex((e) => e._id === activeId);
    const newIndex = dayEvents.findIndex((e) => e._id === overId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const reordered = arrayMove(dayEvents, oldIndex, newIndex);

    // Optimistic update
    setEvents((prev) => {
      const next = [...prev];
      reordered.forEach((ev, idx) => {
        const i = next.findIndex((e) => e._id === ev._id);
        if (i !== -1) next[i] = { ...next[i], displayOrder: idx };
      });
      return next;
    });

    try {
      await fetch(`/api/groups/${groupId}/calendar/events/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orders: reordered.map((ev, idx) => ({
            eventId: ev._id,
            displayOrder: idx,
          })),
        }),
      });
    } catch {
      await fetchEvents();
    }
  }

  /* ---------- Effects ---------- */
  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, rangeQuery]);

  useEffect(() => {
    fetchTripOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  useEffect(() => {
    if (!tripIdFromUrl || tripOptions.length === 0) return;
    if (tripOptions.some((t) => t._id === tripIdFromUrl)) {
      setSelectedTripId(tripIdFromUrl);
    }
  }, [tripIdFromUrl, tripOptions]);

  /* ---------- Render ---------- */
  return (
    <div className="space-y-8">
      {/* ==================== */}
      {/* Global error banner   */}
      {/* ==================== */}
      {err && <p className="text-sm text-red-600 font-bold px-2">{err}</p>}

      {/* ====================================================== */}
      {/*   Date‑range selector (From / To) + Refresh button   */}
      {/* ====================================================== */}
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
          {/* From */}
          <div className="space-y-1.5">
            <Label className="text-gray-700 font-bold ml-1">From</Label>
            <Input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-2xl border-gray-200 h-12 bg-white text-gray-900"
            />
          </div>

          {/* To */}
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

      {canPublishItinerary ? (
        <ItinerarySourcePublishControls
          sourceType="group"
          sourceId={groupId}
          canPublish={canPublishItinerary}
          hasItineraryContent={events.some((e) => e.source === "itinerary")}
        />
      ) : null}

      {/* ====================================================== */}
      {/*  Baseline itinerary generator (spark button)       */}
      {/* ====================================================== */}
      <div className="bg-gray-900 rounded-[2.5rem] p-8 text-white shadow-2xl border border-gray-800">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 text-center md:text-left">
            <h3 className="text-2xl font-black tracking-tighter flex items-center justify-center md:justify-start gap-2 uppercase">
              <Zap className="text-amber-400 fill-amber-400" size={24} />
              spark itinerary
            </h3>
            <p className="text-gray-400 font-bold text-sm">
              Builds a full timeline with Ollama (local) from your trip and
              approved must‑haves
            </p>
            {showSparkReadyHint && (
              <p className="text-amber-300 font-bold text-xs uppercase tracking-wider pt-1">
                {tripWasJustCreated
                  ? "Trip saved. Generate itinerary from your trip settings now."
                  : "Your trip settings are ready for Spark generation."}
              </p>
            )}
            {prefsUpdatedHint && (
              <p className="text-emerald-300/95 font-bold text-xs uppercase tracking-wider pt-1">
                Trip preferences saved. Regenerate the itinerary to apply your
                latest budget and avoid lists.
              </p>
            )}
            <div className="w-full md:w-96">
              <Label className="text-xs font-black uppercase tracking-wider text-gray-300 mb-2 block">
                Trip Source
              </Label>
              <Select
                value={selectedTripId || "__none__"}
                onValueChange={(value) =>
                  setSelectedTripId(value === "__none__" ? "" : value)
                }
                disabled={loadingTrips || generating}
              >
                <SelectTrigger className="rounded-2xl border-gray-600 bg-gray-950/60 text-white h-11">
                  <SelectValue
                    placeholder={
                      loadingTrips ? "Loading trips..." : "Choose a trip"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {tripOptions.length === 0 ? (
                    <SelectItem value="__none__">No trips available</SelectItem>
                  ) : (
                    tripOptions.map((trip) => (
                      <SelectItem key={trip._id} value={trip._id}>
                        {`${trip.fromCity ?? "Unknown"} -> ${trip.toCity ?? "Unknown"} (${toDateLabel(trip.fromDate)} - ${toDateLabel(trip.toDate)})`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {selectedTripId ? (
              <Button
                asChild
                variant="secondary"
                className="mt-3 w-full md:w-auto rounded-2xl border border-gray-600 bg-gray-800 text-white hover:bg-gray-700 font-bold text-xs uppercase tracking-wider"
              >
                <Link
                  href={`/dashboard/trip/${encodeURIComponent(selectedTripId)}/edit?returnGroup=${encodeURIComponent(groupId)}`}
                  className="inline-flex items-center gap-2"
                >
                  <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden />
                  Edit trip preferences
                </Link>
              </Button>
            ) : null}
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating || loadingTrips || !selectedTripId}
            className="bg-amber-500 hover:bg-amber-400 text-black font-black px-10 h-14 rounded-2xl shadow-lg shadow-amber-500/20 transition-all active:scale-95 uppercase tracking-widest"
          >
            {generating ? (
              <RefreshCw className="animate-spin mr-2" size={20} />
            ) : hasGeneratedItinerary ? (
              "Regenerate Itinerary"
            ) : (
              "Generate Itinerary"
            )}
          </Button>
        </div>
      </div>

      {/* ====================================================== */}
      {/*               Add Event Form (Manual entry)          */}
      {/* ====================================================== */}
      <div className="bg-amber-50/50 rounded-[2.5rem] p-8 border border-amber-100/50">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-amber-500 rounded-2xl text-white shadow-lg shadow-amber-200">
            <Plus size={24} />
          </div>
          <h3 className="text-2xl font-black text-gray-900 tracking-tight">
            Add to Timeline
          </h3>
        </div>

        {/* Form fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Title (full‑width) */}
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

          {/* Start Time */}
          <div className="space-y-1.5">
            <Label className="text-gray-700 font-bold ml-1">Start Time</Label>
            <Input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="rounded-2xl border-gray-200 h-14 bg-white text-gray-900 shadow-sm"
            />
          </div>

          {/* End Time */}
          <div className="space-y-1.5">
            <Label className="text-gray-700 font-bold ml-1">End Time</Label>
            <Input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="rounded-2xl border-gray-200 h-14 bg-white text-gray-900 shadow-sm"
            />
          </div>

          {/* Location */}
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

          {/* Event type selector */}
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

          {/* Submit button */}
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

      {/* ====================================================== */}
      {/*               Events Feed (list + actions)           */}
      {/* ====================================================== */}
      <div className="space-y-4">
        {/* Header + day filter */}
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
            {/* Day selector */}
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

            {/* Action buttons */}
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

        {/* Events list / empty state / loading */}
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(e) => void handleDragEnd(e)}
          >
            <div className="space-y-10">
              {eventsGroupedByDay.map(([dayKey, dayEvents]) => {
                const dayHeading = new Date(
                  dayEvents[0]!.startTime,
                ).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                });
                return (
                  <section key={dayKey} className="space-y-4">
                    <div className="flex items-center gap-3 px-1">
                      <div className="h-px flex-1 bg-gray-200" />
                      <span className="text-xs font-black uppercase tracking-widest text-amber-800 bg-amber-50 border border-amber-100 px-4 py-1.5 rounded-full">
                        {dayHeading}
                      </span>
                      <div className="h-px flex-1 bg-gray-200" />
                    </div>
                    <SortableContext
                      items={dayEvents.map((e) => e._id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="grid gap-4">
                        {dayEvents.map((ev) => (
                          <SortableEventCard
                            key={ev._id}
                            ev={ev}
                            canEdit={canEdit}
                            groupId={groupId}
                            selectedIds={selectedIds}
                            voteData={voteData}
                            onToggleSelect={toggleSelected}
                            onEdit={openEdit}
                            onDelete={handleDelete}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </section>
                );
              })}
            </div>
          </DndContext>
        )}
      </div>

      {/* ==================== */}
      {/* Edit Event Dialog   */}
      {/* ==================== */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditEvent(null);
            setEditDialogError(null);
          }
        }}
      >
        <DialogContent className="rounded-[2.5rem] p-8 border border-gray-100 shadow-xl max-w-lg w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-gray-900 tracking-tight">
              Edit activity
            </DialogTitle>
            <p className="text-sm text-gray-500 font-medium pt-1">
              Update times, title, or details. Saves are checked so activities
              don’t overlap on the timeline.
            </p>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-1.5">
              <Label className="font-bold text-gray-800 ml-0.5">Title *</Label>
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setEditDialogError(null);
                }}
                className="rounded-2xl border-gray-200 h-12 bg-white text-gray-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-bold text-gray-800 ml-0.5">Start</Label>
                <Input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    setEditDialogError(null);
                  }}
                  className="rounded-2xl border-gray-200 h-12 bg-white text-gray-900"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold text-gray-800 ml-0.5">End</Label>
                <Input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    setEditDialogError(null);
                  }}
                  className="rounded-2xl border-gray-200 h-12 bg-white text-gray-900"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold text-gray-800 ml-0.5">Location</Label>
              <Input
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setEditDialogError(null);
                }}
                className="rounded-2xl border-gray-200 h-12 bg-white text-gray-900"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold text-gray-800 ml-0.5">Notes</Label>
              <Textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setEditDialogError(null);
                }}
                rows={3}
                placeholder="Optional details for your group"
                className="rounded-2xl border-gray-200 bg-white text-gray-900 resize-none min-h-22"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold text-gray-800 ml-0.5">Type</Label>
              <Select
                value={eventType}
                onValueChange={(v) => {
                  setEventType(v);
                  setEditDialogError(null);
                }}
              >
                <SelectTrigger className="rounded-2xl border-gray-200 h-12 bg-white text-gray-900">
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

            {editDialogError && (
              <p
                className="text-sm font-bold text-red-700 bg-red-50 border border-red-100 rounded-2xl px-4 py-3"
                role="alert"
              >
                {editDialogError}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 flex-col sm:flex-row sm:justify-end pt-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setEditOpen(false)}
              className="rounded-xl font-bold border-gray-200 text-gray-700 w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void saveEdit()}
              disabled={savingEdit || !title.trim()}
              className="rounded-xl bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black px-8 w-full sm:w-auto"
            >
              {savingEdit ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== */}
      {/* Error Popup Dialog */}
      {/* ==================== */}
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
            <p className="text-xl font-black text-gray-900 leading-tight whitespace-pre-line">
              {popupMsg}
            </p>
            {errorPopupTripLink && (
              <Link
                href={`/dashboard/groups/${groupId}/trip`}
                className="inline-block text-lg font-bold text-amber-700 hover:text-amber-800 underline underline-offset-2"
              >
                Open trip settings
              </Link>
            )}
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

      {/* ==================== */}
      {/* Success Popup Dialog */}
      {/* ==================== */}
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

            {/* button */}
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

      {/* ==================== */}
      {/* Regeneration Preview Modal */}
      {/* ==================== */}
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
