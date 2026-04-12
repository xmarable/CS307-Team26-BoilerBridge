export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/dbConnect";
import TripModel from "@/models/Trip";
import User from "@/models/User";
import Link from "next/link";
import {
  Calendar,
  Wallet,
  Car,
  Plane,
  Train,
  Bus,
  ArrowRight,
  Settings2,
} from "lucide-react";
import { ItinerarySourcePublishControls } from "@/components/itineraries/ItinerarySourcePublishControls";

type Trip = {
  _id: string;
  fromCity: string;
  toCity: string;
  fromDate: string;
  toDate: string;
  mode: "flight" | "train" | "bus" | "taxi";
  budget: number;
  tripConfirmed: boolean;
  createdAt?: string;
  primaryItinerary?: unknown[];
};

// --- Your Original Helper Functions ---
function fmtDate(d: string) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function fmtMoney(n: number) {
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function Badge({ confirmed }: { confirmed: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider",
        confirmed
          ? "border-emerald-200 bg-emerald-50 text-emerald-600"
          : "border-amber-200 bg-amber-50 text-amber-600",
      ].join(" ")}
    >
      {confirmed ? "Confirmed" : "Pending"}
    </span>
  );
}

export default async function AllTripsPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) {
    redirect("/signin");
    return null;
  }

  await dbConnect();

  const user = await User.findOne({ email: session.user.email })
    .select("userId")
    .lean();
  if (!user) {
    redirect("/signin");
    return null;
  }

  // Fetch using UUID to match your User Schema
  const tripsRaw = await TripModel.find({
    userId: user.userId,
  })
    .sort({ createdAt: -1 })
    .lean();

  const trips = JSON.parse(JSON.stringify(tripsRaw)) as Trip[];
  const tripCountLabel = `${trips.length} trip${trips.length === 1 ? "" : "s"}`;

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">
            All Trips
          </h1>
          <p className="text-gray-500 mt-1">Your saved trips, newest first.</p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm font-bold text-gray-600 shadow-sm">
            {tripCountLabel}
          </span>
        </div>
      </div>

      {trips.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
          <p className="text-gray-400 font-bold text-lg">No trips found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {trips.map((t) => (
            <div
              key={t._id}
              className="group bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-amber-200 transition-all flex flex-col h-full relative"
            >
              <div className="flex items-start justify-between gap-3 mb-6">
                <div>
                  <div className="text-2xl font-black text-gray-900 tracking-tight">
                    {t.fromCity} <span className="text-gray-300 mx-1">→</span>{" "}
                    {t.toCity}
                  </div>
                  <div className="mt-1 text-sm font-bold text-gray-400 flex items-center gap-1.5">
                    <Calendar size={14} />
                    {fmtDate(t.fromDate)} — {fmtDate(t.toDate)}
                  </div>
                </div>

                <Badge confirmed={t.tripConfirmed} />
              </div>

              {/* Your original Mode/Budget Grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                    Mode
                  </div>
                  <div className="font-bold text-gray-700 capitalize flex items-center gap-2">
                    {t.mode === "flight" && <Plane size={16} />}
                    {t.mode === "train" && <Train size={16} />}
                    {t.mode === "bus" && <Bus size={16} />}
                    {t.mode === "taxi" && <Car size={16} />}
                    {t.mode}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                    Budget
                  </div>
                  <div className="font-bold text-amber-600 flex items-center gap-2">
                    <Wallet size={16} />
                    {fmtMoney(t.budget)}
                  </div>
                </div>
              </div>

              {t.createdAt && (
                <div className="mt-6 text-[10px] font-black text-gray-300 uppercase tracking-widest">
                  Created {fmtDate(t.createdAt)}
                </div>
              )}

              {/* Your original Edit Link logic */}
              <div className="mt-6 pt-6 border-t border-gray-50 space-y-4">
                <ItinerarySourcePublishControls
                  sourceType="trip"
                  sourceId={String(t._id)}
                  canPublish
                  hasItineraryContent={(t.primaryItinerary?.length ?? 0) > 0}
                />
                <div className="flex items-center justify-between">
                  <Link
                    href={`/dashboard/trip/${t._id}/edit`}
                    className="inline-flex items-center gap-2 text-sm font-black text-gray-400 hover:text-amber-600 transition-colors"
                  >
                    <Settings2 size={18} />
                    Edit preferences
                  </Link>
                  <div className="w-10 h-10 bg-gray-900 text-white rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight size={20} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
