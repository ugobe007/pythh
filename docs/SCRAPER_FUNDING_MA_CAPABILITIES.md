# Funding & M&A Detection — Current State & Recommendations

## What You Have

### 1. **Event classification** (`lib/event-classifier.js`)
- Classifies headlines: FUNDING, ACQUISITION, LAUNCH, PARTNERSHIP
- Pattern-based, no AI cost
- Used by high-volume-discovery, frame parser

### 2. **RSS → startup_events** (`scripts/core/ssot-rss-scraper.js`)
- Ingests RSS feeds, parses with Phase-Change frame parser
- Writes to **startup_events** with: `event_type`, `subject`, `object`, `entities`, `amounts`, `round`, `source_*`
- Covers FUNDING, ACQUISITION, LAUNCH, etc.

### 3. **Enrich approved startups** (`scripts/enrich-from-rss-news.js`)
- Reads `startup_events` (last 180 days)
- **Matches by name** to `startup_uploads` (approved)
- Merges: press tier, funding_amount, funding_stage into `extracted_data`
- **Gap:** ACQUISITION events are enriched like any other — no exit recording, no status update

### 4. **M&A exit detection** (`scripts/archive/utilities/detect-startup-exits.js`)
- Reads from **rss_articles** (not startup_events)
- Scans for exit keywords, uses AI to extract details
- Matches to startup_uploads, would save to `startup_exits`
- **Gap:** `rss_articles` may not be populated; script is archived

### 5. **Funding scraper** (`scrapers/funding-scraper.js`)
- Adds NEW startups only (checks `exists()` to skip)
- Does not update existing startups with new funding

### 6. **Tables**
- `startup_events` — RSS events (FUNDING, ACQUISITION, etc.)
- `funding_outcomes` — funded/acquired/shutdown (for ML)
- `startup_exits` — acquisition/merger/IPO details (if migration run)
- `virtual_portfolio` — tracks exits for portfolio entries

---

## Gaps to Fix

| Gap | Impact | Fix |
|-----|--------|-----|
| ACQUISITION events not recorded as exits | M&A of tracked startups not captured | In enrich-from-rss-news: when event_type=ACQUISITION, record in funding_outcomes / startup_exits |
| No startup status update on exit | Acquired startups still show as active | Add `company_status` or use existing status; set to 'acquired' on exit |
| Matching only by name | Misses "Acme" vs "Acme Inc", domain variants | Add company_domain, website host matching; fuzzy name |
| detect-startup-exits reads rss_articles | Table may be empty | Switch to startup_events (or run both) |
| Funding updates only when missing | Doesn't overwrite stale funding | Consider "last known funding" vs "latest news" logic |

---

## Recommended Next Steps

1. **Extend enrich-from-rss-news.js**
   - When `event_type === 'ACQUISITION'`: insert into `funding_outcomes` (outcome_type='acquired'), optionally update startup status
   - When `event_type === 'FUNDING'`: already merging — ensure we're updating `stage` and `extracted_data.funding_mentions` for recency

2. **Improve matching for tracked startups**
   - Build lookup by: `normalizeName`, `company_domain`, `website` host
   - Fuzzy match (e.g. "Stripe" vs "Stripe Inc") via existing name normalization

3. **Unify exit detection**
   - Move detect-startup-exits logic to read from `startup_events` (ACQUISITION, or add MERGER/IPO)
   - Or run a lighter script that: scans startup_events for ACQUISITION → matches to startup_uploads → records exit

4. **Add M&A-specific RSS sources** (optional)
   - Google News: "startup acquired"
   - TechCrunch M&A, Crunchbase acquisitions

---

## Flow Diagram (Current vs Target)

```
CURRENT:
  RSS feeds → ssot-rss-scraper → startup_events
                                      ↓
  enrich-from-rss-news → match by name → startup_uploads.extracted_data (press + funding)
  (ACQUISITION treated same as FUNDING - no exit recorded)

TARGET:
  RSS feeds → ssot-rss-scraper → startup_events
                                      ↓
  enrich-from-rss-news → match by name/domain
       ├─ FUNDING → merge funding_amount, stage, press
       └─ ACQUISITION → merge press + INSERT funding_outcomes(outcome_type='acquired')
                       + UPDATE startup status to 'acquired' (if column exists)
```

---

## Schema Reference

- **startup_uploads.company_status** — `'active' | 'acquired' | 'dead' | 'unknown'` (from upgrade_to_comprehensive_startup_schema)
- **startup_exits** — startup_id, exit_type, exit_value, acquirer_name, exit_date, investors_involved
- **funding_outcomes** — startup_id, outcome_type ('funded'|'acquired'|'shutdown'), funding_amount, funding_round

---

## Quick Checks

```sql
-- Is startup_events populated?
SELECT event_type, COUNT(*) 
FROM startup_events 
WHERE occurred_at > NOW() - INTERVAL '7 days' 
GROUP BY event_type;

-- Any acquisition events?
SELECT subject, object, source_title, source_url 
FROM startup_events 
WHERE event_type = 'ACQUISITION' 
  AND occurred_at > NOW() - INTERVAL '30 days'
LIMIT 20;

-- Do we have startup_exits / company_status?
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'startup_uploads' AND column_name = 'company_status';
```
