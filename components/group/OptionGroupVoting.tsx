"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export type PollData = {
  optionGroupId: string;
  tallies: Record<string, number>;
  myVote: string | null;
  candidates: Array<{ optionId: string; title: string; startTime: string }>;
};

type Props = {
  eventId: string;
  optionGroupId: string;
  poll: PollData | undefined;
  voting: boolean;
  onPick: () => void;
  showFinalize?: boolean;
  finalizing?: boolean;
  onFinalize?: () => void;
};

export function OptionGroupVoting({
  eventId,
  optionGroupId,
  poll,
  voting,
  onPick,
  showFinalize,
  finalizing,
  onFinalize,
}: Props) {
  const tallies = poll?.tallies ?? {};
  const counts = Object.values(tallies);
  const max = counts.length ? Math.max(...counts) : 0;
  const myCount = tallies[eventId] ?? 0;
  const isLeading = max > 0 && myCount === max;
  const mine = poll?.myVote === eventId;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap sm:gap-x-3">
      <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-800">
        <input
          type="radio"
          name={`poll-${optionGroupId}`}
          checked={mine}
          onChange={() => onPick()}
          disabled={voting}
          className="h-4 w-4 accent-amber-600"
        />
        <span className="tabular-nums text-amber-800">
          {myCount} vote{myCount === 1 ? "" : "s"}
        </span>
      </label>
      {voting && <Loader2 className="animate-spin h-4 w-4 text-amber-600" />}
      {isLeading && max > 0 && (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-bold text-[10px] uppercase w-fit">
          Group choice
        </Badge>
      )}
      {showFinalize && onFinalize && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-xl h-8 text-xs font-bold border-amber-200"
          disabled={finalizing}
          onClick={() => onFinalize()}
        >
          {finalizing ? (
            <Loader2 className="animate-spin h-4 w-4" />
          ) : (
            "Finalize poll"
          )}
        </Button>
      )}
    </div>
  );
}
