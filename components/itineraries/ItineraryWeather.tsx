"use client";
import {
  Badge,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Loader2,
  Snowflake,
  Sun,
  Wind,
} from "lucide-react";
import { useEffect, useState } from "react";

type DayForecast = {
  date: string;
  code: number;
  label: string;
  high: number;
  low: number;
  precipitation: number;
  wind: number;
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
      {/* top banner using surface tokens instead of sky-50 */}
      <div className="bg-bb-surface-subtle rounded-4xl p-6 border border-bb-border">
        <div className="flex items-center gap-2 mb-2">
          <CloudSun size={15} className="text-bb-brand" />
          <h3 className="text-sm font-black text-bb-brand uppercase tracking-widest">
            Weather
          </h3>
        </div>

        <p className="text-2xl font-black text-bb-text tracking-tight">
          10-Day Forecast
        </p>
        <div className="flex justify-between items-center">
          <p className="text-sm font-bold text-bb-text-muted mt-1">
            {city || "Based on your trips destination"}
          </p>
          <p className="text-[10px] font-bold text-bb-text-muted mt-1">
            From:{" "}
            <a
              className="underline hover:text-bb-brand"
              href="https://open-meteo.com/en/docs/geocoding-api"
              target="_blank"
            >
              geocoding-api
            </a>{" "}
            and{" "}
            <a
              className="underline hover:text-bb-brand"
              href="https://open-meteo.com/"
              target="_blank"
            >
              open-meteo
            </a>
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-bb-brand" size={32} />
        </div>
      ) : days.length === 0 ? (
        <div className="text-center py-12 bg-bb-surface-subtle rounded-[2.5rem] border-2 border-dashed border-bb-border">
          <CloudSun className="mx-auto text-bb-text-muted mb-2" size={40} />
          <p className="text-bb-text-muted font-bold">
            No forecast found for this trip.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {days.map((d) => (
            <div
              key={d.date}
              className="group bg-bb-surface p-6 rounded-4xl border border-bb-border shadow-sm hover:shadow-md hover:border-bb-brand transition-all relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-bb-brand" />

              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xs font-black text-bb-brand uppercase tracking-widest">
                    {new Date(d.date).toLocaleDateString(undefined, {
                      weekday: "long",
                    })}
                  </p>
                  <h4 className="font-black text-bb-text text-lg">
                    {new Date(d.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </h4>
                </div>

                <div className="p-3 bg-bb-surface-subtle rounded-2xl text-bb-brand">
                  <WeatherIcon label={d.label} />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-3xl font-black text-bb-text">
                  {d.high}°
                  <span className="text-lg text-bb-text-muted font-bold ml-1">
                    / {d.low}°
                  </span>
                </p>

                <div className="inline-flex items-center px-3 py-1 rounded-full bg-bb-surface-subtle border border-bb-border text-xs font-bold text-bb-text-muted uppercase tracking-wider">
                  {d.label}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-bb-border">
                  <p className="text-xs font-bold text-bb-text-muted flex items-center gap-1">
                    <Droplets size={14} className="text-sky-400" />{" "}
                    {d.precipitation}" rain
                  </p>

                  <p className="text-xs font-bold text-bb-text-muted flex items-center gap-1">
                    <Wind size={14} className="text-teal-400" /> {d.wind} mph
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
