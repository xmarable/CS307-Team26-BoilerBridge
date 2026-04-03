/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState } from "react";
import {
  Search,
  Map as MapIcon,
  List,
  Navigation,
  Clock,
  DollarSign,
  Archive,
  Loader2,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StorageLocation {
  id: string;
  name: string;
  address: string;
  pricePerHour: string;
  hours: string;
  distance: string;
}

export default function DiscoverPage() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState("list");
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/discover?city=${query}`);
      const data = await res.json();
      setLocations(data.locations || data);
    } catch (err) {
      console.error("Search failure:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Header Section */}
      <div className="bg-white border-b border-gray-100 pt-16 pb-20 px-8">
        <div className="max-w-6xl mx-auto text-center space-y-6">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">
            Find Bag Storage
          </h1>
          <p className="text-gray-500 font-medium max-w-xl mx-auto">
            Verified lockers and shops to store your luggage safely so u can
            explore the city.
          </p>

          {/* Search Bar - Task 2 */}
          <div className="flex gap-3 max-w-2xl mx-auto mt-8">
            <div className="relative flex-1">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={20}
              />
              <Input
                placeholder="Search near me or enter a city..."
                className="pl-12 h-14 rounded-2xl border-gray-200 bg-white shadow-sm focus:ring-amber-500 text-black outline-none"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={loading}
              className="h-14 px-8 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold transition-all flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                "Search"
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="max-w-6xl mx-auto p-8 space-y-8">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">Results Near You</h2>

          <Tabs value={view} onValueChange={setView} className="w-56">
            <TabsList className="grid w-full grid-cols-2 rounded-xl bg-gray-200 p-1">
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
        </div>

        {/* storage detail cards - task 3 */}
        {locations.length > 0 ? (
          <div
            className={
              view === "list"
                ? "grid grid-cols-1 md:grid-cols-2 gap-6"
                : "h-125 bg-gray-200 rounded-3xl flex items-center justify-center border-2 border-dashed border-gray-300"
            }
          >
            {view === "list" ? (
              locations.map((loc) => (
                <Card
                  key={loc.id}
                  className="rounded-3xl border border-gray-100 bg-white hover:border-amber-200 transition-all hover:shadow-md overflow-hidden"
                >
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-black text-gray-900">
                          {loc.name}
                        </h3>
                        <p className="text-sm text-gray-500 font-medium">
                          {loc.address}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 bg-green-50 text-green-700 text-[10px] font-black px-2 py-1 rounded-full border border-green-100 uppercase tracking-tighter">
                        <ShieldCheck size={12} />
                        Verified
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6 py-4 border-y border-gray-50">
                      <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                        <DollarSign size={16} className="text-amber-500" />
                        <span>${loc.pricePerHour}/hr</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                        <Clock size={16} className="text-amber-500" />
                        <span>{loc.hours}</span>
                      </div>
                    </div>

                    <Button className="w-full h-12 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-bold transition-all">
                      <Navigation size={18} className="mr-2" /> Navigate
                    </Button>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center text-gray-400">
                <MapIcon size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-bold text-xl">Interactive Map View</p>
                <p className="text-sm">Click pins to view storage details</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-gray-200 shadow-sm">
            <Archive size={48} className="mx-auto text-gray-200 mb-4" />
            <h3 className="text-gray-900 font-black text-xl tracking-tight">
              No verified lockers found
            </h3>
            <p className="text-gray-500 font-medium max-w-xs mx-auto mt-1">
              Try searching for a different city or zoom out on the map.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
