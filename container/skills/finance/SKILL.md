---
name: finance
description: Use the `finance` CLI for personal-finance questions and bank-statement ingestion. Trigger this skill whenever the user asks about their spending, income, savings, budget, debit orders, transactions, transfers, fees, or category breakdowns — or drops a bank-statement CSV into chat (Discovery, Investec, or any ZAR bank export). Two-step ingest: `finance ingest <csv>` saves the bank's CSV verbatim to `raw/<bank>_<iso>.csv` (no classification, no questions, just an archive); `finance process` then re-parses every file in `raw/`, dedupes against the ledger, classifies, pairs transfers/refunds, and returns a review queue. Also covers monthly/yearly summaries, budget reconciliation (missing debit orders, amount changes, discretionary variance), flexible search across the ledger, and per-group merchant learning when the user resolves flagged transactions.
allowed-tools: Bash(finance:*)
---

# finance

Personal-finance ledger CLI. The agent's job is to translate natural-language questions into one or more `finance` commands and present the JSON output as a WhatsApp-friendly summary. The CLI handles all deterministic logic — hashing, deduplication, transfer/refund pairing, classification, budget maths.

Per-group state lives in `/workspace/group/finance/`:
- `ledger.csv` — master merged ledger across all banks (cleaned, classified, paired)
- `budget.csv` — the user's monthly/annual/quarterly budget targets
- `merchants.local.json` — learned merchant overrides (auto-appended when user resolves a flagged txn)
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
```

All output is JSON to stdout. Errors go to stderr with exit 1.

## When to invoke

The flow is **two-step by design**: `ingest` only stashes the raw CSV; `process` is what categorises and appends to the ledger. This lets the user drop several CSVs (Investec on Monday, Discovery on Friday) and triage them in one batch.

- **User drops a CSV file into chat** → extract the `attachments/<file>.csv` path from the `[File: ...]` reference and call `finance ingest`. Pass `--bank` if the filename or context hints at one (otherwise the CLI auto-detects from CSV content). **Do NOT classify, ask review questions, or run `process` unless the user asks** — just confirm with a short ack ("Stashed 84 Investec txns. Say 'process' or send more CSVs first."). The ingest output reports the bank, parsed-row count, and total raw files on disk.
- **User asks to process / categorise / "go through them" / "let's do it"** → run `finance process`, then triage the `review_queue` agentically (see workflow below). Auto-resolve everything you're confident about via `finance review-batch`, then ask the user only about the genuinely ambiguous remainder.
- **User asks a "how much / what / when" question about money** → translate to `summary`, `search`, or `budget-check`. If raw files exist that haven't been processed (you can sanity-check by running `finance process --dry-run` and checking `added`), mention it in passing.

## Workflow for `finance process` — agentic auto-resolve

The CLI is deliberately conservative: it only classifies transactions when a `categories.md` pattern matches as a substring. That leaves things like `PICK AND PAY ROSEBANK 4521` flagged because `categories.md` has `PICK N PAY` but not the spelled-out variant. **You — the agent — are the bridge.** Use your knowledge of South African merchants and brand names to resolve the obvious cases without bothering the user.

The user-facing rule: **don't ask unless you're actually uncertain.** They want minutes, not hours, of back-and-forth.

### Step 1 — Process pending raw rows

```bash
finance process
```

Reads every raw row not yet in the ledger across all banks, classifies, pairs transfers/refunds in a single pass (so cross-bank transfers pair correctly even when the two CSVs were stashed days apart), appends to the ledger, and returns the work-list. Headlines: `pending`, `added`, `transfers_paired`, `refunds_paired`. `review_queue` is what to triage next.

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

### Step 6 — Wrap up

Run `finance summary --month <current>` and present the result with the templates below.

## When to fall back to single `finance review`

- Only one or two items to fix and it's a quick correction.
- User explicitly says "no, that one was actually X" — apply with `finance review <tx_id> --category X --subcategory Y --learn` and confirm in one line.

For anything more, use `review-batch` — it's cheaper and the auto-sweep is valuable.

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

### `process [--dry-run]`

Re-parses every file in `raw/`, dedupes against the current ledger by `tx_id` (SHA-256 of `date|description|amount|bank`, with an occurrence sequence appended for legitimate duplicates so e.g. two R20 charges at the same merchant on the same day are both kept), classifies new rows via `categories.md` + `merchants.local.json`, pairs transfers (±R20, ±2 days, across all banks) and refunds (within 6 months, ≤ original amount), appends to the ledger. Returns the `review_queue` for the agent to triage. Idempotent — running again with no new raw files is a no-op.

Output:
```json
{
  "files": {
    "discovery_2026-04-28T20-10-33Z.csv": 47,
    "investec_2026-04-28T20-11-12Z.csv": 42
  },
  "banks": { "Discovery": 47, "Investec": 42 },
  "raw_parsed": 89,
  "added": 89,
  "transfers_paired": 3,
  "refunds_paired": 1,
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

**Wipes `ledger.csv` and rebuilds it from scratch by re-parsing every file in `raw/`.** Replays the full pipeline: classify → infer tx_type → pair transfers → pair refunds. Use this after a classifier change, refund-pairing fix, or any logic change that affects the entire dataset — not just classifications.

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

## Tips

- **Filename hints for `--bank`**: if the CSV filename contains "discovery" or "disc", pass `--bank Discovery`; for "investec" or "inv", `--bank Investec`. Otherwise the CLI auto-detects from CSV headers and content.
- **Stash several CSVs before processing**: when a user sends an Investec export, just `ingest` it and acknowledge. If they then send Discovery, `ingest` that too. Only run `finance process` when they ask, or when they signal they're done sending (e.g. "that's it, let's go through them"). One `process` call categorises everything in one batch — much better than per-CSV review pings.
- **Re-ingest is safe** thanks to SHA-256 dedup. If the user uploads an end-of-month export that overlaps a mid-month one already stashed, the duplicate rows are silently skipped at the raw layer.
- **For a date range that spans months**, use `--from D --to D` rather than chaining months.
- **`finance flagged`** is the right call when the user asks "what's still untagged?" or "what should I review?".
- **The `categories.md` file is the source of truth** for the taxonomy. To improve coverage permanently, edit it (in this skill's directory). Per-group `merchants.local.json` is for one-off / per-group quirks, not the global pattern set.
- **Spot-check a ledger row against the bank's original**: open the raw file from around that date (e.g. `raw/discovery_2026-04-*Z.csv`) and find the row by date + amount. There's no per-row tx_id link — raw is an archive of the bank CSV as the user sent it, not a normalised mirror of the ledger.
