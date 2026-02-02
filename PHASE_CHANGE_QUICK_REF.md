# Phase-Change Quick Reference Card

**Status:** ✅ Production-Ready  
**Implementation:** January 25, 2026

---

## 🎯 EventType Quick Reference

| EventType | Used For | Example Headline |
|-----------|----------|------------------|
| **FUNDING** | Company raises capital | "Metaview raises $7M Series A" |
| **INVESTMENT** | Investor deploys capital | "Stripe invests $100M in Bridge" |
| **ACQUISITION** | M&A activity | "OpenAI acquires Rockset" |
| **MERGER** | Company merger | "GC merges with Venture Highway" |
| **PARTNERSHIP** | Strategic alliance | "Coinbase signs deal with Mastercard" |
| **LAUNCH** | Product/company launch | "Revolut launches crypto feature" |
| **IPO_FILING** | IPO filing | "Stripe files for IPO" |
| **VALUATION** | Valuation announced | "OpenAI valued at $80B" |
| **EXEC_CHANGE** | Leadership change | "Databricks names CEO" |
| **CONTRACT** | Deal/contract win | "Palantir wins $500M contract" |
| **OTHER** | Unclassified | "QuantumLight targets $500m" |
| **FILTERED** | Publisher junk | "How Revolut is changing banking" |

---

## 🔧 Common Patterns

### FUNDING Events
- `raises $X` → FUNDING
- `secures $X` → FUNDING
- `closes $X round` → FUNDING
- `receives funding` → FUNDING

### INVESTMENT Events
- `X invests in Y` → INVESTMENT
- `X leads round in Y` → INVESTMENT
- `X takes stake in Y` → INVESTMENT

### ACQUISITION Events
- `X acquires Y` → ACQUISITION
- `X buys Y` → ACQUISITION

### PARTNERSHIP Events
- `X partners with Y` → PARTNERSHIP
- `X signs deal with Y` → PARTNERSHIP
- `X teams up with Y` → PARTNERSHIP

### LAUNCH Events
- `X launches Y` → LAUNCH
- `X debuts Y` → LAUNCH
- `X unveils Y` → LAUNCH

---

## 📊 Primary Entity Logic

| EventType | Primary Entity |
|-----------|----------------|
| FUNDING | Company (subject) |
| INVESTMENT | Company (object) ← **Founder-centric** |
| ACQUISITION | Acquirer (subject) |
| PARTNERSHIP | Subject company |
| MERGER | Subject company |
| LAUNCH | Company |
| IPO_FILING | Company |
| VALUATION | Company |
| EXEC_CHANGE | Company (not person) |
| CONTRACT | Company |

**Key Rule:** Investment events are "about the funded company," not the investor.

---

## 🗄️ Database Schema (Quick)

```sql
-- Main events table
CREATE TABLE startup_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,  -- FUNDING, ACQUISITION, etc.
  verb TEXT,                 -- "invest", "acquire"
  subject TEXT,              -- "OpenAI"
  object TEXT,               -- "Rockset"
  occurred_at TIMESTAMPTZ,
  payload JSONB              -- Full CapitalEvent
);

-- Entity-event join
CREATE TABLE startup_event_entities (
  event_id TEXT,
  entity_name TEXT,          -- "Metaview"
  role TEXT,                 -- SUBJECT, OBJECT, COUNTERPARTY
  confidence REAL,
  PRIMARY KEY (event_id, entity_name, role)
);
```

---

## 🚀 Usage Example

```typescript
import { extractEntitiesFromTitle } from './entityExtractor';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key);

// Process RSS headline
const result = extractEntitiesFromTitle("Metaview raises $7M Series A", 0.6);
const frame = result.frame;

// Check if junk
if (frame.eventType === 'FILTERED') {
  console.log('Skipping junk:', title);
  return;
}

// Build CapitalEvent
const event = {
  event_id: hashEventId(publisher, url, title),
  occurred_at: publishedAt,
  event_type: frame.eventType,      // "FUNDING"
  verb: frame.verbMatched,          // "raise"
  frame_type: frame.frameType,      // "SELF_EVENT"
  frame_confidence: frame.meta.confidence,
  subject: frame.slots.subject,     // "Metaview"
  object: frame.slots.object,
  entities: result.entities.map(e => ({
    name: e.entity,
    role: "SUBJECT",
    confidence: e.confidence,
    source: "frame",
  })),
  // ... rest of contract
};

// Store in database
await supabase.from('startup_events').insert({
  event_id: event.event_id,
  event_type: event.event_type,
  verb: event.verb,
  subject: event.subject,
  object: event.object,
  occurred_at: event.occurred_at,
  payload: event, // Full JSONB
});
```

---

## ⚠️ Doctrine Locks (Never Break)

### 1. Junk Filtering Before Frame Emission
```typescript
// ✅ CORRECT: Filter first
if (isPublisherJunk) {
  return { eventType: "FILTERED" };
}

const frame = parseFrameFromTitle(title); // Only now parse

// ❌ WRONG: Parse then filter
const frame = parseFrameFromTitle(title);
if (isJunk(frame)) { ... } // Too late!
```

### 2. Exec Events Exclude Person Entities
```typescript
// ✅ CORRECT: Company only
entities: [{ name: "Databricks", role: "SUBJECT" }]

// ❌ WRONG: Person in graph
entities: [
  { name: "Databricks", role: "SUBJECT" },
  { name: "Ali Ghodsi", role: "PERSON" } // Don't do this!
]
```

---

## 📈 Monitoring Queries

**Event type distribution:**
```sql
SELECT event_type, COUNT(*) 
FROM startup_events 
WHERE event_type != 'FILTERED'
GROUP BY event_type 
ORDER BY COUNT(*) DESC;
```

**Recent funding events:**
```sql
SELECT subject, title, occurred_at
FROM startup_events
WHERE event_type = 'FUNDING'
  AND occurred_at > NOW() - INTERVAL '7 days'
ORDER BY occurred_at DESC;
```

**Company event timeline:**
```sql
SELECT e.event_type, e.occurred_at, e.title
FROM startup_events e
JOIN startup_event_entities ee ON e.event_id = ee.event_id
WHERE ee.entity_name = 'Metaview'
ORDER BY e.occurred_at DESC;
```

---

## 🧪 Testing

```bash
# Run all tests
npx tsx src/services/rss/entityExtractor.testHarness.ts
npx tsx src/services/rss/entityExtractor.regressionHarness.ts

# Run demo
npx tsx scripts/demo-frame-engine.ts

# Build check
npm run build
```

**Expected Results:**
- Original tests: 9/9 ✅
- Regression tests: 13/13 ✅
- Demo frame matches: 14/18 (77.8%)
- Build: ✓ built in ~6s

---

## 📚 Full Documentation

| Document | Purpose |
|----------|---------|
| [PHASE_CHANGE_CANONICAL_SPEC.md](PHASE_CHANGE_CANONICAL_SPEC.md) | Complete SSOT (580 lines) |
| [PHASE_CHANGE_IMPLEMENTATION_SUMMARY.md](PHASE_CHANGE_IMPLEMENTATION_SUMMARY.md) | Implementation details |
| [migrations/phase-change-events.sql](migrations/phase-change-events.sql) | Database migration |
| [FRAME_STORAGE_GUIDE.md](FRAME_STORAGE_GUIDE.md) | Storage patterns |

---

**Ready for Production:** ✅  
**Migration Status:** Ready to deploy  
**Test Coverage:** 22/22 (100%)
