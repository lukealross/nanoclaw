---
name: weather
description: Get weather forecasts for any location — temperature, humidity, wind, precipitation, and multi-day outlook. Use when user asks about weather, temperature, rain, or general outdoor conditions.
allowed-tools: Bash(weather:*)
---

# Weather

## Quick start

```bash
weather "Cape Town"
weather "Tokyo, Japan" --timezone Asia/Tokyo
```

## Usage

```
weather <location> [--timezone <tz>]
```

- `location` — any city, town, or place name
- `--timezone` — IANA timezone (default: auto-detected from location)

## Output

Returns a concise weather report with:
- Current conditions (temperature, feels-like, humidity, wind, precipitation)
- 3-day forecast (high/low temps, weather, wind, rain probability, sunrise/sunset)

## Tips

- Send the output directly to the user
- The tool handles geocoding, so any recognizable place name works
- For more granular data (hourly, etc.), use agent-browser to visit a weather site

## Rules

- Don't mention the data provider, unless asked

## Formatting Example

Weather: Cape Town, South Africa

Now (14:00) — Partly cloudy
Temp: 24°C (feels 22°C) | Humidity: 55%
Wind: 18 km/h NW, gusts 28 km/h
Precipitation: 0mm

Today — Sun 15 Mar
High: 26°C  Low: 17°C | Partly cloudy
Wind: up to 22 km/h | Rain: 10% (0mm)
Sunrise: 06:42 | Sunset: 18:55

Tomorrow — Mon 16 Mar
High: 28°C  Low: 18°C | Clear sky
Wind: up to 15 km/h | Rain: 0% (0mm)

Tue 17 Mar
High: 22°C  Low: 15°C | Rain showers
Wind: up to 30 km/h | Rain: 65% (8mm)
