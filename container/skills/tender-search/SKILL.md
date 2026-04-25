---
name: tender-search
description: Use the `tender-search` CLI to find and analyse UK public sector procurement opportunities — live tenders, planning notices, framework agreements, and historical contract awards. Trigger this skill whenever the user asks about UK tenders, procurement, public contracts, frameworks, buyers (NHS, local authorities, government departments, universities, framework operators like YPO), what opportunities are coming up, who has won similar work historically, or any question that involves searching the UK Find a Tender Service or Contracts Finder. Covers query-variation strategy, structured filters (stage, status, value range, deadlines, regions, CPV codes, buyer/supplier names, framework flag), and how to present results concisely.
allowed-tools: Bash(tender-search:*)
---

# tender-search

When the user asks about UK procurement opportunities — tenders, frameworks, contracts, planning notices, or who has historically won work — use the `tender-search` CLI.

## Quick start

```bash
tender-search search "cleaning services" "janitorial" --stage tender --limit 5
tender-search search "IT consulting" "digital transformation" --stage tender --status active --is-framework --min-value 500000 --deadline-before 2026-05-25
tender-search get --ocid ocds-h6vhtk-068aa0
tender-search get --ocid ocds-h6vhtk-068aa0 --include-history
```

Output is JSON to stdout.

## Workflow

1. **Parse intent.** Identify:
   - Sector / type of work (cleaning, IT consulting, construction, ...).
   - Buyer hints (any specific organisation, a category like "university" or "NHS trust", or a region).
   - Value range, if any.
   - Stage:
     - `planning` — early signal, contract not yet open. Useful for "what's coming up".
     - `tender` — live opportunity, suppliers can bid now.
     - `award` — historical, tells you who won what.

2. **Generate 2-5 query variations.** Use synonyms and adjacent industry terms so a single search captures the topic broadly. Pass them as positional arguments — the CLI runs them in parallel via Typesense `multi_search` and dedupes by procurement (ocid):
   ```bash
   tender-search search "cleaning services" "janitorial" "facilities cleaning" "hygiene services"
   ```

3. **Translate constraints into structured flags, not query words.** Use the flags below for stage, value range, dates, region, buyer/supplier name, CPV codes, framework flag.

   *"Find live framework agreements for IT consulting worth over £500k closing in the next month"* →
   ```bash
   tender-search search "IT consulting" "technology advisory" "digital transformation" \
     --stage tender --status active --is-framework \
     --min-value 500000 --deadline-before <14-30 days from today, ISO format>
   ```

4. **Present results concisely.** For each result, include:
   - **Title** — buyer
   - Stage / status, value (if known), currency
   - Deadline (if any) — flag if <14 days away
   - One line on why it matched
   - The `fts_url` so the user can open the full notice

5. **Offer follow-ups.** After listing results, suggest natural next steps:
   - *"Want me to fetch the full lot descriptions for any of these?"* → `tender-search get --ocid <ocid>`.
   - *"Want me to check planning notices for upcoming opportunities in this space?"* → re-run with `--stage planning`.
   - *"Want me to see what suppliers have won similar contracts historically?"* → re-run with `--stage award`.

## Output shape

`search`:
```
{
  "total_found": 47,
  "returned": 5,
  "results": [
    {
      "ocid": "ocds-h6vhtk-...", "title": "...", "buyer": "...",
      "stage": "tender", "status": "active", "is_framework": true,
      "value_amount": 750000, "currency": "GBP",
      "deadline_date": "2026-05-15T17:00:00.000Z",
      "regions": ["UKI"], "cpv_codes": ["72000000"],
      "fts_url": "https://www.find-tender.service.gov.uk/Notice/..."
    }
  ]
}
```

With `--include-facets`, an extra `facets` object is included with counts for stage, region, cpv_codes, buyer_type, etc.

`get` (default): a single document with full lot descriptions and parsed `tender_documents`.
`get --include-history --ocid <ocid>`: `{ ocid, release_count, releases: [...] }` covering planning + tender + amendments + award + cancellations.

## Filter cheatsheet

| Intent | Flag |
|---|---|
| Frameworks only | `--is-framework` |
| Live opportunities | `--stage tender --status active` |
| Closing soon | `--deadline-before <ISO date>` |
| Historical wins by a supplier | `--stage award --supplier-contains "<name>"` |
| Specific buyer | `--buyer-contains "<partial name>"` |
| Scotland | `--region UKM` (or finer: `--region UKM81 --region UKM82`) |
| London | `--region UKI` |
| IT/tech contracts | `--cpv 72000000` |
| Construction | `--cpv 45000000` |
| Cleaning | `--cpv 90910000` |
| Healthcare | `--cpv 85000000` |
| Public bodies only | `--buyer-type BODY_PUBLIC` |
| Government departments | `--buyer-type MINISTRY` |
| SME-suitable opportunities | `--suitable-for-sme` |
| VCSE-suitable opportunities | `--suitable-for-vcse` |
| Just live tender notices (skip pipelines / planning notices) | `--notice-type UK4` (or `--notice-type UK4 --notice-type F02` to include legacy) |
| Just contract award notices | `--notice-type UK6 --notice-type F03` |
| Dynamic Purchasing Systems | `--is-dps` |
| Above-threshold (full PCR/PA23 regime) only | `--above-threshold` |
| Specific framework reference (CCS, YPO, etc.) | `--buyer-reference RM6297` |
| Price-only contracts | `--award-criteria-type price` |
| Quality-weighted (MEAT) | `--award-criteria-type quality` |
| Two-stage procedures with EOI window | `--eoi-deadline-after <ISO>` |
| Frameworks expiring before a date | `--framework-end-before <ISO>` |
| Show every release of a procurement | `--include-history` (typically with `--ocid`) |
| Include facet counts (buyer/region/CPV breakdown) | `--include-facets` |

A known reference like `RM6297` can be used either as `--buyer-reference` (exact) or as a query word — both work, since the reference is included in the indexed `combined_text`.

Negate any boolean filter by prefixing with `--no-` (e.g. `--no-is-framework` to exclude frameworks).

## Tips

- For open-ended discovery ("what's out there in X?"), start broad and add `--include-facets` to see the distribution of buyers, regions, and CPV codes — then narrow.
- If a search returns 0 results (`"total_found": 0`), drop one filter at a time or broaden the query variations. Don't over-narrow on first attempt.
- Dates in flags are ISO 8601 (`2026-04-25` or `2026-04-25T00:00:00Z`). Output dates are also ISO.
- `value_amount` is the *estimated* tender value (planning/tender stages). `awarded_amount` is the *actual* signed contract value (award stage).
- At most 5 query variations per `search` call.
- Don't paste raw JSON to the user — extract the fields the user actually asked about and present them as a short list.
