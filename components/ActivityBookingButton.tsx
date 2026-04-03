"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export interface ActivityBookingButtonProps {
  /** US16: full https URL to external booking vendor; if missing, nothing is rendered */
  bookingUrl?: string | null;
  className?: string;
}

/**
 * US16: Opens booking in a new tab after confirming the user understands they leave the app.
 */
export function ActivityBookingButton({
  bookingUrl,
  className,
}: ActivityBookingButtonProps) {
  if (!bookingUrl?.trim()) {
    return null;
  }

  const url = bookingUrl.trim();

  const openExternal = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          className={`bg-amber-600 hover:bg-amber-700 text-white font-semibold ${className ?? ""}`}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Book now
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leaving BoilerBridge</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                You are about to open an external booking site in a new tab.
                BoilerBridge does not control that site; check prices and terms
                before you purchase.
              </p>
              <p className="font-mono text-xs break-all text-gray-600">{url}</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Stay here</AlertDialogCancel>
          <AlertDialogAction onClick={openExternal}>
            Continue to booking
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
