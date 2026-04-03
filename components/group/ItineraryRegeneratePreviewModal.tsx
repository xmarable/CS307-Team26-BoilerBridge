"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, MapPin } from "lucide-react";

export type PreviewOriginalRow = {
  _id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  eventType?: string;
};

export type PreviewProposedRow = {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  eventType?: string;
  timezone?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originals: PreviewOriginalRow[];
  proposed: PreviewProposedRow[];
  applying: boolean;
  onAccept: () => void;
  onCancel: () => void;
};

function formatRange(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  return (
    <>
      {s.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} →{" "}
      {e.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </>
  );
}

export default function ItineraryRegeneratePreviewModal({
  open,
  onOpenChange,
  originals,
  proposed,
  applying,
  onAccept,
  onCancel,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[2rem] max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-100">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-gray-900">
            Regeneration preview
          </DialogTitle>
          <p className="text-sm text-gray-500 font-medium">
            Compare proposed events with your selection. Accept to replace the
            originals, or cancel to keep the current itinerary.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">
              Original
            </h4>
            <div className="space-y-3">
              {originals.map((o, i) => (
                <div
                  key={o._id}
                  className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4 text-left"
                >
                  <p className="font-black text-gray-900">{o.title}</p>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Clock size={12} className="shrink-0" />
                    {formatRange(o.startTime, o.endTime)}
                  </p>
                  {o.location && (
                    <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                      <MapPin size={12} className="shrink-0" />
                      {o.location}
                    </p>
                  )}
                  {o.description && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                      {o.description}
                    </p>
                  )}
                </div>
              ))}
              {originals.length === 0 && (
                <p className="text-sm text-gray-400">No originals</p>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-amber-600 mb-3">
              Proposed
            </h4>
            <div className="space-y-3">
              {proposed.map((p, i) => (
                <div
                  key={`p-${i}`}
                  className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 text-left"
                >
                  <p className="font-black text-gray-900">{p.title}</p>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Clock size={12} className="shrink-0" />
                    {formatRange(p.startTime, p.endTime)}
                  </p>
                  {p.location && (
                    <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                      <MapPin size={12} className="shrink-0" />
                      {p.location}
                    </p>
                  )}
                  {p.description && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                      {p.description}
                    </p>
                  )}
                </div>
              ))}
              {proposed.length === 0 && (
                <p className="text-sm text-gray-400">No proposals</p>
              )}
            </div>
          </div>
        </div>

        {originals.length !== proposed.length && originals.length > 0 && (
          <p className="text-xs text-amber-700 font-bold">
            Note: original count ({originals.length}) differs from proposed (
            {proposed.length}); apply will delete all selected originals and add
            all proposed events.
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={applying}
            className="rounded-xl font-bold"
          >
            Cancel
          </Button>
          <Button
            onClick={onAccept}
            disabled={applying || proposed.length === 0}
            className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black px-6"
          >
            {applying ? "Applying…" : "Accept"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
