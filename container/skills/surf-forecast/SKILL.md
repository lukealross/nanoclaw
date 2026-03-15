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
- `--date` — specific date in YYYY-MM-DD format (up to 8 days ahead; returns every 2 hours, 06:00–18:00)

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

## Response format

Use these WhatsApp-friendly templates for all surf forecast responses.

### Rating emoji key

| Rating | Emoji | Label |
|--------|-------|-------|
| 5/5 | 🟢🟢 | Epic |
| 4/5 | 🟢 | Good |
| 3/5 | 🟡 | Fair |
| 2/5 | 🟠 | Poor |
| 1/5 | 🔴 | Flat |

### Single day format (when using `--date`)

```
🏄 *{Location}* — {Day Date}
🌊 Sea: {temp}°C

{emoji} {time} — {wave}m | {swell}m @ {period}s {swell_dir} | 💨 {wind} km/h {wind_dir}
{emoji} {time} — ...
...

📝 *Summary*
{2-3 sentences: overall vibe, best window, wind pattern, who it suits}
```

- Rating emoji leads each line — instant visual scan of when to go
- Pipe-separated data stays compact on mobile
- Wind emoji (💨) distinguishes wind from swell at a glance
- Only include intervals 06:00–18:00 (daylight); skip 20:00
- Bold the best window in the summary

### Multi-day format (no `--date`, 8-day outlook)

```
🏄 *{Location}* — {n}-Day Outlook

{best_emoji} *{Day Date}* — {wave_range}m | {swell_dir} {period}s | 🌊 {temp}°C | {one-line description}
{best_emoji} *{Day Date}* — ...
...

📝 *Outlook*
{3-4 sentences: trend through the week, best days highlighted, wind patterns}
```

- One line per day with the day's peak rating emoji
- Sea temp on each day line (may vary across the forecast window)
- Wave range (e.g. "1.0–1.5m") gives the spread without hourly clutter
- One-line description captures the character: "Clean early, SE onshore by noon", "Light winds all day ✨", "Choppy and blown out"
- Summary calls out the standout days explicitly
