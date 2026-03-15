---
name: surf-forecast
description: Get surf and wave forecasts for any coastal location — wave height, swell period/direction, and wind conditions. Use when user asks about surf, waves, ocean conditions, or beach weather.
allowed-tools: Bash(surf-forecast:*)
---

# Surf Forecast

## Quick start

```bash
surf-forecast "Muizenberg, Cape Town"
surf-forecast "Pipeline, Hawaii" --timezone Pacific/Honolulu
surf-forecast "Big Bay, Cape Town" --date 2026-03-20
```

## Usage

```
surf-forecast <location> [--timezone <tz>] [--date YYYY-MM-DD]
```

- `location` — any coastal town, beach, or surf spot name; include city if possible
- `--timezone` — IANA timezone (default: auto-detected from location)
- `--date` — specific date in YYYY-MM-DD format (up to 8 days ahead; returns every hour 07:00–18:00)

## Output

Without `--date`: current conditions + breakdown (every 2 hours, 06:00–18:00) for 8 days.
With `--date`: full hourly breakdown (every 2 hours, 06:00–18:00) for that single day.

Each interval includes a 1–5 condition rating (1=poor, 5=excellent) based on swell energy and wind conditions. Data also includes wave height, swell height/period/direction, wind speed/direction, and temperature.

## Tips

- The tool handles geocoding, so any recognizable place name works
- For spots not near the coast, the marine API may return limited data

## Rules

- Don't mention the data provider, unless asked
- If the user asks about a specific day (e.g. "how's the surf on Tuesday?"), use --date to get the full hourly breakdown for that day
- Present condition ratings exactly as given (N/5) — do not convert to any other scale
- Include the sea temperature if you have it. Just a single value or an average will suffice.
