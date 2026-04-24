"use client"

import { Header } from "@/components/Header";
import { RainyDayToggle } from "@/components/RainyDayToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Calendar, SearchX, User } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation"
import { useEffect, useState } from "react";

type DetailResponse = {
  title,
  subtitle,
  snapshot: Record<string, unknown>;
};


export default function SharedItineraryPage() {
  const params = useParams();
  const [data, setData] = useState<DetailResponse | null>(null);

  const token = params?.token as string;

  const getData = async () => {
    const res = await fetch(`/api/itineraries/shared/${token}`);
    if (!res.ok) return;

    const data = await res.json();
    setData(data);
  };

  useEffect(() => {
    getData();
  }, [token]);

  if (!data) {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
      <div className="bg-white border border-gray-200 rounded-[2rem] p-10 shadow-sm flex flex-col items-center gap-4">
        <SearchX className="h-14 w-14 text-gray-400" />
        <h1 className="text-4xl font-black text-gray-900">
          Not Found
        </h1>
        <p className="text-gray-500 font-medium max-w-sm">
          This shared itinerary doesn’t exist or may have been removed.
        </p>
        <Link href="/">
          <Button className="mt-4 rounded-xl text-gray-300">
            {"<-- Go Back"}
          </Button>
        </Link>
      </div>
    </div>
  );
}

  const snap = data.snapshot;
  const primary = Array.isArray(snap?.primaryItinerary) ? snap.primaryItinerary : [];
  const rainy = snap?.rainyDayItinerary as [] | [];
  const groupEvents = snap?.groupEvents as
    | {
      title: string;
      description?: string;
      startTime: string;
      endTime: string;
      location?: string;
    }[]
    | undefined;

  const isTripLayout = true;

  return (
    <div className="pt-20 p-6 lg:p-10 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-black text-gray-900 tracking-tight">
          {data.title}
        </h1>
        {data.subtitle ? (
          <div className="mt-2 text-sm font-bold text-gray-400 flex items-center gap-2">
            <Calendar size={16} />
            {data.subtitle}
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm font-bold text-gray-500">
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-gray-500">
            Read-only
          </span>
        </div>
      </div>

      {isTripLayout && Array.isArray(primary) ? (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
          <RainyDayToggle
            trip={{
              primaryItinerary: primary,
              rainyDayItinerary: Array.isArray(rainy) ? rainy : [],
            }}
          />
        </div>
      ) : null}

      {!isTripLayout && Array.isArray(groupEvents) && groupEvents.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight px-1">
            Itinerary
          </h2>
          <ul className="space-y-3">
            {groupEvents.map((ev, i) => (
              <li key={`${ev.title}-${i}`}>
                <Card className="rounded-2xl border border-gray-100 shadow-sm">
                  <CardContent className="p-5">
                    <p className="font-bold text-gray-900">{ev.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(ev.startTime).toLocaleString()} —{" "}
                      {new Date(ev.endTime).toLocaleString()}
                    </p>
                    {ev.location ? (
                      <p className="text-sm text-gray-600 mt-2">{ev.location}</p>
                    ) : null}
                    {ev.description ? (
                      <p className="text-sm text-gray-500 mt-2">{ev.description}</p>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!isTripLayout && (!groupEvents || groupEvents.length === 0) ? (
        <p className="text-gray-500 text-sm">
          This shared itinerary has no displayable events in the saved snapshot.
        </p>
      ) : null}
    </div>
  );
}