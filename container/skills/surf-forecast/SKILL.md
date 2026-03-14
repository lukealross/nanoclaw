---
name: surf-forecast
description: Get surf and wave forecasts for any coastal location — wave height, swell period/direction, wind conditions, and best-time recommendations. Use when user asks about surf, waves, ocean conditions, or beach weather.
allowed-tools: Bash(surf-forecast:*)
---

# Surf Forecast

## Quick start

```bash
surf-forecast "Muizenberg, Cape Town"
surf-forecast "Pipeline, Hawaii" --timezone Pacific/Honolulu
```

## Usage

```
surf-forecast <location> [--timezone <tz>]
```

- `location` — any coastal town, beach, or surf spot name; include City if possible
- `--timezone` — IANA timezone (default: auto-detected from location)

## Output

Returns a WhatsApp-formatted surf report for the requested time period with:
- Primary surf conditions (wave height and wind) using meters (m) and kilometers per hour (kph)
- What times (in the day) are the low and high tides
- Best surfing window (limit to reasonable times; earliest 7am in summer, 8am in winter)

## Tips

- Send the output directly to the user
- The tool handles geocoding, so any recognizable place name works
- For spots not near the coast, the marine API may return limited data
- Scores factor in swell period, wave height, wind speed, and offshore/onshore wind direction

## Rules

- Don't mention the data provider, unless asked

## Formatting Example

Surf Forecast: Melkbosstrand — Sunday 15 Mar

Conditions
Waves: 1.1–1.5m | Swell: WSW/SW
Wind: Starts E offshore (5 km/h), turning onshore SW by afternoon (9–11 km/h)
Tides: Low 07:00 · High 13:00 · Low 19:00

Best Window
Early morning — light offshore E wind with 1.4–1.5m sets. Conditions soften as the day progresses and wind shifts onshore by midday.

Hourly snapshot
07:00  1.4m  9s SW  5 km/h E (offshore) <<<
09:00  1.3m  9s SW  4 km/h SE <<<
11:00  1.2m  9s WSW  5 km/h SSW <<<
13:00  1.2m  9s SW  8 km/h WSW <<
15:00  1.1m  8s SW  9 km/h WSW <<
17:00  1.1m  8s SW  8 km/h SSW <<

Worth being out early. Once that offshore turns around midday it's just punchy onshore slop.
