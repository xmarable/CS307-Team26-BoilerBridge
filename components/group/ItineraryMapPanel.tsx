"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Polyline,
  InfoWindow,
} from "@react-google-maps/api";
import { MapPin, Loader2, AlertCircle } from "lucide-react";

type CalendarEvent = {
  _id: string;
  title: string;
  location?: string;
  startTime: string;
  endTime: string;
  description?: string;
};

type MappedStop = CalendarEvent & {
  lat: number;
  lng: number;
};

type Props = {
  groupId: string;
};

const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };
const DEFAULT_CENTER = { lat: 40.4237, lng: -86.9212 };
const DEFAULT_ZOOM = 12;

export default function ItineraryMapPanel({ groupId }: Props) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  });

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [mappedStops, setMappedStops] = useState<MappedStop[]>([]);
  const [unmappable, setUnmappable] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selectedStop, setSelectedStop] = useState<MappedStop | null>(null);

  const mapRef = useRef<google.maps.Map | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);
      const res = await fetch(`/api/groups/${groupId}/itinerary`);
      if (!res.ok) throw new Error("Failed to load itinerary");
      const data = await res.json();
      const sorted: CalendarEvent[] = (Array.isArray(data) ? data : data.events ?? [])
        .sort((a: CalendarEvent, b: CalendarEvent) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );
      setEvents(sorted);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Geocode locations once Google Maps is loaded and events are fetched
  useEffect(() => {
    if (!isLoaded || events.length === 0) return;

    geocoderRef.current = new google.maps.Geocoder();
    const geocoder = geocoderRef.current;

    const eventsWithLocation = events.filter((e) => e.location?.trim());
    if (eventsWithLocation.length === 0) {
      setUnmappable(events);
      return;
    }

    setGeocoding(true);
    const mapped: MappedStop[] = [];
    const failed: CalendarEvent[] = [];

    let completed = 0;

    eventsWithLocation.forEach((event, idx) => {
      // Stagger requests slightly to avoid hitting Geocoder rate limit
      setTimeout(() => {
        geocoder.geocode({ address: event.location! }, (results, status) => {
          if (status === "OK" && results && results[0]) {
            const { lat, lng } = results[0].geometry.location;
            mapped.push({ ...event, lat: lat(), lng: lng() });
          } else {
            failed.push(event);
          }

          completed++;
          if (completed === eventsWithLocation.length) {
            // Sort mapped stops back into itinerary order
            mapped.sort(
              (a, b) =>
                new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
            );
            setMappedStops(mapped);
            setUnmappable([
              ...failed,
              ...events.filter((e) => !e.location?.trim()),
            ]);
            setGeocoding(false);
          }
        });
      }, idx * 200);
    });
  }, [isLoaded, events]);

  function panToStop(stop: MappedStop) {
    if (!mapRef.current) return;
    mapRef.current.panTo({ lat: stop.lat, lng: stop.lng });
    mapRef.current.setZoom(15);
    setSelectedStop(stop);
  }

  const polylinePath = mappedStops.map((s) => ({ lat: s.lat, lng: s.lng }));
  const mapCenter =
    mappedStops.length > 0
      ? { lat: mappedStops[0].lat, lng: mappedStops[0].lng }
      : DEFAULT_CENTER;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading itinerary…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <AlertCircle className="w-4 h-4 shrink-0" />
        Failed to load Google Maps. Check your API key.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MapPin className="w-5 h-5 text-amber-500" />
        <h3 className="text-lg font-semibold text-gray-800">Itinerary Map</h3>
        {geocoding && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            Locating stops…
          </span>
        )}
        {!geocoding && mappedStops.length > 0 && (
          <span className="text-xs text-gray-400">
            {mappedStops.length} stop{mappedStops.length !== 1 ? "s" : ""} mapped
          </span>
        )}
      </div>

      {err && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {err}
          <button onClick={() => setErr(null)} className="ml-auto text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
          <MapPin className="w-10 h-10 mb-3 text-gray-200" />
          <p className="text-sm font-medium">No itinerary events yet.</p>
          <p className="text-xs mt-1">Add events with a location in the Itinerary tab to see them here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          {/* Stop list */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {events.map((event, idx) => {
              const mapped = mappedStops.find((s) => s._id === event._id);
              const mapIdx = mappedStops.findIndex((s) => s._id === event._id);
              return (
                <div
                  key={event._id}
                  onClick={() => mapped && panToStop(mapped)}
                  className={`rounded-xl border p-3 transition-all ${
                    mapped ? "cursor-pointer" : "opacity-60 cursor-default"
                  } ${
                    selectedStop?._id === event._id
                      ? "border-amber-400 bg-amber-50 shadow-sm"
                      : "border-gray-100 bg-white hover:border-amber-200 hover:bg-amber-50/50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`flex-shrink-0 w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center mt-0.5 ${
                        mapped ? "bg-amber-500" : "bg-gray-300"
                      }`}
                    >
                      {mapped ? mapIdx + 1 : "–"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{event.title}</p>
                      {event.location ? (
                        <p className="text-xs text-gray-500 truncate">{event.location}</p>
                      ) : (
                        <p className="text-xs text-gray-300 italic">No location</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(event.startTime).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {event.location && !mapped && !geocoding && (
                        <p className="text-xs text-amber-500 mt-0.5">Could not locate</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {unmappable.length > 0 && !geocoding && (
              <p className="text-xs text-gray-400 px-1 pt-1">
                {unmappable.filter((u) => u.location).length} location
                {unmappable.filter((u) => u.location).length !== 1 ? "s" : ""} could not be geocoded.
              </p>
            )}
          </div>

          {/* Map */}
          <div
            className="rounded-2xl border border-gray-100 shadow-sm"
            style={{ height: 500 }}
          >
            {!isLoaded || geocoding ? (
              <div className="flex items-center justify-center h-full text-gray-400 bg-gray-50">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                {geocoding ? "Locating stops…" : "Loading map…"}
              </div>
            ) : mappedStops.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 bg-gray-50">
                <MapPin className="w-10 h-10 mb-3 text-gray-200" />
                <p className="text-sm font-medium">No stops could be mapped.</p>
                <p className="text-xs mt-1">Add a location to your itinerary events to see them here.</p>
              </div>
            ) : (
              <GoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
                center={mapCenter}
                zoom={DEFAULT_ZOOM}
                onLoad={(map) => { mapRef.current = map; }}
                options={{
                  streetViewControl: false,
                  mapTypeControl: false,
                  fullscreenControl: false,
                }}
              >
                {polylinePath.length > 1 && (
                  <Polyline
                    path={polylinePath}
                    options={{ strokeColor: "#f59e0b", strokeWeight: 3, strokeOpacity: 0.8 }}
                  />
                )}

                {mappedStops.map((stop, idx) => (
                  <Marker
                    key={stop._id}
                    position={{ lat: stop.lat, lng: stop.lng }}
                    label={{
                      text: String(idx + 1),
                      color: "#fff",
                      fontWeight: "bold",
                      fontSize: "12px",
                    }}
                    onClick={() => setSelectedStop(stop)}
                  />
                ))}

                {selectedStop && (
                  <InfoWindow
                    position={{ lat: selectedStop.lat, lng: selectedStop.lng }}
                    onCloseClick={() => setSelectedStop(null)}
                  >
                    <div className="max-w-xs">
                      <p className="font-bold text-gray-800 text-sm">{selectedStop.title}</p>
                      {selectedStop.location && (
                        <p className="text-xs text-gray-500 mt-0.5">{selectedStop.location}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(selectedStop.startTime).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {selectedStop.description && (
                        <p className="text-xs text-gray-500 mt-1 border-t pt-1">
                          {selectedStop.description}
                        </p>
                      )}
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
