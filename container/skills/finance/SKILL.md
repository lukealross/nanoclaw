---
name: finance
description: Use the `finance` CLI for personal-finance questions and bank-statement ingestion. Trigger this skill whenever the user asks about their spending, income, savings, budget, debit orders, transactions, transfers, fees, category breakdowns, or duplicate transactions — or drops a bank-statement CSV into chat (Discovery, Investec, or any ZAR bank export). Two-step ingest: `finance ingest <csv>` saves the bank's CSV verbatim to `raw/<bank>_<iso>.csv` (no classification, no questions, just an archive); `finance process` then re-parses every file in `raw/`, dedupes against the ledger, classifies, pairs transfers/refunds, and returns a review queue. Also covers monthly/yearly summaries, budget reconciliation (missing debit orders, amount changes, discretionary variance), flexible search across the ledger, agentic fuzzy-duplicate detection (catches re-imported rows where the bank rewrote the description), and per-group merchant learning when the user resolves flagged transactions.
allowed-tools: Bash(finance:*)
---

# finance

Personal-finance ledger CLI. The agent's job is to translate natural-language questions into one or more `finance` commands and present the JSON output as a WhatsApp-friendly summary. The CLI handles all deterministic logic — hashing, deduplication, transfer/refund pairing, classification, budget maths.

Per-group state lives in `/workspace/group/finance/`:
- `ledger.csv` — master merged ledger across all banks (cleaned, classified, paired)
- `budget.csv` — the user's monthly/annual/quarterly budget targets
- `merchants.local.json` — learned merchant overrides (auto-appended when user resolves a flagged txn)
- `processed_state.json` — tracks which raw files have already been folded into the ledger, so `finance process` can skip them on subsequent runs. Auto-maintained by `process` and `rebuild`; never edit by hand.
- `raw/<bank>_<iso>.csv` — verbatim copy of every bank CSV the user has ever sent, named with the bank prefix and ISO timestamp of the upload (e.g. `discovery_2026-04-28T20-10-33Z.csv`). Files accumulate over time; ordering is preserved by filename. Use these only to spot-check a question or rebuild from scratch — there's no row-level link to the ledger.

Global taxonomy lives at `/usr/local/share/finance/categories.md` (also visible in this skill dir). Edit it to add merchants or fix mismatches; then run `finance recategorise --all`.

## Quick start

```bash
finance ingest attachments/discovery-april.csv --bank Discovery   # stash only
finance ingest attachments/investec-april.csv --bank Investec     # stash only
finance process                          # categorise pending raw → ledger
finance review-batch < decisions.json    # primary tool for resolving review_queue
finance summary --month 2026-04 --group-by category
finance budget-check --month 2026-04
finance search --category Groceries --from 2026-01-01 --to 2026-04-30
finance review a3f9c1 --category Subscriptions --subcategory "Cloud/Tech" --learn
finance flagged
finance remove a3f9c1 b27d04          # only after the user confirms duplicate cleanup
```

All output is JSON to stdout. Errors go to stderr with exit 1.

## When to invoke

The flow is **two-step by design**: `ingest` only stashes the raw CSV; `process` is what categorises and appends to the ledger. This lets the user drop several CSVs (Investec on Monday, Discovery on Friday) and triage them in one batch.

- **User drops a CSV file into chat** → extract the `attachments/<file>.csv` path from the `[File: ...]` reference and call `finance ingest`. Pass `--bank` if the filename or context hints at one (otherwise the CLI auto-detects from CSV content). **Do NOT classify, ask review questions, or run `process` unless the user asks** — just confirm with a short ack ("Stashed 84 Investec txns. Say 'process' or send more CSVs first."). The ingest output reports the bank, parsed-row count, and total raw files on disk.
- **User asks to process / categorise / "go through them" / "let's do it"** → run `finance process`, then triage the `review_queue` agentically (see workflow below). `process` only handles raw files that aren't already in `processed_state.json`, so previously-reviewed work isn't disturbed. If everything is up to date the CLI prints a `message` saying so — relay that to the user instead of pretending you triaged anything. Auto-resolve everything you're confident about via `finance review-batch`, then ask the user only about the genuinely ambiguous remainder.
- **User asks to reprocess a specific file** ("reprocess the discovery one", "redo investec_2026-04-28..."): run `finance process --reprocess-file <name>`. Use this only when the user explicitly asks — never on your own initiative. For "redo everything", `--reprocess-all`. Both are safe (the ledger is dedup'd by `tx_id`) but they re-flag rows whose pattern matches changed since the last run, which can dirty work the user already reviewed.
- **User asks a "how much / what / when" question about money** → translate to `summary`, `search`, or `budget-check`. If raw files exist that haven't been processed yet (`processed_state.json` is the source of truth — check the `skipped` vs `processed` lists in a `finance process --dry-run`), mention it in passing.
- **User asks to find/remove/check for duplicates** ("any dupes?", "clean up duplicates", "did I double-import March?") → see "Workflow for duplicate detection" below. The agent does the comparison itself by reading `finance search` output — there is no `finance dedupe` command on purpose. **If the user doesn't specify a date range, ask before doing anything else.** Never call `finance remove` until the user confirms the specific candidates.

## Workflow for `finance process` — agentic auto-resolve

The CLI is deliberately conservative: it only classifies transactions when a `categories.md` pattern matches as a substring. That leaves things like `PICK AND PAY ROSEBANK 4521` flagged because `categories.md` has `PICK N PAY` but not the spelled-out variant. **You — the agent — are the bridge.** Use your knowledge of South African merchants and brand names to resolve the obvious cases without bothering the user.

The user-facing rule: **don't ask unless you're actually uncertain.** They want minutes, not hours, of back-and-forth.

### Step 1 — Process pending raw rows

```bash
finance process
```

Reads only the raw files not already in `processed_state.json`, classifies their rows, pairs transfers/refunds in a single pass (so cross-bank transfers pair correctly even when the two CSVs were stashed days apart), appends to the ledger, and returns the work-list. Headlines: `processed` (filenames folded in this run), `skipped` (files already done), `added`, `transfers_paired`, `refunds_paired`. `review_queue` is what to triage next.

If `processed: []` and the CLI returns a `message` saying everything is already processed, **don't** invent a triage step — tell the user there's nothing new and stop. They probably forgot they already processed the file, or want to ingest something first.

### Step 2 — Triage every review-queue item into one of two buckets

**Bucket A — Auto-resolve (you handle it, don't ask).** A SA-savvy reader could classify this in one glance.

Examples that go in Bucket A:
- Spelling/format variants of well-known SA retailers: `PICK AND PAY`, `P&P`, `PNP HYPER` → Groceries / Pick n Pay
- Major SA brands: `WOOLWORTHS DASH`, `WOOLIES FOOD` → Groceries / Woolworths Food
- Well-known fast food / casual dining: `NANDO'S MENLYN`, `KFC SANDTON`, `SPUR ROSEBANK`
- Telco / ISP names: `VODACOM`, `MTN AIRTIME`, `TELKOM MOBILE`, `RAIN`, `AFRIHOST`, `WEBAFRICA`, `VUMATEL`
- Unambiguous global brands: `AWS EMEA` → Subscriptions / Cloud-Tech, `NETFLIX.COM`, `OPENAI`, `GITHUB`, `JETBRAINS`, `FIGMA`, `NOTION`
- Insurer names: `OUTSURANCE PREMIUM`, `SANLAM DEBIT`, `KING PRICE`
- SA banks (when paired with debit-order context): `CAPITEC LOAN`, `FNB LIFE` → Insurance or appropriate
- Salary/income keywords: `SALARY`, `PAYROLL`, `WAGES`, `COMMISSION`, `INVOICE PAID`, `INTEREST CREDIT`
- Bank-fee keywords: `MONTHLY FEE`, `ATM FEE`, `OVERDRAFT INTEREST`
- Local SA grocery / food chains the agent recognises: `YEBO FRESH`, `OZE FRESH`, `UCOOK`, `DAILY DISH`
- Ride-hailing variants: `BOLT.EU`, `UBER ZA`
- Fuel: any of the major SA chains plus location codes (`SHELL N1 CITY`, `BP DURBAN`)
- Streaming/subs: `SHOWMAX`, `DSTV`, `SPOTIFY`, `APPLE.COM/BILL`, `STEAMGAMES`
- Pharmacy/health: `CLICKS`, `DIS-CHEM`, `MEDIRITE`, `LANCET LABS`, `PATHCARE`

**Bucket B — Ask the user.** Genuinely opaque or ambiguous.

Examples that go in Bucket B:
- Reference-only debits: `ONLINE PAYMENT REF 8821`, `PAYMENT 9921`, `INTERNET PAYMENT 4421`
- Personal-name credits/debits: `EFT FROM J SMITH`, `PAYMENT TO M JONES` (could be salary, refund, transfer between own accounts, or a person)
- Unknown small merchants the agent doesn't recognise: `KOMBUIS CAFE`, `STUDIO 88`, `XYZ TRADING CC`
- Foreign-currency one-offs the user might want to flag specifically
- Anything where the same description could plausibly be two different categories (e.g. `WOOLWORTHS HYDE PARK` could be Food or Fashion — ask)
- Large amounts (>R5 000) where you're not 90%+ certain — better to confirm

When in doubt, ask. The cost of one extra prompt is small; the cost of silently mis-categorising a R7k payment is annoying.

### Step 3 — Apply Bucket A in one batch

Pipe a JSON payload to `finance review-batch` via stdin. Group sibling rows under one `learn_pattern` so the next ingest auto-classifies them too.

```bash
finance review-batch <<'EOF'
{
  "decisions": [
    {"tx_id": "7909f2", "category": "Groceries", "subcategory": "Pick n Pay"},
    {"tx_id": "0253a3", "category": "Groceries", "subcategory": "Yebo Fresh"},
    {"tx_id": "d3a5b0", "category": "Health",    "subcategory": "Gym"},
    {"tx_id": "ff719d", "category": "Utilities", "subcategory": "Vodacom"}
  ],
  "learn_patterns": [
    {"pattern": "PICK AND PAY", "category": "Groceries",    "subcategory": "Pick n Pay"},
    {"pattern": "YEBO FRESH",   "category": "Groceries",    "subcategory": "Yebo Fresh"},
    {"pattern": "VODACOM",      "category": "Utilities",    "subcategory": "Vodacom"}
  ]
}
EOF
```

Output:
```json
{ "updated": 4, "not_found": [], "learned": 3, "swept": 1 }
```

- `updated` — rows you specifically resolved
- `learned` — new entries appended to `merchants.local.json`
- `swept` — sibling rows that were also flagged and now auto-classified by the new patterns. **This is the magic** — one decision can resolve many rows.

**Tips for building the payload**:
- Use the shortest unambiguous substring as the `pattern`. `PICK AND PAY` not `PICK AND PAY ROSEBANK 4521` — the latter only matches one specific store.
- One decision per row, but one learn_pattern per merchant. If you resolve 5 PICK AND PAY rows, the decisions array has 5 entries but `learn_patterns` only needs `PICK AND PAY` once.
- Always include a `learn_pattern` if the merchant could appear again. Skip it for genuine one-offs (a refund from a specific person, a holiday rental).
- Subcategory names don't need to exist in `categories.md` — the CLI accepts whatever you write. Keep them consistent with existing taxonomy where possible.

### Step 4 — Ask the user about Bucket B (one batched message)

```
Auto-classified 12 transactions ✓ (Pick n Pay ×4, Yebo Fresh ×1, GymCo, Vodacom ×2, AWS, ...)

2 transactions need your input:

1. R1 250 — "ONLINE PAYMENT REF 8821" (Investec, 12 Apr)
   What was this? Or should I just leave it as Uncategorised Expense?

2. R5 000 credit — "EFT FROM J SMITH" (Discovery, 15 Apr)
   Income, refund, or transfer between your own accounts?
```

- Lead with what you already handled (builds trust, shows the agent did real work).
- Ask only the items genuinely unclear. Group them by question type if helpful.
- Offer "leave as Uncategorised" as an explicit option — saves the user from feeling forced to make up a category.

### Step 5 — Apply the user's answers

Use `finance review-batch` again with their answers, or `finance review <tx_id> --learn` for a single fix.

### Step 6 — Auto-run a duplicate-detection sweep

Before wrapping up, scan the rows just added for fuzzy duplicates. Use `min(date)` to `max(date)` of the new rows (look at the dates in `review_queue` plus what was added — the dates of the raw files give you the bounds even if `review_queue` is empty). Follow the "Workflow for duplicate detection" section below. **Only flag candidates; never `finance remove` without explicit confirmation.** If nothing looks duplicated, say nothing — don't manufacture noise.

### Step 7 — Wrap up

Run `finance summary --month <current>` and present the result with the templates below.

## When to fall back to single `finance review`

- Only one or two items to fix and it's a quick correction.
- User explicitly says "no, that one was actually X" — apply with `finance review <tx_id> --category X --subcategory Y --learn` and confirm in one line.

For anything more, use `review-batch` — it's cheaper and the auto-sweep is valuable.

## Workflow for duplicate detection

The ledger's `tx_id` (SHA-256 of `date|description_raw|amount|bank`) catches byte-identical re-imports — but banks sometimes rewrite descriptions on later exports (extra spaces, a different reference suffix, "PICK N PAY" → "PICK AND PAY ROSEBANK 4521"). When that happens, the same real-world transaction lands in the ledger twice with different `tx_id`s. The agent's job is to find these by *reading* the ledger and reasoning over the descriptions — there is no `finance dedupe` command, on purpose.

### Step 1 — Lock down the date range

**This is non-negotiable: never sweep without a range.** A full-ledger sweep is slow and noisy.

- **User-initiated** ("find duplicates", "clean up dupes"): if they didn't name a range, ask before doing anything else. Offer concrete options: "Which range — last month, last 3 months, year-to-date, or all-time?"
- **Auto-trigger after `process`**: use the date span of rows just added (`min`/`max` from `review_queue` and the raw filenames you just folded in).

### Step 2 — Pull the candidate window

```bash
finance search --from <start> --to <end> --limit 5000
```

The default `--limit 50` is far too low for a dedup sweep. Use a high limit so nothing is silently truncated. If the range really is huge and 5000 isn't enough, narrow the range and run twice — don't run a sweep on truncated output.

### Step 3 — Group and reason

Group the rows by `(date, amount)`. Singletons are not candidates — discard them. For each group with ≥2 rows, look at `description_raw` and `description_clean`:

- **Same bank, same date, same amount, descriptions look like the same merchant with cosmetic differences** → likely duplicate. Examples:
  - `PICK N PAY ROSEBANK` vs `PICK AND PAY ROSEBANK 4521`
  - `WOOLWORTHS HYDE PARK` vs `WOOLWORTHS HYDE PARK 102` (extra trailing reference)
  - `VODACOM AIRTIME` vs `VODACOM AIRTIME RECHARGE`
- **Different banks, same date, same amount** → almost certainly a transfer between accounts, not a duplicate. If both rows have an empty `transfer_pair_id`, mention it as a potential unpaired transfer; otherwise skip silently.
- **Same bank, same date, same amount, descriptions identical** → a real duplicate that slipped past `tx_id` dedup (rare; flag it).
- **Same date, same amount, descriptions look like genuinely different merchants** that just happened to charge the same amount on the same day → not a duplicate. Skip.

Be conservative. False positives waste the user's time more than false negatives — a missed dupe shows up next sweep.

### Step 4 — Flag candidates to the user (don't act)

Present each candidate group as a numbered entry showing both rows side-by-side, with a recommendation on which to keep. Default recommendation: **keep the older `tx_id`** (the original ingest, before the bank rewrote the description). Be explicit about which `tx_id` you're proposing to remove.

```
Found 2 likely duplicates in April 2026:

1. R185.50 on 2026-04-15 (Discovery)
   • PICK N PAY ROSEBANK         tx aaaaaa  ← keep (older)
   • PICK AND PAY ROSEBANK 4521  tx bbbbbb  ← remove?

2. R99.00 on 2026-04-16 (Investec)
   • VODACOM AIRTIME            tx ccc111   ← keep
   • VODACOM AIRTIME RECHARGE   tx ddd222   ← remove?

Confirm and I'll remove them, or tell me which ones to keep.
```

### Step 5 — Remove only after explicit confirmation

Once the user confirms, batch the removals into a single call:

```bash
finance remove bbbbbb ddd222
```

Output:
```json
{
  "removed": [...],
  "not_found": [],
  "orphaned_pairs": [{ "tx_id": "...", "broken": "transfer_pair_id" }],
  "dry_run": false
}
```

If `orphaned_pairs` is non-empty, surface it to the user — it means a removed row was paired with a transfer or refund and the partner row's link was cleared. Usually fine, but worth noting: "FYI — tx eeeeee was paired with the transfer I removed, so I cleared its `transfer_pair_id`."

If the user says "leave them as-is", drop it and don't re-flag the same pair in this conversation.

## Subcommands

### `ingest <csv-path> [--bank Investec|Discovery] [--dry-run]`

**Verbatim copy only — does not classify, does not touch `ledger.csv`.** Saves the bank's CSV byte-for-byte to `raw/<bank>_<iso>.csv`, where `<iso>` is the upload time in UTC (`2026-04-28T20-10-33Z`). One file per ingest — they accumulate, sorted by filename. Bank comes from `--bank` if given, else auto-detected from CSV content, else `unknown`.

Re-uploading the same file is allowed (saves a separate raw file with a fresh timestamp) — `process` deduplicates at the ledger level via `tx_id`, so duplicates have no effect on the ledger.

Output:
```json
{
  "bank": "Discovery",
  "csv_path": "attachments/discovery-april.csv",
  "saved_as": "/workspace/group/finance/raw/discovery_2026-04-28T20-10-33Z.csv",
  "parsed": 84,
  "parse_error": null,
  "raw_files_total": 5,
  "dry_run": false
}
```

If `parse_error` is non-null the file was still saved, but the agent should warn the user and may want to re-ingest with an explicit `--bank`.

### `process [--dry-run] [--reprocess-file <name>] [--reprocess-all]`

Folds **only the raw files not already in `processed_state.json`** into the ledger: parses them, dedupes against the existing ledger by `tx_id` (SHA-256 of `date|description|amount|bank`), classifies new rows via `categories.md` + `merchants.local.json`, pairs transfers (±R20, ±2 days, across all banks) and refunds (within 6 months, ≤ original amount), appends to the ledger, and records each successfully-processed filename in `processed_state.json` so the next run skips it. Returns the `review_queue` for the agent to triage.

**Override flags** — use only when the user explicitly asks:
- `--reprocess-file <name>` — re-fold a single named raw file (basename or full path) regardless of state. Useful if the previous run errored or the user wants a specific file's pattern matches re-evaluated.
- `--reprocess-all` — re-fold every raw file in `raw/`. Safe against the ledger (tx_id dedup) but slow on large archives, and may re-flag rows the user already triaged. Prefer `recategorise --all` if the goal is just refreshing classifications, or `rebuild` for a true from-scratch ledger.

If there's nothing new to process, the CLI exits 0 with `processed: []`, `skipped: [<all files>]`, and a `message` field — no pipeline work is done, no files are written.

Files that fail to parse are reported in `parse_errors` and **not** marked processed, so the next run retries them.

Output:
```json
{
  "processed": ["investec_2026-04-28T20-11-12Z.csv"],
  "skipped":   ["discovery_2026-04-28T20-10-33Z.csv"],
  "files":     { "investec_2026-04-28T20-11-12Z.csv": 42 },
  "banks":     { "Investec": 42 },
  "raw_parsed": 42,
  "added": 42,
  "transfers_paired": 1,
  "refunds_paired": 0,
  "review_queue": [
    { "tx_id": "a3f9c1234567", "date": "2026-04-14", "description_raw": "ONLINE PAYMENT REF 8821",
      "amount": -1250.00, "bank": "Investec", "tx_type": "expense",
      "confidence": "low", "suggested_category": null,
      "reason": "No matching merchant pattern" }
  ],
  "parse_errors": [],
  "dry_run": false
}
```

Backward compat: groups upgrading from before `processed_state.json` existed will, on their first `process` run, treat every raw file on disk as unprocessed and fold them all in one pass. The ledger's `tx_id` dedup makes this a no-op on rows already there, and the state file is populated as a side effect — subsequent runs skip everything until new files are ingested.

### `review <tx_id> --category <cat> [--subcategory <sub>] [--learn]`

Apply a single user correction. `--learn` writes the `description_clean → category/subcategory` mapping to `merchants.local.json` so future txns with that pattern auto-match with high confidence. Always pass `--learn` unless the user is doing a one-off override that shouldn't generalise.

### `review-batch` (reads JSON from stdin)

Apply many decisions in one ledger rewrite, optionally append several learned patterns, and auto-sweep any remaining flagged rows that the new patterns now classify. **This is the primary tool for triaging the `review_queue` after `finance process`.** See "Workflow for `finance process`" above.

Stdin payload shape:
```json
{
  "decisions": [
    { "tx_id": "abc123", "category": "Groceries", "subcategory": "Pick n Pay" }
  ],
  "learn_patterns": [
    { "pattern": "PICK AND PAY", "category": "Groceries", "subcategory": "Pick n Pay" }
  ]
}
```

Output: `{ updated, not_found: [...], learned, swept }`. `swept` is the count of previously-flagged rows that auto-classified after the new patterns were added — often higher than `updated` for a fresh first ingest.

### `remove <tx_id> [<tx_id>...] [--dry-run]`

Delete one or more rows from `ledger.csv` by `tx_id`. **Use only after the user has explicitly confirmed which `tx_id`s to drop** (see "Workflow for duplicate detection"). If a removed row was paired with a transfer or refund, the partner's `transfer_pair_id` / `refund_pair_id` is cleared automatically and reported in `orphaned_pairs`. Unknown `tx_id`s are reported in `not_found` rather than failing.

Output:
```json
{
  "removed": [
    { "tx_id": "bbbbbb222222", "date": "2026-04-15", "amount": "-185.50",
      "description_raw": "PICK AND PAY ROSEBANK 4521", "bank": "Discovery" }
  ],
  "not_found": [],
  "orphaned_pairs": [{ "tx_id": "eeeeee", "broken": "transfer_pair_id" }],
  "dry_run": false
}
```

`--dry-run` reports what *would* be removed without touching the ledger — useful when surfacing a final "about to remove these N rows, ok?" beat.

### `summary [--month YYYY-MM | --year YYYY | --from D --to D] [--group-by category|subcategory|merchant|bank] [--include-transfers] [--refunds-as-income]`

Period totals + grouped breakdown. Default period is current calendar month. Default group-by is `category`. Transfers are excluded by default (per spec: they're not real spend). Refunds reduce category net spend by default; pass `--refunds-as-income` to count them as income instead.

Output (truncated):
```json
{
  "period": "2026-04", "start": "2026-04-01", "end": "2026-04-30",
  "group_by": "category",
  "income_total": 65000, "expense_total": -38420, "fees_total": -85, "net": 26580,
  "groups": [
    { "key": "Groceries", "total": -5210, "count": 14, "budget": -5000, "variance": -210 },
    { "key": "Transport", "total": -2890, "count": 22, "budget": -3500, "variance": 610 }
  ],
  "transfers_excluded": 4,
  "transactions_counted": 138
}
```

### `search [--category X] [--subcategory Y] [--merchant M] [--min N] [--max N] [--from D] [--to D] [--text "kw"] [--bank X] [--flagged] [--limit N]`

List rows matching all provided filters. `--merchant M` does substring match on `description_clean`. `--text` does substring across both raw and clean descriptions. Returns most-recent-first, default limit 50.

### `budget-check [--month YYYY-MM]`

Compares the period's actuals against `budget.csv`:
- `missing_debit_orders` — `debit_order` / `scheduled` budget rows with no matching txn this period
- `amount_changed` — debit-order txns where actual differs from expected by >5%
- `unexpected_recurring` — debits with debit-order-like keywords whose category isn't in the budget
- `discretionary_variance` — budgeted discretionary categories (over or under, not flagged either way)

### `flagged`

Lists every row with `flagged_for_review = true` or confidence < high. Use to review unresolved items in bulk.

### `recategorise [--all | --tx-id <id>]`

Re-runs the classifier across some/all rows after editing `categories.md` or after the `merchants.local.json` has grown. Skips paired transfers (their category is locked).

### `rebuild [--dry-run]`

**Wipes `ledger.csv` and rebuilds it from scratch by re-parsing every file in `raw/`.** Replays the full pipeline: classify → infer tx_type → pair transfers → pair refunds. Also overwrites `processed_state.json` so every successfully-parsed raw file is marked processed at the rebuild timestamp — `finance process` will skip them all on the next run. Use this after a classifier change, refund-pairing fix, or any logic change that affects the entire dataset — not just classifications.

**Caveats:**
- **Manual review decisions are lost.** Any `finance review` / `review-batch` corrections that overrode classifier output get redone from scratch. Learned patterns in `merchants.local.json` survive (they're applied during classification), so single user corrections that included `--learn` will re-apply correctly. Single corrections without `--learn` won't.
- **Always confirm with the user first** if their ledger has had manual reviews. Run `--dry-run` to preview counts before committing.
- Refuses to run if `raw/` is empty or missing — protects against accidental wipe.

When in doubt, prefer `recategorise --all` for category-only refreshes; reach for `rebuild` only when the full pipeline needs to re-run.

Output:
```json
{
  "files": { "discovery_2026-04-28T20-10-33Z.csv": 84, "investec_2026-04-28T20-11-12Z.csv": 102 },
  "banks": { "Discovery": 84, "Investec": 102 },
  "raw_parsed": 186,
  "ledger_rows": 184,
  "transfers_paired": 7,
  "refunds_paired": 2,
  "flagged": 12,
  "parse_errors": [],
  "dry_run": false
}
```

## WhatsApp-friendly response templates

Keep it scannable. Use ZAR formatting with thousands separators. `R1 245`, not `R1245.00` — drop the cents in summary output unless precision matters.

### Summary response (single month)

```
💰 April 2026 — net R26 580

In: R65 000 (Salary) | Out: R38 420 | Fees: R85

Top spend
🛒 Groceries — R5 210 (over R5 000 by R210)
🍴 Dining — R2 380 (over R2 000 by R380)
🚗 Transport — R2 890 (under R3 500 by R610)
🏥 Health — R1 940
🎬 Entertainment — R820

4 transfers excluded. 138 txns.
```

- One emoji per category line keeps it visually scannable.
- Show variance only when budget is set for that category.
- If under budget, say "under" not "saved" (budget is advisory, not target).

### Summary response (multi-month / year)

```
💰 2026 YTD (Jan–Apr) — net R104 200

In: R260 000 | Out: R155 800

Trending up vs prior 4 months
↗ Dining — R8 920 (avg R2 230/mo, +18%)
↗ Subscriptions — R3 410 (avg R853/mo, +24%)

Trending down
↘ Transport — R10 480 (avg R2 620/mo, −9%)
```

(Run two `summary` calls if you need the comparison — one for the period, one for the prior comparable window.)

### Search response

```
Uber trips in March 2026 — 14 trips, R1 280 total

03 Mar — R85 (trip JHBCBD)
05 Mar — R142 (trip Sandton)
...

Average R91/trip. Most expensive: R220 on 22 Mar.
```

For long lists (>15 rows), summarise count + total + a few examples; offer "want me to list them all?".

### Budget-check response

```
April budget check ⚠

Missing debit orders
✗ Discovery Health (expected R4 200) — not seen this month

Amount changes
⚠ DStv — expected R949, charged R1 049 (+10.5%) on 03 Apr

Unexpected recurring
? GymCo — R399 on 01 Apr. Not in your budget. Add it?

Discretionary
🟢 Transport — R2 890 of R3 500 (under by R610)
🟡 Dining — R2 380 of R2 000 (over by R380)
🟢 Groceries — R5 210 of R5 000 (over by R210, within 5%)
```

- Lead with the must-action items (missing, changed). Discretionary variance goes last.
- 🟢 / 🟡 / 🔴 = under / slightly over / >20% over.

### Review queue prompt

```
3 transactions need your input:

1. R1 250 — "ONLINE PAYMENT REF 8821" (Investec, 14 Apr)
   Expense or income? If expense, which category?

2. R89 — "AWS EMEA" (Discovery, 18 Apr)
   Subscriptions → Cloud/Tech? Or Business Expense?

3. R450 credit — "EFT FROM J SMITH" (Discovery, 20 Apr)
   Income or transfer?
```

When the user replies, run `finance review <tx_id> --category X --subcategory Y --learn` and confirm: "✓ Logged AWS EMEA as Subscriptions / Cloud/Tech. Future AWS charges will auto-classify."

## Rules

- **Auto-resolve obvious cases without asking.** Use your knowledge of SA merchants. The user wants minutes, not a quiz. Only ask when genuinely uncertain (Bucket B above).
- **Always include a `learn_pattern`** when you batch-resolve a recognisable merchant — that's what makes future ingests instant. Skip it only for genuine one-offs.
- **For first ingests of large back-catalogues** (multiple months), do a single `finance review-batch` with everything you can resolve, then ask the user about whatever's left. Don't drip-feed prompts.
- **Always exclude transfers from spend/income totals** unless the user explicitly asks "what did I move between accounts?". The CLI does this by default — don't pass `--include-transfers` unless asked.
- **Refunds reduce category net spend, not income.** Default behaviour is correct; don't pass `--refunds-as-income` unless the user specifically asks.
- **Pass `--learn` on single `review`** unless the user signals a one-off ("just this once").
- **Never paste raw JSON to the user.** Always extract the fields they asked about and format with the templates above.
- **Foreign currency**: show the original currency value first. ZAR equivalent is not auto-calculated yet — flag if the user asks for it.
- **Categories.md is the global baseline; merchants.local.json is your group's learned overrides.** For genuinely common SA variants the whole user-base would benefit from, edit `categories.md` directly. For per-group quirks, the local overrides are right.
- **For ambiguous user requests** ("how am I doing?"), default to `finance summary --month <current>` followed by `finance budget-check --month <current>` and combine into one response.
- **Never run `finance remove` without explicit user confirmation**, even when a duplicate looks unambiguous. The agent's job is to flag, explain, and recommend; the user decides which row dies. This applies to the post-`process` auto-sweep too — flag candidates, don't act on them.
- **Never sweep for duplicates without a date range.** If the user asks to "find duplicates" without one, ask for a range first. The auto-sweep after `process` uses the date span of the rows just added, not the whole ledger.

## Tips

- **Filename hints for `--bank`**: if the CSV filename contains "discovery" or "disc", pass `--bank Discovery`; for "investec" or "inv", `--bank Investec`. Otherwise the CLI auto-detects from CSV headers and content.
- **Stash several CSVs before processing**: when a user sends an Investec export, just `ingest` it and acknowledge. If they then send Discovery, `ingest` that too. Only run `finance process` when they ask, or when they signal they're done sending (e.g. "that's it, let's go through them"). One `process` call categorises everything in one batch — much better than per-CSV review pings.
- **Re-ingest is safe** thanks to SHA-256 dedup. If the user uploads an end-of-month export that overlaps a mid-month one already stashed, the duplicate rows are silently skipped at the raw layer.
- **For a date range that spans months**, use `--from D --to D` rather than chaining months.
- **`finance flagged`** is the right call when the user asks "what's still untagged?" or "what should I review?".
- **The `categories.md` file is the source of truth** for the taxonomy. To improve coverage permanently, edit it (in this skill's directory). Per-group `merchants.local.json` is for one-off / per-group quirks, not the global pattern set.
- **Spot-check a ledger row against the bank's original**: open the raw file from around that date (e.g. `raw/discovery_2026-04-*Z.csv`) and find the row by date + amount. There's no per-row tx_id link — raw is an archive of the bank CSV as the user sent it, not a normalised mirror of the ledger.
