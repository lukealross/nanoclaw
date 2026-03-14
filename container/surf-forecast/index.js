#!/usr/bin/env node

const BASE_GEO = "https://geocoding-api.open-meteo.com/v1/search";
const BASE_MARINE = "https://marine-api.open-meteo.com/v1/marine";
const BASE_WEATHER = "https://api.open-meteo.com/v1/forecast";

// --- Helpers ---

function parseArgs(argv) {
  const args = argv.slice(2);
  let location = "";
  let timezone = "auto";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--timezone" && args[i + 1]) {
      timezone = args[++i];
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`Usage: surf-forecast <location> [--timezone <tz>]

Examples:
  surf-forecast "Muizenberg, Cape Town"
  surf-forecast "Pipeline, Hawaii" --timezone Pacific/Honolulu
  surf-forecast "Jeffreys Bay"

Returns a WhatsApp-formatted surf forecast with hourly conditions,
scoring, and best-window recommendation.`);
      process.exit(0);
    } else {
      location += (location ? " " : "") + args[i];
    }
  }

  if (!location) {
    console.error("Error: Location required. Usage: surf-forecast <location>");
    process.exit(1);
  }

  return { location, timezone };
}

async function geocode(location) {
  const url = `${BASE_GEO}?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const data = await res.json();
  if (!data.results?.length) throw new Error(`Location not found: "${location}"`);
  const r = data.results[0];
  return {
    lat: r.latitude,
    lon: r.longitude,
    name: r.name,
    country: r.country,
    timezone: r.timezone,
  };
}

async function fetchMarine(lat, lon, timezone) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly: "wave_height,swell_wave_height,swell_wave_period,swell_wave_direction,wave_direction,sea_level_height_msl",
    timezone,
    forecast_days: "2",
  });
  const res = await fetch(`${BASE_MARINE}?${params}`);
  if (!res.ok) throw new Error(`Marine API failed: ${res.status}`);
  return res.json();
}

async function fetchWeather(lat, lon, timezone) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly: "wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    timezone,
    forecast_days: "2",
  });
  const res = await fetch(`${BASE_WEATHER}?${params}`);
  if (!res.ok) throw new Error(`Weather API failed: ${res.status}`);
  return res.json();
}

// --- Scoring ---

function compassDir(deg) {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function angleDiff(a, b) {
  let d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function scoreHour(swellHeight, swellPeriod, waveHeight, swellDir, windSpeed, windDir, windGusts) {
  let score = 50; // baseline

  // Swell period: longer = better
  if (swellPeriod >= 16) score += 25;
  else if (swellPeriod >= 12) score += 20;
  else if (swellPeriod >= 9) score += 10;
  else if (swellPeriod >= 6) score += 0;
  else score -= 15;

  // Wave height: sweet spot 0.5-2.5m
  if (waveHeight >= 0.5 && waveHeight <= 2.5) score += 15;
  else if (waveHeight > 2.5 && waveHeight <= 4) score += 5;
  else if (waveHeight < 0.5) score -= 10;
  else score -= 5; // very big

  // Wind speed: lighter = better
  if (windSpeed < 10) score += 20;
  else if (windSpeed < 15) score += 10;
  else if (windSpeed < 20) score += 0;
  else if (windSpeed < 30) score -= 10;
  else score -= 25;

  // Wind vs swell direction: offshore (opposite) = bonus, onshore (same) = penalty
  const diff = angleDiff(windDir, swellDir);
  if (diff >= 150) score += 15; // offshore
  else if (diff >= 120) score += 10; // cross-offshore
  else if (diff >= 60) score += 0; // cross-shore
  else if (diff >= 30) score -= 5; // cross-onshore
  else score -= 15; // onshore

  return Math.max(0, Math.min(100, score));
}

function scoreEmoji(score) {
  if (score >= 75) return "<<<";
  if (score >= 60) return "<<";
  if (score >= 45) return "<";
  return "";
}

// --- Tides ---

function findTides(times, seaLevels, dateKey) {
  // Get all 24 hours for this date (need full data, not just daylight)
  const dayIndices = [];
  for (let i = 0; i < times.length; i++) {
    if (times[i].startsWith(dateKey)) dayIndices.push(i);
  }
  if (dayIndices.length < 3) return [];

  const tides = [];
  for (let j = 1; j < dayIndices.length - 1; j++) {
    const i = dayIndices[j];
    const prev = seaLevels[i - 1];
    const curr = seaLevels[i];
    const next = seaLevels[i + 1];
    if (prev == null || curr == null || next == null) continue;

    if (curr > prev && curr > next) {
      tides.push({ time: times[i], level: curr, type: "High" });
    } else if (curr < prev && curr < next) {
      tides.push({ time: times[i], level: curr, type: "Low" });
    }
  }
  return tides;
}

// --- Formatting ---

function formatDate(isoStr) {
  const d = new Date(isoStr);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTime(isoStr) {
  return isoStr.slice(11, 16);
}

function isDaylight(isoStr) {
  const hour = parseInt(isoStr.slice(11, 13), 10);
  return hour >= 5 && hour <= 19;
}

function buildReport(geo, marine, weather) {
  const marineH = marine.hourly;
  const weatherH = weather.hourly;
  const times = marineH.time;

  // Build hourly data for daylight hours
  const hours = [];
  for (let i = 0; i < times.length; i++) {
    if (!isDaylight(times[i])) continue;

    const swellHeight = marineH.swell_wave_height[i] ?? 0;
    const swellPeriod = marineH.swell_wave_period[i] ?? 0;
    const swellDir = marineH.swell_wave_direction[i] ?? 0;
    const waveHeight = marineH.wave_height[i] ?? 0;
    const waveDir = marineH.wave_direction[i] ?? 0;
    const windSpeed = weatherH.wind_speed_10m[i] ?? 0;
    const windDir = weatherH.wind_direction_10m[i] ?? 0;
    const windGusts = weatherH.wind_gusts_10m[i] ?? 0;

    const score = scoreHour(swellHeight, swellPeriod, waveHeight, swellDir, windSpeed, windDir, windGusts);

    hours.push({
      time: times[i],
      waveHeight,
      swellHeight,
      swellPeriod,
      swellDir,
      waveDir,
      windSpeed,
      windDir,
      windGusts,
      score,
    });
  }

  if (!hours.length) return "No forecast data available for this location.";

  // Group by date
  const byDate = new Map();
  for (const h of hours) {
    const dateKey = h.time.slice(0, 10);
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey).push(h);
  }

  const lines = [];
  lines.push(`*Surf Forecast: ${geo.name}, ${geo.country}*`);

  for (const [dateKey, dayHours] of byDate) {
    lines.push(`${formatDate(dateKey + "T00:00")}`, "");

    // Find best hour for detail block
    const best = dayHours.reduce((a, b) => (a.score >= b.score ? a : b));

    lines.push(`*Conditions at ${formatTime(best.time)}*`);
    lines.push(
      `Waves: ${best.waveHeight.toFixed(1)}m | Swell: ${best.swellHeight.toFixed(1)}m @ ${Math.round(best.swellPeriod)}s from ${compassDir(best.swellDir)}`
    );

    const windType = angleDiff(best.windDir, best.swellDir) >= 120 ? "offshore" : angleDiff(best.windDir, best.swellDir) >= 60 ? "cross-shore" : "onshore";
    lines.push(
      `Wind: ${Math.round(best.windSpeed)} km/h ${compassDir(best.windDir)} (${windType}) | Gusts: ${Math.round(best.windGusts)} km/h`
    );

    // Tides
    const tides = findTides(marineH.time, marineH.sea_level_height_msl, dateKey);
    if (tides.length) {
      const tideStr = tides.map((t) => `${t.type} ${formatTime(t.time)}`).join(" · ");
      lines.push(`Tides: ${tideStr}`);
    }
    lines.push("");

    // Best window: consecutive hours with score >= 60
    const goodHours = dayHours.filter((h) => h.score >= 60);
    if (goodHours.length >= 2) {
      const start = formatTime(goodHours[0].time);
      const end = formatTime(goodHours[goodHours.length - 1].time);
      const swellDirStr = compassDir(goodHours[0].swellDir);
      const windDesc = goodHours[0].windSpeed < 10 ? "Light" : "Moderate";
      const windTypeDesc = angleDiff(goodHours[0].windDir, goodHours[0].swellDir) >= 120 ? "offshore" : "cross-shore";
      lines.push(`*Best Window*`);
      lines.push(`${start}-${end} — ${windDesc} ${windTypeDesc}, ${swellDirStr} swell`);
      lines.push("");
    } else if (goodHours.length === 1) {
      lines.push(`*Best Window*`);
      lines.push(`${formatTime(goodHours[0].time)} — best conditions`);
      lines.push("");
    }

    // Hourly table
    lines.push("*Hourly*");
    for (const h of dayHours) {
      const marker = scoreEmoji(h.score);
      lines.push(
        `${formatTime(h.time)}  ${h.waveHeight.toFixed(1)}m  ${Math.round(h.swellPeriod)}s ${compassDir(h.swellDir)}  ${Math.round(h.windSpeed)} km/h ${compassDir(h.windDir)} ${marker}`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

// --- Main ---

async function main() {
  const { location, timezone: tzArg } = parseArgs(process.argv);

  const geo = await geocode(location);
  const tz = tzArg === "auto" ? geo.timezone : tzArg;

  const [marine, weather] = await Promise.all([
    fetchMarine(geo.lat, geo.lon, tz),
    fetchWeather(geo.lat, geo.lon, tz),
  ]);

  console.log(buildReport(geo, marine, weather));
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
