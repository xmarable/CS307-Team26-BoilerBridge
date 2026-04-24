import { authOptions } from "@/lib/auth";
import Trip from "@/models/Trip";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

function getWeatherText(code: number) {
    if (code == 0) return "clear";
    if ([1, 2, 3].includes(code)) return "cloudy";
    if ([45, 48].includes(code)) return "fog";
    if ([51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
    if ([95, 96, 99].includes(code)) return "storms";
    return "weather";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ groupId: string }>}) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.userId;
    const { groupId } = await params;

    const trip = await Trip.findOne({ groupID: groupId });
    if (!trip) {
        return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const city = encodeURIComponent(trip.toCity.trim());
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1`
    console.log(url);
    const location = await fetch(url);

    if (!location.ok) {
        return NextResponse.json({ error: "Failed to fetch weather" }, { status: 500 });
    }

    const data = await location.json();

    if (!data.results || data.results.length === 0) {
        return NextResponse.json({ error: "City not found" }, { status: 404 });
    }

    const latitude = data.results[0].latitude;
    const longitude = data.results[0].longitude;
    console.log(`latitude: ${latitude} | longitude: ${longitude}`);
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&temperature_unit=fahrenheit&wind_speed=mph&precipitation_unit=inch&timezone=auto&forecast_days=10`;
    console.log(weatherUrl);
    const weather = await fetch(weatherUrl,
        { next: { revalidate: 60*60 } }
    );

    if (!weather.ok) {
        return NextResponse.json({ error: "Failed to fetch weather" }, { status: 500 });
    }

    const forecast = await weather.json();
    const daily = forecast.daily;

    const days = daily.time.map((date: string, i: number) => ({
        date,
        code: daily.weather_code[i],
        label: getWeatherText(daily.weather_code[i]),
        high: Math.round(daily.temperature_2m_max[i]),
        low: Math.round(daily.temperature_2m_min[i]),
        precipitation: daily.precipitation_sum[i],
        wind: Math.round(daily.wind_speed_10m_max[i])
    }));

    return NextResponse.json({
        city: data.results[0].name,
        country: data.results[0].country,
        timezone: forecast.timezone,
        days
    }, { status: 200 });
}