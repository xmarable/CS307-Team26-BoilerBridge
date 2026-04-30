"use client";

import { useCallback, useRef, useState } from "react";
import {
  Search,
  Map as MapIcon,
  List,
  Navigation,
  Clock,
  Star,
  Archive,
  Loader2,
  ShieldCheck,
  MapPin,
  AlertCircle,
} from "lucide-react";
import {
  GoogleMap,
  InfoWindow,
  Marker,
  useJsApiLoader,
} from "@react-google-maps/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StorageLocation {
  id: string;
  name: string;
  address: string;
  rating?: number;
  reviewCount?: number;
  hours: string;
  distance: string;
  googleMapsUri?: string;
  verified: boolean;
  lat?: number;
  lng?: number;
}

export default function DiscoverPage() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState("list");
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    const city = query.trim();
    if (!city) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/discover?city=${encodeURIComponent(city)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setLocations(data.locations ?? []);
      setSearched(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Search failed");
      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  function openMaps(loc: StorageLocation) {
    const url =
      loc.googleMapsUri ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.address)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-white border-b border-gray-100 pt-16 pb-20 px-8">
        <div className="max-w-6xl mx-auto text-center space-y-6">
          <h1 className="text-4xl font-black text-bb-text tracking-tight">
            Find Bag Storage
          </h1>
          <p className="text-bb-text-muted font-medium max-w-xl mx-auto">
            Verified lockers and shops to store your luggage safely so you can
            explore the city.
          </p>

          <div className="flex gap-3 max-w-2xl mx-auto mt-8">
            <div className="relative flex-1">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-bb-text-muted"
                size={20}
              />
              <Input
                placeholder="Enter a city, e.g. Chicago..."
                className="pl-12 h-14 rounded-2xl border-bb-border bg-bb-surface shadow-sm focus:ring-amber-500 text-bb-text outline-none"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
              />
            </div>
            <Button
              onClick={() => void handleSearch()}
              disabled={loading || !query.trim()}
              className="h-14 px-8 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold transition-all flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                "Search"
              )}
            </Button>
          </div>

          {error && <p className="text-red-500 font-medium text-sm">{error}</p>}
        </div>
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto p-8 space-y-8">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-bb-text-sub">
            {searched
              ? `${locations.length} location${locations.length !== 1 ? "s" : ""} found near "${query}"`
              : "Results Near You"}
          </h2>

          {locations.length > 0 && (
            <Tabs value={view} onValueChange={setView} className="w-56">
              <TabsList className="grid w-full grid-cols-2 rounded-xl bg-bb-surface-subtle p-1">
                <TabsTrigger
                  value="list"
                  className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-amber-700 font-medium"
                >
                  <List size={16} className="mr-2" /> List
                </TabsTrigger>
                <TabsTrigger
                  value="map"
                  className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-amber-700 font-medium"
                >
                  <MapIcon size={16} className="mr-2" /> Map
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>

        {locations.length > 0 ? (
          view === "list" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {locations.map((loc) => (
                <Card
                  key={loc.id}
                  className="rounded-3xl border border-bb-border bg-bb-surface hover:border-amber-200 transition-all hover:shadow-md overflow-hidden"
                >
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-black text-bb-text">
                          {loc.name}
                        </h3>
                        <p className="text-sm text-bb-text-muted font-medium">
                          {loc.address}
                        </p>
                      </div>
                      {loc.verified && (
                        <div className="flex items-center gap-1 bg-green-50 text-green-700 text-[10px] font-black px-2 py-1 rounded-full border border-green-100 uppercase tracking-tighter shrink-0">
                          <ShieldCheck size={12} />
                          Verified
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-center gap-6 mb-6 py-4 border-y border-bb-border">
                      {loc.rating != null && (
                        <div className="flex items-center gap-1.5 text-sm font-bold text-gray-700">
                          <Star size={15} className="text-amber-500 shrink-0" />
                          <span>
                            {loc.rating.toFixed(1)}
                            {loc.reviewCount ? ` (${loc.reviewCount})` : ""}
                          </span>
                        </div>
                      )}
                      {loc.hours !== "Hours vary" && (
                        <div className="flex items-center gap-1.5 text-sm font-bold text-gray-700">
                          <Clock
                            size={15}
                            className="text-amber-500 shrink-0"
                          />
                          <span>{loc.hours}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-sm font-bold text-gray-700">
                        <MapPin size={15} className="text-amber-500 shrink-0" />
                        <span>{loc.distance}</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => openMaps(loc)}
                      className="w-full h-12 rounded-xl bg-bb-text hover:bg-bb-text/90 text-bb-surface font-bold transition-all"
                    >
                      <Navigation size={18} className="mr-2" /> Navigate
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <DiscoverMapView locations={locations} onNavigate={openMaps} />
          )
        ) : (
          <div className="text-center py-24 bg-bb-surface rounded-3xl border-2 border-dashed border-bb-border shadow-sm">
            <Archive size={48} className="mx-auto text-bb-text-muted mb-4" />
            <h3 className="text-bb-text font-black text-xl tracking-tight">
              {searched
                ? "No verified lockers found"
                : "Search for a city to find storage"}
            </h3>
            <p className="text-bb-text-muted font-medium max-w-xs mx-auto mt-1">
              {searched
                ? "Try searching for a different city."
                : "Enter a city name above and press Search."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DiscoverMapView({
  locations,
  onNavigate,
}: {
  locations: StorageLocation[];
  onNavigate: (loc: StorageLocation) => void;
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  });

  const [selected, setSelected] = useState<StorageLocation | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const mappable = locations.filter(
    (l) => typeof l.lat === "number" && typeof l.lng === "number",
  );

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      if (mappable.length === 0) return;
      const bounds = new google.maps.LatLngBounds();
      mappable.forEach((l) => bounds.extend({ lat: l.lat!, lng: l.lng! }));
      map.fitBounds(bounds, 60);
    },
    [mappable],
  );

  if (loadError) {
    return (
      <div className="flex items-center gap-2 rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <AlertCircle className="w-4 h-4 shrink-0" />
        Failed to load Google Maps. Check your API key.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-80 bg-bb-surface rounded-3xl border border-bb-border">
        <Loader2 className="animate-spin text-amber-500" size={28} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
      {/* Compact sidebar list */}
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {locations.map((loc, idx) => {
          const hasPinNum = mappable.findIndex((m) => m.id === loc.id);
          return (
            <div
              key={loc.id}
              onClick={() => {
                if (loc.lat != null && loc.lng != null) {
                  setSelected(loc);
                  mapRef.current?.panTo({ lat: loc.lat, lng: loc.lng });
                  mapRef.current?.setZoom(16);
                }
              }}
              className={`rounded-2xl border p-3 transition-all cursor-pointer ${
                selected?.id === loc.id
                  ? "border-amber-400 bg-amber-50 shadow-sm"
                  : "border-bb-border bg-bb-surface hover:border-amber-200"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                  {hasPinNum >= 0 ? hasPinNum + 1 : idx + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-bb-text truncate">
                    {loc.name}
                  </p>
                  <p className="text-xs text-bb-text-muted truncate">
                    {loc.address}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    {loc.rating != null && (
                      <span className="text-xs text-amber-600 font-semibold">
                        ★ {loc.rating.toFixed(1)}
                      </span>
                    )}
                    <span className="text-xs text-bb-text-muted">
                      {loc.distance}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Map */}
      <div
        className="rounded-3xl overflow-hidden border border-bb-border shadow-sm"
        style={{ height: 420 }}
      >
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          onLoad={onLoad}
          zoom={13}
          center={
            mappable[0]
              ? { lat: mappable[0].lat!, lng: mappable[0].lng! }
              : { lat: 40.4237, lng: -86.9212 }
          }
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
          }}
        >
          {mappable.map((loc, idx) => (
            <Marker
              key={loc.id}
              position={{ lat: loc.lat!, lng: loc.lng! }}
              label={{
                text: String(idx + 1),
                color: "#fff",
                fontWeight: "bold",
                fontSize: "12px",
              }}
              onClick={() => setSelected(loc)}
            />
          ))}

          {selected && selected.lat != null && selected.lng != null && (
            <InfoWindow
              position={{ lat: selected.lat, lng: selected.lng }}
              onCloseClick={() => setSelected(null)}
            >
              <div className="max-w-[200px] p-1 space-y-1">
                <p className="font-bold text-bb-text text-sm leading-tight">
                  {selected.name}
                </p>
                <p className="text-xs text-bb-text-muted">{selected.address}</p>
                {selected.rating != null && (
                  <p className="text-xs text-amber-600 font-semibold">
                    ★ {selected.rating.toFixed(1)}
                    {selected.reviewCount ? ` (${selected.reviewCount})` : ""}
                  </p>
                )}
                {selected.hours !== "Hours vary" && (
                  <p className="text-xs text-bb-text-muted">{selected.hours}</p>
                )}
                <p className="text-xs text-bb-text-muted">
                  {selected.distance}
                </p>
                <button
                  onClick={() => onNavigate(selected)}
                  className="mt-1 w-full text-xs font-bold text-bb-surface bg-bb-text hover:bg-bb-text/90 px-3 py-1.5 rounded-lg text-center transition-colors"
                >
                  Navigate
                </button>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>
    </div>
  );
}
