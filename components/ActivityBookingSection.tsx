"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { BookingPlan, BookingPlanAction } from "@/lib/travel/bookingIntel";

function isTelUrl(url: string) {
  return url.trim().toLowerCase().startsWith("tel:");
}

function ExternalActionButton({
  action,
  variant = "outline",
  size = "default",
  className,
}: {
  action: BookingPlanAction;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm";
  className?: string;
}) {
  if (isTelUrl(action.url)) {
    return (
      <Button variant={variant} size={size} className={className} asChild>
        <a href={action.url}>{action.label}</a>
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} type="button" className={className}>
          {action.label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leaving BoilerBridge</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                You are opening an external site. BoilerBridge does not control
                third-party pages — review prices, fees, and cancellation terms
                before you book or pay.
              </p>
              <p className="font-mono text-xs break-all text-gray-600">{action.url}</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Stay here</AlertDialogCancel>
          <AlertDialogAction asChild>
            <a href={action.url} target="_blank" rel="noopener noreferrer">
              Continue in new tab
            </a>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ActivityBookingSection({ plan }: { plan: BookingPlan }) {
  return (
    <Card className="border-amber-200/80 shadow-sm bg-white">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-gray-900">
          Plan & book
        </CardTitle>
        <CardDescription className="text-gray-600">{plan.headline}</CardDescription>
        {plan.subline ? (
          <p className="text-sm text-gray-600 pt-1 leading-snug">{plan.subline}</p>
        ) : null}
        {plan.bookingNote ? (
          <p className="text-sm text-amber-950/90 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5 mt-2 leading-relaxed">
            {plan.bookingNote}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {plan.primary ? (
          <div className="flex flex-wrap gap-2">
            <ExternalActionButton
              action={plan.primary}
              variant="default"
              size="default"
              className="bg-amber-600 hover:bg-amber-700 text-white border-transparent shadow-sm"
            />
          </div>
        ) : null}

        {plan.secondaries.length > 0 ? (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              More actions
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              {plan.secondaries.map((a) => (
                <ExternalActionButton key={a.id} action={a} variant="outline" size="sm" />
              ))}
            </div>
          </div>
        ) : null}

        <p className="text-xs text-gray-500 flex items-start gap-2 leading-snug">
          <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
          External sites open in a new, secure tab. Phone opens your dialer.
        </p>
      </CardContent>
    </Card>
  );
}
