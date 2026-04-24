"use client"
import { Badge, Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets, Loader2, Snowflake, Sun, Wind } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type DayForecast = {
  date: string,
  code: number,
  label: string,
  high: number,
  low: number,
  precipitation: number,
  wind: number
};

function WeatherIcon({ label }: { label: string }) {
  if (label == "clear") return <Sun size={24} />;
  if (label == "cloudy") return <Cloud size={24} />;
  if (label == "fog") return <CloudFog size={24} />;
  if (label == "rain") return <CloudRain size={24} />;
  if (label == "snow") return <Snowflake size={24} />;
  if (label == "storms") return <CloudLightning size={24} />;
  return <CloudSun size={24} />;
}

export function ItinieraryWeather({ groupId }: { groupId: string }) {
  const [days, setDays] = useState<DayForecast[]>([]);
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getWeather() {
      const res = await fetch(`/api/groups/${groupId}/forecast`);

      if (!res.ok) {
        setLoading(false);
        return;
      }

      const data = await res.json();
      setDays(data.days);
      setCity(data.city);
      setLoading(false);
    }

    getWeather();
  }, [groupId]);

  return (
    <div className="space-y-8">
      <div className="bg-sky-50 rounded-4xl p-6 border border-sky-100">
        <div className="flex flex-items-center gap-2 mb-2 justify-content">
          <CloudSun size={15} />
          <h3 className="text-sm font-black text-sky-400 uppercase tracking-widest">
            Weather
          </h3>
        </div>

        <p className="text-2xl font-black text-gray-900 tracking-tight">
          10-Day Forecast
        </p>
        <div className="flex flex-l justify-between">
          <p className="text-sm font-bold text-gray-500 mt-1">
            {city || "Based on your trips destination"}
          </p>
          <p className="text-sm font-bold text-gray-500 mt-1 justify-right">
            From: <a className="underline" href="https://open-meteo.com/en/docs/geocoding-api" target="_blank">geocoding-api</a> and <a className="underline" href="https://open-meteo.com/" target="_blank">open-meteo</a>
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-sky-500" size={32} />
        </div>
      ) : days.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-200">
          <CloudSun className="mx-auto text-gray-300 mb-2" size={40} />
          <p className="text-gray-400 font-bold">
            No forecast found for this trip.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {days.map((d) => (
            <div key={d.date} className="group bg-white p-6 rounded-4xl border border-gray-100 shadow-sm hover:shadow-md hover:border-sky-200 transition-all relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-sky-500" />

              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xs font-black text-sky-600 uppercase tracking-widest">
                    {new Date(d.date).toLocaleDateString(undefined, {
                      weekday: "long",
                    })}
                  </p>
                  <h4 className="font-black text-gray-900 text-lg">
                    {new Date(d.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </h4>
                </div>

                <div className="p-3 bg-sky-50 rounded-2xl text-sky-600">
                  <WeatherIcon label={d.label} />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-3xl font-black text-gray-900">
                  {d.high}°
                  <span className="text-lg text-gray-400 font-bold">
                    {" "}
                    / {d.low}°
                  </span>
                </p>

                <Badge className="bg-gray-100 text-gray-600 font-bold border-none">
                  {d.label}
                </Badge>

                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <p className="text-xs font-bold text-gray-500 flex items-center gap-1">
                    <Droplets size={14} /> {d.precipitation}" rain
                  </p>

                  <p className="text-xs font-bold text-gray-500 flex items-center gap-1">
                    <Wind size={14} /> {d.wind} mph
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}