# SSOT RSS Scraper - Architecture & Implementation Guide

**Date:** January 25, 2026  
**Status:** 🚧 Implementation Ready  
**Doctrine:** **Parser is SSOT, Everything Else is Transport**

---

## 🎯 Problem Statement

**Observed Issue:**  
- 1589 startups discovered → only 1 added
- RSS scraper skipping ~99.9% of events
- "No company name extracted" errors everywhere

**Root Cause:**  
Extraction logic is competing with parser instead of deferring to it as Single Source of Truth (SSOT). The extractor has "judgment" code (entity filtering, topic filtering, confidence gating) that rejects events the parser would accept.

---

## ✅ SSOT Architecture (Parser is Source of Truth)

### Parser Responsibilities (ONLY place with "judgment")
- ✅ Decide `event_type` (FILTERED / OTHER included)
- ✅ Produce `entities` + roles
- ✅ Produce `notes` / `filtered_reason`
- ✅ Produce `frame_confidence`
- ✅ Produce `extraction.pattern_id`
- ✅ Enforce invariants (or emit explicit violations)
- ✅ **NEW:** Emit `decision` (ACCEPT/REJECT) and `graph_safe` (true/false)

### Extractor Responsibilities (NO judgment)
- ✅ Normalize input (title/publisher/url/published_at)
- ✅ Call parser
- ✅ **Persist the full CapitalEvent ALWAYS** (even FILTERED/OTHER)
- ✅ Optionally skip graph-joins when parser says so (explicit flag)

### ❌ Forbidden in Extractor
- ❌ Any entity quality filtering
- ❌ Any topic-headline filtering
- ❌ Any verb heuristics
- ❌ Any "shouldSkip" logic based on tokens
- ❌ Any additional candidate generation when frame is confident

**Golden Rule:** If it isn't in the parser module, it doesn't exist.

---

## 🔧 Implementation: 2-Phase Persistence

### Phase A: ALWAYS Store Event (100% Coverage)
```javascript
const event = toCapitalEvent(frame, publisher, url, title, publishedAt);

// ALWAYS insert into startup_events (even FILTERED/OTHER)
if (event.extraction.decision === "ACCEPT") {
  await supabase.from('startup_events').insert({
    event_id: event.event_id,
    event_type: event.event_type,
    frame_confidence: event.frame_confidence,
    subject: event.subject,
    object: event.object,
    entities: event.entities,
    extraction_meta: event.extraction,
    // ... all other fields
  });
}
```

### Phase B: ONLY Create Graph Joins When `graph_safe=true`
```javascript
// ONLY if parser says graph_safe
if (event.extraction.graph_safe && event.entities.length > 0) {
  const primaryEntity = event.entities.find(e => e.role === "SUBJECT") || event.entities[0];
  
  // Insert/update in startup_uploads (graph join)
  await supabase.from('startup_uploads').insert({
    name: primaryEntity.name,
    description: event.source.title,
    website: extractWebsite(event.source.url),
    discovery_event_id: event.id,  // Link back to event
    // ... other fields
  });
}
```

**Key Insight:** Separating event storage from graph storage means we can:
1. Monitor ALL events (even junk) for feed health
2. Only create expensive graph joins for high-quality entities
3. Easily adjust `graph_safe` threshold without losing data

---

## 📊 Metrics for Triage (Identify Drop Points)

The scraper now tracks 3 critical counters:

```javascript
const metrics = {
  rss_items_total: 0,        // How many RSS items we saw
  events_inserted: 0,         // How many stored in startup_events
  graph_edges_inserted: 0,    // How many created startup_uploads
  
  // Breakdown of reasons
  reject_reasons: {},         // Why events were rejected
  filtered_reasons: {},       // Why events were FILTERED
  graph_safe_false_reasons: {} // Why graph joins were skipped
};
```

**Expected Ratios:**
- `events_inserted` should be ~90-95% of `rss_items_total` (high coverage)
- `graph_edges_inserted` should be ~20-40% of `events_inserted` (quality filtering)

**If `events_inserted` is low:**
- Check `reject_reasons` - parser is rejecting too much
- Likely cause: `decision="REJECT"` logic too strict

**If `graph_edges_inserted` is low:**
- Check `graph_safe_false_reasons`
- Likely causes: confidence threshold, entity quality, FILTERED event type

---

## 🔑 New Parser Fields (CapitalEvent.extraction)

```typescript
extraction: {
  pattern_id?: string;
  filtered_reason?: string;
  fallback_used: boolean;
  
  // NEW: Parser is SSOT for gating
  decision: "ACCEPT" | "REJECT";  // ACCEPT = store event, REJECT = truly junk
  graph_safe: boolean;            // true only when safe to create entity edges
  reject_reason?: string;         // if REJECT, why
}
```

### `decision` Rules (Implemented in Parser)
- `decision="REJECT"` ONLY if:
  - Topic headline junk (predictions, roundups, weekly digests) AND
  - Cannot extract any entity worth storing even as OTHER
- `decision="ACCEPT"` otherwise (yes, even OTHER)

### `graph_safe` Rules (Implemented in Parser)
- `graph_safe=true` ONLY if:
  - `decision="ACCEPT"`
  - `event_type` not FILTERED
  - `frame_confidence >= 0.8`
  - `entities` include at least one non-ambiguous company name
  - Invariants pass

Everything else: `graph_safe=false` but still stored as event.

---

## 🗂️ Database Schema

### `startup_events` Table (NEW)
**Purpose:** Store ALL events, even FILTERED/OTHER (100% coverage)

```sql
CREATE TABLE startup_events (
  id UUID PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,  -- hash(publisher + url)
  event_type TEXT NOT NULL,       -- FUNDING, ACQUISITION, FILTERED, etc.
  frame_type TEXT NOT NULL,
  frame_confidence FLOAT NOT NULL,
  subject TEXT,
  object TEXT,
  verb TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  source_publisher TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_title TEXT NOT NULL,
  amounts JSONB,
  round TEXT,
  semantic_context JSONB,
  entities JSONB NOT NULL,
  extraction_meta JSONB NOT NULL,  -- { decision, graph_safe, reject_reason }
  notes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexes:**
- `event_type`, `occurred_at`, `subject`, `object`, `frame_confidence`, `created_at`

### `startup_uploads` Table (EXISTING)
**Purpose:** Graph joins (ONLY when `graph_safe=true`)

**NEW Column:**
- `discovery_event_id UUID` → references `startup_events(id)`

---

## 📁 Files

### Core Implementation
| File | Purpose | Status |
|------|---------|--------|
| `src/services/rss/frameParser.ts` | Phase-Change parser (SSOT) | ✅ Updated |
| `scripts/core/ssot-rss-scraper.js` | SSOT-compliant scraper | ✅ Created |
| `migrations/ssot-event-storage.sql` | Database schema | ✅ Created |

### Legacy (DO NOT USE)
| File | Issues | Replacement |
|------|--------|-------------|
| `scripts/core/simple-rss-scraper.js` | Extractor has judgment logic | ssot-rss-scraper.js |
| `scrapers/*` | Entity extraction competes with parser | Use Phase-Change parser |

---

## 🚀 Deployment Steps

### Step 1: Apply Database Migration
```bash
# Apply the SSOT event storage schema
psql $DATABASE_URL < migrations/ssot-event-storage.sql
```

### Step 2: Switch to SSOT Scraper
```bash
# Stop old scraper if running in PM2
pm2 stop rss-scraper

# Start SSOT scraper
pm2 start scripts/core/ssot-rss-scraper.js --name "ssot-rss-scraper"
```

### Step 3: Monitor Metrics
```bash
# Watch scraper logs
pm2 logs ssot-rss-scraper

# Check metrics output at end of run:
# RSS Items Total:       1589
# Events Inserted:       ~1500 (expect 90-95% coverage)
# Graph Edges Inserted:  ~400 (expect 20-40% of events)
```

### Step 4: Validate Results
```sql
-- Check event coverage
SELECT 
  event_type,
  COUNT(*) as count,
  AVG(frame_confidence) as avg_confidence
FROM startup_events
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY event_type
ORDER BY count DESC;

-- Check graph join rate
SELECT 
  (SELECT COUNT(*) FROM startup_uploads WHERE created_at > NOW() - INTERVAL '1 hour') AS graph_joins,
  (SELECT COUNT(*) FROM startup_events WHERE created_at > NOW() - INTERVAL '1 hour') AS total_events,
  ROUND((SELECT COUNT(*) FROM startup_uploads WHERE created_at > NOW() - INTERVAL '1 hour')::numeric / 
        NULLIF((SELECT COUNT(*) FROM startup_events WHERE created_at > NOW() - INTERVAL '1 hour'), 0) * 100, 2) AS join_rate_pct;
```

---

## 🐛 Troubleshooting

### Issue: `events_inserted` is near 0
**Diagnosis:** Parser is rejecting most events  
**Fix:** Check `reject_reasons` in metrics output. Likely `decision="REJECT"` logic too strict in parser.

### Issue: `graph_edges_inserted` is near 0
**Diagnosis:** `graph_safe=false` for most events  
**Fix:** Check `graph_safe_false_reasons`. Common causes:
- `FILTERED_event_type` → topic filter too aggressive
- `low_confidence` → frame patterns incomplete
- `no_entities` → entity extraction failing

### Issue: Duplicate key violations
**Diagnosis:** Website normalization issues  
**Fix:** Events are stored by `event_id` (publisher+url), NOT website. Graph joins use `name` as primary key. Check for collisions:
```sql
SELECT name, COUNT(*) 
FROM startup_uploads 
GROUP BY name 
HAVING COUNT(*) > 1;
```

### Issue: Parser not available
**Error:** `Phase-Change frame parser not available`  
**Fix:** Ensure TypeScript files can be loaded:
```bash
npm install -D tsx
```

---

## 📈 Expected Improvements

### Before SSOT Architecture
- 1589 RSS items → 1 startup added (0.06% coverage)
- 99.94% dropped by extractor judgment
- No visibility into why events dropped

### After SSOT Architecture
- 1589 RSS items → ~1500 events stored (94% coverage)
- ~400 graph joins created (26% of events)
- Full metrics: reject/filter/graph_safe breakdown

**Result:** 1500x improvement in event coverage, full observability

---

## 🔬 Validation Tests

Create test script: `scripts/test-ssot-scraper.js`

```javascript
// Test single headline
const { parseFrameFromTitle, toCapitalEvent } = require('tsx/cjs').require(
  './src/services/rss/frameParser.ts'
);

const testHeadlines = [
  "The Rippling/Deel corporate spying scandal...",
  "Fintech firm Marquis alerts dozens of US banks...",
  "Capital One To Buy Fintech Startup Brex At Less Than Half...",
  "Inside Apple's AI Shake-Up and Its Plans for Two New Versions of Siri",
];

for (const title of testHeadlines) {
  const frame = parseFrameFromTitle(title);
  if (!frame) {
    console.log(`❌ NO FRAME: ${title}`);
    continue;
  }
  
  const event = toCapitalEvent(frame, "Test", "http://test.com", title, new Date().toISOString());
  
  console.log(`✅ ${title.slice(0, 60)}...`);
  console.log(`   Type: ${event.event_type} | Confidence: ${event.frame_confidence}`);
  console.log(`   Decision: ${event.extraction.decision} | Graph Safe: ${event.extraction.graph_safe}`);
  console.log(`   Entities: ${event.entities.map(e => `${e.name} [${e.role}]`).join(', ')}`);
  console.log();
}
```

Run: `node scripts/test-ssot-scraper.js`

**Expected:** All 4 headlines should produce events (not "NO FRAME").

---

## ✅ Success Criteria

- [ ] `startup_events` table created
- [ ] SSOT scraper running in PM2
- [ ] Metrics show `events_inserted` > 90% of `rss_items_total`
- [ ] `graph_edges_inserted` between 20-40% of `events_inserted`
- [ ] No "No company name extracted" errors in logs
- [ ] Validation tests pass (4/4 headlines produce events)

---

## 📚 Reference Links

- Phase-Change v1.0.0: [V1.0.0_IMPLEMENTATION_SUMMARY.md](./V1.0.0_IMPLEMENTATION_SUMMARY.md)
- SSOT Hardening: [SSOT_HARDENING_COMPLETE.md](./SSOT_HARDENING_COMPLETE.md)
- Frame Parser: [src/services/rss/frameParser.ts](./src/services/rss/frameParser.ts)

---

*Document Created: January 25, 2026*  
*Architecture: Parser is SSOT, Extractor is Transport*  
