# Investor Data Quality Strategy

## Problem Statement

The investor database is polluted with non-investor entities created from:
- Sentence fragments ("and capital", "cost of capital")
- Article metadata ("article Guillermo Rauch", "day ago PAI")
- Role descriptors ("as Managing (A16z)", "Senior Finance")
- Firm-name echoes ("founded Greylock (Greylock)")
- Editorial noise

This makes the dataset appear "empty" when it's actually polluted upstream.

## Root Cause

**Current (Wrong) Contract:**
```
If text resembles a person or firm → create investor entity
```

**Correct Contract:**
```
Layer A: Investor Mention (cheap, noisy, many)
  - Allowed to be messy
  - Stored in investor_mentions_raw
  
Layer B: Investor Entity (clean, sparse, trusted)
  - Created only when validated
  - Stored in investors table
```

## The Investor Promotion Gate

Before creating an investor entity, require **at least 2 of 4**:

1. **Canonical Name**
   - Person: First Last
   - Firm: Known suffix or match

2. **Context Verb**
   - invested / backed / led / seed / series

3. **Source Alignment**
   - Appears on portfolio page, funding article, or startup site

4. **Cross-Reference**
   - Same name appears ≥2 times across sources

If not → keep as mention, never as entity.

## Failure Modes & Fixes

### Failure Mode 1: Sentence-Fragment Investors
**Examples:** "and capital", "deal or fund", "cost of capital"

**Fix:**
```javascript
if (!hasProperName && !hasFirmSuffix) reject();
```

### Failure Mode 2: Article / Metadata Leakage
**Examples:** "article Guillermo Rauch", "day ago PAI", "min readEnergy Capital"

**Fix:**
Strip article metadata prefixes before NER:
- article
- min read
- day ago
- how/why/what

### Failure Mode 3: Role-Based Hallucinations
**Examples:** "as Managing (A16z)", "YanSenior Finance"

**Fix:**
Reject if:
- Contains job titles (Managing, Senior, Finance, Research)
- AND no delimiter indicating investment (backed by, led by, invested in)

### Failure Mode 4: Firm-Name Echo Without Investor Context
**Examples:** "founded Greylock (Greylock)", "with his founding (Greylock)"

**Fix:**
Require a funding verb nearby:
- Valid verbs: backed, led, invested, participated, round, seed, series
- No verb → no investor entity

### Failure Mode 5: Duplicate Phantom Entities
**Fix:**
Before insert:
1. Normalize string
2. Hash
3. Check for existing mention, not entity

Mentions can duplicate. Entities should not.

### Failure Mode 6: People With Zero Investor Context
**Examples:** "John Maraganore", "Vicki Sato"

**Fix:**
A person is not an investor unless:
- Linked to a firm AND
- Associated with an investment action or portfolio context

Otherwise: `"type": "person_mentioned"` not `"type": "investor"`

## Cleanup Strategy

### Step 1: Quarantine
Move all records with:
- `missing_count >= 7`
- AND no URL
- AND no LinkedIn
- AND name contains stopwords (and, how, article, min, read)

→ into `investor_mentions_raw`

### Step 2: Re-derive Investors
Re-run investor extraction from:
- Startup pages
- Articles
- NOT from the investor table itself

### Step 3: Rebuild Investor Entities
Using the promotion gate above.

## Implementation

### Scripts

1. **`scripts/investor-data-quality-gate.js`**
   - Validates investor entities before creation
   - Identifies garbage records
   - Quarantines bad data

2. **`scripts/quarantine-garbage-investors.sql`**
   - SQL queries to identify and quarantine garbage
   - Safe to run in audit mode first

### Usage

```bash
# Identify garbage records
node scripts/investor-data-quality-gate.js

# Quarantine (dry run)
node scripts/investor-data-quality-gate.js --quarantine

# Quarantine (execute)
node scripts/investor-data-quality-gate.js --quarantine --execute

# Validate a single investor
node scripts/investor-data-quality-gate.js --validate "John Doe" --firm "ABC Capital" --context "backed startup"
```

### Automation & monitoring

- **Snapshot (tiers, scores, verification):** `npm run dq:investors` (uses `SUPABASE_SERVICE_KEY` when set so counts are not limited by RLS).
- **Garbage scan:** `node scripts/investor-data-quality-gate.js` (default) — lists candidates from `validateInvestorEntity`.
- **Quarantine path:** `--quarantine` / `--quarantine --execute` — moves bad rows toward `investor_mentions_raw` per script logic.
- **Platform rollup:** `npm run dq:report:full` includes investor-quality stdout alongside startups/RSS checks; quick cron mode: `npm run dq:report:json` (enrichment + RSS sample only).

## What "Missing Investor Data" Actually Means

After cleanup, legitimate missing cases:
- Pre-seed / angel-only
- Bootstrapped
- Stealth
- Founder deliberately undisclosed

These should be labeled:
```json
{
  "investor_state": "undisclosed",
  "investor_reason": "No public investor disclosure as of YYYY-MM-DD"
}
```

This is valuable information for many investors.

## Strategic Impact

**Right now:**
- Investors look "empty"
- Matching quality degrades
- GOD scores lose explainability

**After this fix:**
- Fewer investors, but real
- Clean firm-level matching
- Honest "undisclosed" signals (which many angels prefer)
- Much lower LLM + browser costs


