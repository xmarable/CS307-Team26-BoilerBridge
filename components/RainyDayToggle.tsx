"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CloudRain,
  Sun,
  Columns,
  ChevronRight,
  Pencil,
  GripVertical,
} from "lucide-react";
import { isValidActivityMongoId } from "@/lib/activityObjectId";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type ItineraryActivityRow = {
  name?: string;
  activityId?: string;
  itineraryActivityId?: string;
  dayId?: string;
  startTime?: string;
  endTime?: string;
  isOutdoor?: boolean;
  category?: string;
  location?: string;
};

export type RainyDayTripInput = {
  primaryItinerary: ItineraryActivityRow[];
  rainyDayItinerary: ItineraryActivityRow[];
  itineraryVersion?: number;
};

type ItineraryKind = "primary" | "rainy";

type RainyDayToggleProps = {
  trip: RainyDayTripInput;
  tripId?: string;
  canEdit?: boolean;
  onItinerarySynced?: (payload: {
    itineraryVersion: number;
    primaryItinerary: ItineraryActivityRow[];
    rainyDayItinerary: ItineraryActivityRow[];
  }) => void;
};

function toDatetimeLocalValue(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function cloneTrip(t: RainyDayTripInput): RainyDayTripInput {
  return {
    primaryItinerary: (t.primaryItinerary ?? []).map((a) => ({ ...a })),
    rainyDayItinerary: (t.rainyDayItinerary ?? []).map((a) => ({ ...a })),
    itineraryVersion: t.itineraryVersion,
  };
}

function minStartForDay(acts: ItineraryActivityRow[]): number {
  let min = Infinity;
  for (const a of acts) {
    const t = a.startTime ? new Date(a.startTime).getTime() : NaN;
    if (!Number.isNaN(t)) min = Math.min(min, t);
  }
  return min === Infinity ? 0 : min;
}

function groupActsByDay(acts: ItineraryActivityRow[]) {
  const map = new Map<string, ItineraryActivityRow[]>();
  for (const a of acts) {
    const k = a.dayId && a.dayId.length > 0 ? a.dayId : "_ungrouped";
    const arr = map.get(k) ?? [];
    arr.push(a);
    map.set(k, arr);
  }
  return [...map.entries()].sort(
    ([, a], [, b]) => minStartForDay(a) - minStartForDay(b),
  );
}

// redistributes the time slots from the original order to the new order
function redistributeTimes(
  original: ItineraryActivityRow[],
  reordered: ItineraryActivityRow[],
): ItineraryActivityRow[] {
  const slots = original.map((a) => ({
    startTime: a.startTime,
    endTime: a.endTime,
  }));
  return reordered.map((act, idx) => ({
    ...act,
    startTime: slots[idx]?.startTime ?? act.startTime,
    endTime: slots[idx]?.endTime ?? act.endTime,
  }));
}

function SortableCard({
  act,
  className,
  subtitle,
  subtitleClassName,
  canEdit,
  onEditActivity,
}: {
  act: ItineraryActivityRow;
  className?: string;
  subtitle?: string;
  subtitleClassName?: string;
  canEdit?: boolean;
  onEditActivity?: (act: ItineraryActivityRow) => void;
}) {
  const id =
    act.itineraryActivityId ?? `${act.dayId}-${act.name}-${act.startTime}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !canEdit });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const detailHref = isValidActivityMongoId(act.activityId)
    ? `/dashboard/activities/${act.activityId}`
    : null;

  const subline = subtitle ?? (act.isOutdoor ? "Outdoor" : "Indoor");

  const titleBlock = (
    <div>
      <p className="font-medium">{act.name ?? "Activity"}</p>
      <p className={`text-xs ${subtitleClassName ?? "text-gray-500"}`}>
        {subline}
      </p>
      {act.startTime ? (
        <p className="text-xs text-gray-400 mt-1">
          {new Date(act.startTime).toLocaleString()}
          {act.location ? ` · ${act.location}` : ""}
        </p>
      ) : act.location ? (
        <p className="text-xs text-gray-400 mt-1">{act.location}</p>
      ) : null}
    </div>
  );

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            {canEdit ? (
              <button
                type="button"
                className="mt-1 shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-amber-500 transition-colors"
                aria-label="Drag to reorder"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-4 w-4" />
              </button>
            ) : (
              <div
                className="mt-1 shrink-0 text-gray-200 cursor-not-allowed"
                title="Read-only: you cannot reorder activities"
              >
                <GripVertical className="h-4 w-4" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {detailHref ? (
                    <Link
                      href={detailHref}
                      className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                    >
                      <div className="flex items-start justify-between gap-2">
                        {titleBlock}
                        <ChevronRight
                          className="h-4 w-4 text-amber-600 shrink-0 mt-1"
                          aria-hidden
                        />
                      </div>
                      <p className="text-xs text-amber-700 mt-2 font-medium">
                        View details
                      </p>
                    </Link>
                  ) : (
                    titleBlock
                  )}
                </div>
                {canEdit && onEditActivity ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 rounded-lg border-amber-200 text-amber-800"
                    onClick={() => onEditActivity(act)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function RainyDayToggle({
  trip,
  tripId,
  canEdit = false,
  onItinerarySynced,
}: RainyDayToggleProps) {
  const [viewMode, setViewMode] = useState<"primary" | "rainy" | "compare">(
    "primary",
  );
  const [localTrip, setLocalTrip] = useState<RainyDayTripInput>(() =>
    cloneTrip(trip),
  );
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [editKind, setEditKind] = useState<ItineraryKind>("primary");
  const [editingActivity, setEditingActivity] =
    useState<ItineraryActivityRow | null>(null);
  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formOutdoor, setFormOutdoor] = useState(false);
  const [formDayOutdoor, setFormDayOutdoor] = useState(false);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  useEffect(() => {
    setLocalTrip(cloneTrip(trip));
  }, [trip]);

  const primaryByDay = useMemo(
    () => groupActsByDay(localTrip.primaryItinerary ?? []),
    [localTrip.primaryItinerary],
  );
  const rainyByDay = useMemo(
    () => groupActsByDay(localTrip.rainyDayItinerary ?? []),
    [localTrip.rainyDayItinerary],
  );

  const applyServerPayload = useCallback(
    (payload: {
      itineraryVersion: number;
      primaryItinerary?: ItineraryActivityRow[];
      rainyDayItinerary?: ItineraryActivityRow[];
    }) => {
      setLocalTrip((prev) => ({
        primaryItinerary: (
          payload.primaryItinerary ?? prev.primaryItinerary
        ).map((a) => ({ ...a })),
        rainyDayItinerary: (
          payload.rainyDayItinerary ?? prev.rainyDayItinerary
        ).map((a) => ({ ...a })),
        itineraryVersion: payload.itineraryVersion,
      }));
    },
    [],
  );

  const patchSection = useCallback(
    async (body: Record<string, unknown>) => {
      if (!tripId) throw new Error("Missing trip id");
      const res = await fetch(`/api/itinerary/${tripId}/section`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        itineraryVersion?: number;
        primaryItinerary?: ItineraryActivityRow[];
        rainyDayItinerary?: ItineraryActivityRow[];
      };
      if (!res.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : `Request failed (${res.status})`,
        );
      }
      if (typeof data.itineraryVersion !== "number") {
        throw new Error("Invalid server response");
      }
      applyServerPayload({
        itineraryVersion: data.itineraryVersion,
        primaryItinerary: data.primaryItinerary,
        rainyDayItinerary: data.rainyDayItinerary,
      });
      onItinerarySynced?.({
        itineraryVersion: data.itineraryVersion,
        primaryItinerary: (data.primaryItinerary ??
          []) as ItineraryActivityRow[],
        rainyDayItinerary: (data.rainyDayItinerary ??
          []) as ItineraryActivityRow[],
      });
    },
    [tripId, applyServerPayload, onItinerarySynced],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent, kind: ItineraryKind, dayId: string) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const key = kind === "primary" ? "primaryItinerary" : "rainyDayItinerary";
      const prev = cloneTrip(localTrip);

      setLocalTrip((lt) => {
        const arr = lt[key];
        const dayActs = arr.filter((a) => a.dayId === dayId);
        const rest = arr.filter((a) => a.dayId !== dayId);

        const oldIdx = dayActs.findIndex(
          (a) =>
            (a.itineraryActivityId ?? `${a.dayId}-${a.name}-${a.startTime}`) ===
            active.id,
        );
        const newIdx = dayActs.findIndex(
          (a) =>
            (a.itineraryActivityId ?? `${a.dayId}-${a.name}-${a.startTime}`) ===
            over.id,
        );
        if (oldIdx === -1 || newIdx === -1) return lt;

        const reordered = arrayMove(dayActs, oldIdx, newIdx);
        const withTimes = redistributeTimes(dayActs, reordered);

        return { ...lt, [key]: [...rest, ...withTimes] };
      });

      try {
        const arr = prev[key];
        const dayActs = arr.filter((a) => a.dayId === dayId);
        const oldIdx = dayActs.findIndex(
          (a) =>
            (a.itineraryActivityId ?? `${a.dayId}-${a.name}-${a.startTime}`) ===
            active.id,
        );
        const newIdx = dayActs.findIndex(
          (a) =>
            (a.itineraryActivityId ?? `${a.dayId}-${a.name}-${a.startTime}`) ===
            over.id,
        );
        if (oldIdx === -1 || newIdx === -1) return;

        const reordered = arrayMove(dayActs, oldIdx, newIdx);
        const withTimes = redistributeTimes(dayActs, reordered);

        await patchSection({
          scope: "reorder",
          dayId,
          itineraryKind: kind,
          version: localTrip.itineraryVersion ?? 0,
          order: withTimes.map((a) => ({
            itineraryActivityId: a.itineraryActivityId,
            startTime: a.startTime,
            endTime: a.endTime,
          })),
        });
      } catch (e) {
        setLocalTrip(prev);
        setSectionError(e instanceof Error ? e.message : "Reorder failed");
      }
    },
    [localTrip, patchSection],
  );

  const openActivityEditor = (
    kind: ItineraryKind,
    act: ItineraryActivityRow,
  ) => {
    setEditKind(kind);
    setEditingActivity(act);
    setFormName(act.name ?? "");
    setFormLocation(act.location ?? "");
    setFormCategory(act.category ?? "");
    setFormStart(toDatetimeLocalValue(act.startTime));
    setFormEnd(toDatetimeLocalValue(act.endTime));
    setFormOutdoor(!!act.isOutdoor);
    setActivityDialogOpen(true);
    setSectionError(null);
  };

  const openDayEditor = (
    kind: ItineraryKind,
    dayId: string,
    acts: ItineraryActivityRow[],
  ) => {
    setEditKind(kind);
    setEditingDayId(dayId);
    const outdoorCount = acts.filter((a) => a.isOutdoor).length;
    setFormDayOutdoor(outdoorCount > acts.length / 2);
    setDayDialogOpen(true);
    setSectionError(null);
  };

  const handleSaveActivity = async () => {
    if (
      !tripId ||
      !editingActivity?.dayId ||
      !editingActivity.itineraryActivityId
    ) {
      setSectionError("This activity is missing section ids; reload the page.");
      return;
    }
    const prev = cloneTrip(localTrip);
    const start = formStart ? new Date(formStart).toISOString() : undefined;
    const end = formEnd ? new Date(formEnd).toISOString() : undefined;
    const optimistic: ItineraryActivityRow = {
      ...editingActivity,
      name: formName,
      location: formLocation || undefined,
      category: formCategory || undefined,
      startTime: start ?? editingActivity.startTime,
      endTime: end ?? editingActivity.endTime,
      isOutdoor: formOutdoor,
    };

    setLocalTrip((lt) => {
      const key =
        editKind === "primary" ? "primaryItinerary" : "rainyDayItinerary";
      const next = lt[key].map((a) =>
        a.itineraryActivityId === optimistic.itineraryActivityId
          ? { ...optimistic }
          : a,
      );
      return { ...lt, [key]: next };
    });
    setActivityDialogOpen(false);
    setSaving(true);
    setSectionError(null);

    try {
      await patchSection({
        scope: "activity",
        dayId: editingActivity.dayId,
        activityId: editingActivity.itineraryActivityId,
        itineraryKind: editKind,
        version: localTrip.itineraryVersion ?? 0,
        updates: {
          name: formName,
          location: formLocation || undefined,
          category: formCategory || undefined,
          ...(start ? { startTime: start } : {}),
          ...(end ? { endTime: end } : {}),
          isOutdoor: formOutdoor,
        },
      });
    } catch (e) {
      setLocalTrip(prev);
      setSectionError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDay = async () => {
    if (!tripId || !editingDayId) return;
    const prev = cloneTrip(localTrip);
    const key =
      editKind === "primary" ? "primaryItinerary" : "rainyDayItinerary";
    setLocalTrip((lt) => ({
      ...lt,
      [key]: lt[key].map((a) =>
        a.dayId === editingDayId ? { ...a, isOutdoor: formDayOutdoor } : a,
      ),
    }));
    setDayDialogOpen(false);
    setSaving(true);
    setSectionError(null);
    try {
      await patchSection({
        scope: "day",
        dayId: editingDayId,
        itineraryKind: editKind,
        version: localTrip.itineraryVersion ?? 0,
        updates: { isOutdoor: formDayOutdoor },
      });
    } catch (e) {
      setLocalTrip(prev);
      setSectionError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const renderPlan = (
    kind: ItineraryKind,
    byDay: [string, ItineraryActivityRow[]][],
  ) => {
    const showEdit = !!(canEdit && tripId);
    return (
      <div className="space-y-6">
        {byDay.map(([dayId, acts], idx) => {
          const sortableIds = acts.map(
            (a) =>
              a.itineraryActivityId ?? `${a.dayId}-${a.name}-${a.startTime}`,
          );
          return (
            <div key={dayId} className="space-y-2">
              <div className="flex items-center justify-between gap-2 px-1">
                <h4 className="text-sm font-bold text-gray-700">
                  Day {idx + 1}
                  {acts[0]?.startTime
                    ? ` · ${new Date(acts[0].startTime).toLocaleDateString()}`
                    : null}
                </h4>
                {showEdit && dayId !== "_ungrouped" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-amber-700"
                    onClick={() => openDayEditor(kind, dayId, acts)}
                  >
                    Edit day
                  </Button>
                ) : null}
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => void handleDragEnd(e, kind, dayId)}
              >
                <SortableContext
                  items={sortableIds}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {acts.map((act) => (
                      <SortableCard
                        key={
                          act.itineraryActivityId ??
                          `${dayId}-${act.name}-${act.startTime}`
                        }
                        act={act}
                        className={
                          kind === "rainy"
                            ? "border-blue-200 bg-blue-50/30"
                            : act.isOutdoor
                              ? "border-amber-200"
                              : ""
                        }
                        subtitle={
                          kind === "rainy" ? "Indoor Alternative" : undefined
                        }
                        subtitleClassName={
                          kind === "rainy" ? "text-blue-600" : undefined
                        }
                        canEdit={showEdit}
                        onEditActivity={(a) => openActivityEditor(kind, a)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {sectionError ? (
        <p className="text-sm text-red-600 font-medium" role="alert">
          {sectionError}
        </p>
      ) : null}

      <div className="flex gap-2 justify-center p-4 bg-gray-50 rounded-lg">
        <Button
          variant={viewMode === "primary" ? "default" : "outline"}
          onClick={() => setViewMode("primary")}
        >
          <Sun className="mr-2 h-4 w-4" /> Primary
        </Button>
        <Button
          variant={viewMode === "rainy" ? "default" : "outline"}
          onClick={() => setViewMode("rainy")}
        >
          <CloudRain className="mr-2 h-4 w-4" /> Rainy Day
        </Button>
        <Button
          variant={viewMode === "compare" ? "default" : "outline"}
          onClick={() => setViewMode("compare")}
        >
          <Columns className="mr-2 h-4 w-4" /> Compare
        </Button>
      </div>

      <div
        className={`grid gap-4 ${viewMode === "compare" ? "grid-cols-2" : "grid-cols-1"}`}
      >
        {(viewMode === "primary" || viewMode === "compare") && (
          <div className="space-y-2">
            <h3 className="font-bold text-center">Primary Plan</h3>
            {renderPlan("primary", primaryByDay)}
          </div>
        )}

        {(viewMode === "rainy" || viewMode === "compare") && (
          <div className="space-y-2">
            <h3 className="font-bold text-center text-blue-600">
              Rainy Day Plan
            </h3>
            {renderPlan("rainy", rainyByDay)}
          </div>
        )}
      </div>

      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Edit activity</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="it-name">Name</Label>
              <Input
                id="it-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="it-loc">Location</Label>
              <Input
                id="it-loc"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="it-cat">Category</Label>
              <Input
                id="it-cat"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="it-start">Start</Label>
                <Input
                  id="it-start"
                  type="datetime-local"
                  value={formStart}
                  onChange={(e) => setFormStart(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="it-end">End</Label>
                <Input
                  id="it-end"
                  type="datetime-local"
                  value={formEnd}
                  onChange={(e) => setFormEnd(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={formOutdoor}
                onChange={(e) => setFormOutdoor(e.target.checked)}
              />
              Outdoor activity
            </label>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setActivityDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={saving || !formName.trim()}
              className="bg-linear-to-r from-amber-500 to-orange-600 text-white rounded-xl"
              onClick={() => void handleSaveActivity()}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dayDialogOpen} onOpenChange={setDayDialogOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit day</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Set indoor/outdoor for every activity on this day ({editKind} plan).
          </p>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mt-4">
            <input
              type="checkbox"
              className="rounded border-gray-300"
              checked={formDayOutdoor}
              onChange={(e) => setFormDayOutdoor(e.target.checked)}
            />
            Mark day as outdoor-heavy
          </label>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setDayDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={saving}
              className="bg-linear-to-r from-amber-500 to-orange-600 text-white rounded-xl"
              onClick={() => void handleSaveDay()}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
