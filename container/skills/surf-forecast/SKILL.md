---
name: surf-forecast
description: Get surf and wave forecasts for any coastal location — wave height, swell period/direction, wind conditions, tide state, and spot-specific condition ratings. Use when user asks about surf, waves, ocean conditions, or beach weather.
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

### With spot profile (known spots)

When the location matches a known spot profile (e.g. Muizenberg, Big Bay, Long Beach, Melkbosstrand), the output includes:
- **Spot header** — break type, coastline facing, best swell window, offshore wind direction
- **Swell window indicators** — `✓` (in window), `~` (marginal), `✗` (outside)
- **Wind type labels** — offshore, cross-off, cross-shore, cross-on, onshore
- **Tide state** — Rising/Falling + Low/Mid/High
- **Condition ratings** — 1–5 composite score (swell quality, swell direction, wind, tide)

### Without spot profile (unknown locations)

Raw data only — no condition ratings are shown. This avoids misleading ratings when spot-specific data (coastline facing, swell window, break type) is unavailable.

## Spot profiles

Pre-configured spots are in `spot-profiles.json`. Each spot has:
- `coastFacing` — compass bearing the beach faces toward the ocean
- `swellWindow` — swell directions that actually reach the spot
- `breakType` — beach, reef, or point (affects tide preferences)
- `optimalTide` — normalized 0-1 range for best conditions

## Tips

- The tool handles geocoding, so any recognizable place name works
- For spots not near the coast, the marine API may return limited data
- Use spot aliases (e.g. "muizies", "kom", "melkbos") — they match known profiles

## Rules

- Don't mention the data provider, unless asked
- If the user asks about a specific day (e.g. "how's the surf on Tuesday?"), use --date to get the full hourly breakdown for that day
- When summarizing, always mention **wind type** (offshore/onshore/etc.) and **swell window fit** — these are the most important factors
- If a spot has no profile, note that ratings are unavailable and present raw data

## Response format

Use these WhatsApp-friendly templates for all surf forecast responses.

### Rating emoji key (only for spots with profiles)

| Rating | Emoji | Label |
|--------|-------|-------|
| 5/5 | 🟢🟢 | Epic |
| 4/5 | 🟢 | Good |
| 3/5 | 🟡 | Fair |
| 2/5 | 🟠 | Poor |
| 1/5 | 🔴 | Flat/Bad |

### Single day format (when using `--date`)

**With spot profile:**
```
🏄 {Location} — {Day Date}
{Break type} facing {direction} | Offshore: {wind dir}

{2-3 sentences: overall vibe, best window, wind type pattern (offshore/onshore), swell window fit, tide influence}

{emoji} {time} — {wave}m, {swell}m@{period}s {swell_dir} {✓/~/✗}, {wind}km/h {wind_dir} ({wind_type}), {tide_state}
{emoji} {time} — ...
...

Sea temperature: {temp}°C
```

**Without spot profile:**
```
🏄 {Location} — {Day Date}

{2-3 sentences: general conditions, note that spot-specific ratings unavailable}

{time} — {wave}m, {swell}m@{period}s {swell_dir}, {wind}km/h {wind_dir}
{time} — ...
...

Sea temperature: {temp}°C
```

- Wave height (`wave_height`) is the displayed value, not swell height
- Summary before intervals gives context for scanning
- No pipe separators — comma-separated for compactness
- Only include intervals 06:00–18:00 (daylight); skip 20:00
- Rating shown as emoji only (no `/5` number) — only for profiled spots

### Multi-day format (no `--date`, 8-day outlook)

**With spot profile:**
```
🏄 {Location} — {n}-Day Outlook
{Break type} facing {direction} | Offshore: {wind dir}

{3-4 sentences: trend through the week, best days highlighted, wind type patterns, swell window fit}

{best_emoji} {Day Date} — {wave_range}m, {wind_type_summary} | {one-line description}
{best_emoji} {Day Date} — ...
...
```

**Without spot profile:**
```
🏄 {Location} — {n}-Day Outlook

{3-4 sentences: general trend, note that spot-specific ratings unavailable}

{Day Date} — {wave_range}m, {wind_summary} | {one-line description}
{Day Date} — ...
...
```

- Summary before day lines gives context for scanning
- One line per day with the day's peak rating emoji (profiled spots only)
- Wave range (e.g. "1.0–1.5m") gives the spread without hourly clutter
- One-line description captures the character: "Clean offshore AM, cross-on by noon", "Light winds all day", "Swell outside window — flat"
- Summary calls out the standout days explicitly
