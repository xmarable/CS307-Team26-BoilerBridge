// app/dashboard/loading.tsx
import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-amber-500" />
        <p className="text-xl font-black uppercase tracking-tighter text-gray-900">
          Loading...
        </p>
      </div>
    </div>
  );
}
