"use client";

import { useEffect, useMemo, useState } from "react";
import { CloudRain, Sun } from "lucide-react";

function classifyWeatherCode(code) {
  const rainy = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95];
  return rainy.includes(Number(code)) ? "rainy" : "sunny";
}

export default function WeatherLoader() {
  const [visible, setVisible] = useState(true);
  const [city, setCity] = useState("your city");
  const [weatherType, setWeatherType] = useState("sunny");

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      if (mounted) setVisible(false);
    }, 2400);

    const detectWeather = async () => {
      try {
        const locRes = await fetch("https://ipapi.co/json/");
        if (!locRes.ok) return;
        const locData = await locRes.json();
        const detectedCity = String(locData?.city || "").trim();
        const latitude = Number(locData?.latitude);
        const longitude = Number(locData?.longitude);
        if (mounted && detectedCity) setCity(detectedCity);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(
            latitude
          )}&longitude=${encodeURIComponent(longitude)}&current=weather_code`,
          { cache: "no-store" }
        );
        if (!weatherRes.ok) return;
        const weatherData = await weatherRes.json();
        const code = weatherData?.current?.weather_code;
        if (mounted) setWeatherType(classifyWeatherCode(code));
      } catch (error) {
        // Keep default sunny animation.
      }
    };

    detectWeather();
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, []);

  const RainDrops = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, i) => (
        <span
          key={`drop-${i}`}
          className="weather-drop"
          style={{ left: `${(i * 13) % 100}%`, animationDelay: `${(i % 8) * 0.12}s` }}
        />
      )),
    []
  );

  if (!visible) return null;

  return (
    <div className="weather-loader-overlay">
      <div className="weather-loader-card">
        <p className="text-sm text-muted-foreground mb-2">Loading MoneyMind for {city}</p>
        {weatherType === "rainy" ? (
          <div className="weather-scene weather-rain">
            <CloudRain className="h-10 w-10 text-[#4B2E2B]" />
            <div className="weather-rain-layer">{RainDrops}</div>
            <p className="text-sm font-medium mt-2">Rainy vibes detected</p>
          </div>
        ) : (
          <div className="weather-scene weather-sun">
            <Sun className="h-10 w-10 text-[#C08552]" />
            <span className="weather-sun-glow" />
            <p className="text-sm font-medium mt-2">Sunny vibes detected</p>
          </div>
        )}
      </div>
    </div>
  );
}
