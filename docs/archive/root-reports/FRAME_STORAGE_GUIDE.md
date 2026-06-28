# Frame Engine - Production Integration Guide

## 📊 Frame Data Storage Strategy

### What to Store

When ingesting RSS headlines, persist these frame fields alongside your extracted entities:

```typescript
{
  // Entity extraction (existing)
  name: "OpenAI",
  primary_entity: "OpenAI",
  secondary_entities: ["Rockset"],
  confidence: 0.85,
  
  // Frame data (NEW - add these fields)
  frame_type: "DIRECTIONAL",        // BIDIRECTIONAL | DIRECTIONAL | SELF_EVENT | EXEC_EVENT | UNKNOWN
  event_type: "ACQUISITION",        // ACQUISITION | INVESTMENT | PARTNERSHIP | MERGER | FUNDING | EXEC_CHANGE | LAUNCH | VALUATION | UNKNOWN
  verb_matched: "acquire",          // The specific verb pattern that matched
  frame_subject: "OpenAI",          // Actor/initiator
  frame_object: "Rockset",          // Target (null for SELF_EVENT)
  frame_confidence: 0.85,           // Frame parser confidence score
  frame_notes: [],                  // ["stripped_leading_modifier", "stripped_leading_person_possessive"]
  
  // Original data
  headline: "OpenAI acquires Rockset in $200M deal",
  source: "TechCrunch",
  discovered_at: "2026-01-25T10:30:00Z"
}
```

### Database Schema Changes

#### Option 1: Add Columns to `discovered_startups` or `startup_uploads`

```sql
ALTER TABLE discovered_startups 
ADD COLUMN frame_type TEXT,
ADD COLUMN event_type TEXT,
ADD COLUMN verb_matched TEXT,
ADD COLUMN frame_subject TEXT,
ADD COLUMN frame_object TEXT,
ADD COLUMN frame_confidence FLOAT,
ADD COLUMN frame_notes TEXT[];

-- Index for event queries
CREATE INDEX idx_discovered_startups_event_type ON discovered_startups(event_type);
CREATE INDEX idx_discovered_startups_frame_type ON discovered_startups(frame_type);
```

#### Option 2: Separate `headline_frames` Table

```sql
CREATE TABLE headline_frames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  headline_id UUID REFERENCES discovered_startups(id) ON DELETE CASCADE,
  
  -- Frame fields
  frame_type TEXT NOT NULL,
  event_type TEXT NOT NULL,
  verb_matched TEXT,
  subject TEXT,
  object TEXT,
  confidence FLOAT NOT NULL,
  notes TEXT[],
  
  -- Metadata
  extracted_at TIMESTAMP DEFAULT NOW(),
  parser_version TEXT DEFAULT 'jisst-lite-v1'
);

-- Indexes
CREATE INDEX idx_headline_frames_event_type ON headline_frames(event_type);
CREATE INDEX idx_headline_frames_headline_id ON headline_frames(headline_id);
CREATE INDEX idx_headline_frames_confidence ON headline_frames(confidence DESC);
```

**Recommendation**: Start with Option 1 (add columns) for simplicity. Migrate to Option 2 if you need:
- Version control of frame parsing
- Multiple frame interpretations per headline
- Backfill/reprocessing workflows

---

## 🔄 Integration Points

### 1. RSS Scraper (simple-rss-scraper.js)

**Current:**
```javascript
const company = extractCompanyName(title); // Old extractor
```

**Updated:**
```javascript
// Import TypeScript extractor
const { extractEntitiesFromTitle } = require('../dist/services/rss/entityExtractor.js');

const result = extractEntitiesFromTitle(title);
const frame = result.frame; // Only present if includeFrameDebug=true

if (result.primaryEntity) {
  await supabase.from('discovered_startups').insert({
    name: result.primaryEntity,
    headline: title,
    // Frame data
    frame_type: frame?.frameType,
    event_type: frame?.eventType,
    verb_matched: frame?.verbMatched,
    frame_subject: frame?.slots.subject,
    frame_object: frame?.slots.object,
    frame_confidence: frame?.meta.confidence,
    frame_notes: frame?.meta.notes,
    // ... rest of fields
  });
}
```

### 2. Enable Frame Debug Output

In `src/services/rss/entityExtractor.ts` (line 732):

```typescript
const includeFrameDebug = true; // Enable to include frame in result
```

### 3. Continuous Scraper (continuous-scraper.js)

Same changes as RSS scraper. The frame engine adds negligible overhead (~1-2ms per headline).

---

## 📈 Downstream Use Cases

### Use Case 1: Signal Decay Models

Weight events by recency and semantic importance:

```typescript
function calculateEventSignal(event: DiscoveredStartup): number {
  const baseScore = {
    'ACQUISITION': 100,
    'FUNDING': 80,
    'PARTNERSHIP': 60,
    'LAUNCH': 40,
    'EXEC_CHANGE': 20,
  }[event.event_type] || 0;
  
  const ageInDays = daysSince(event.discovered_at);
  const decayFactor = Math.exp(-ageInDays / 30); // 30-day half-life
  
  return baseScore * decayFactor * event.frame_confidence;
}
```

### Use Case 2: Phase-Change Detection

Identify startups transitioning between phases:

```sql
-- Startups that went from FUNDING → ACQUISITION (exit signal)
SELECT 
  frame_subject as startup,
  COUNT(*) FILTER (WHERE event_type = 'FUNDING') as funding_events,
  MAX(discovered_at) FILTER (WHERE event_type = 'FUNDING') as last_funding,
  MIN(discovered_at) FILTER (WHERE event_type = 'ACQUISITION') as acquired_at
FROM discovered_startups
WHERE frame_subject IN (
  SELECT DISTINCT frame_subject 
  FROM discovered_startups 
  WHERE event_type = 'ACQUISITION'
)
GROUP BY frame_subject
HAVING COUNT(*) FILTER (WHERE event_type = 'FUNDING') > 0;
```

### Use Case 3: Investor Signal Extraction

Extract investor names from INVESTMENT frames:

```typescript
// "Stripe invests $100M in Bridge" → Investor: Stripe, Target: Bridge
if (frame.frameType === 'DIRECTIONAL' && frame.eventType === 'INVESTMENT') {
  await supabase.from('investor_activity').insert({
    investor_name: frame.slots.subject,  // Stripe
    target_startup: frame.slots.object,  // Bridge
    signal_strength: frame.meta.confidence
  });
}
```

### Use Case 4: GOD Score Modifiers

Boost GOD scores for recent positive events:

```typescript
function calculateGODScore(startup: Startup): number {
  let baseScore = calculateBaseGOD(startup);
  
  // Recent events from frame data
  const recentEvents = await supabase
    .from('discovered_startups')
    .select('event_type, frame_confidence')
    .eq('frame_subject', startup.name)
    .gte('discovered_at', threeMonthsAgo());
  
  const eventBoost = recentEvents.reduce((acc, e) => {
    const multiplier = {
      'FUNDING': 1.2,      // +20% for funding
      'PARTNERSHIP': 1.1,  // +10% for partnerships
      'LAUNCH': 1.05,      // +5% for launches
    }[e.event_type] || 1.0;
    
    return acc * multiplier;
  }, 1.0);
  
  return Math.min(baseScore * eventBoost, 100);
}
```

### Use Case 5: Competitive Analysis

Track M&A activity by sector:

```sql
SELECT 
  frame_subject as acquirer,
  COUNT(*) as acquisition_count,
  ARRAY_AGG(frame_object) as targets
FROM discovered_startups
WHERE event_type = 'ACQUISITION'
  AND discovered_at > NOW() - INTERVAL '1 year'
GROUP BY frame_subject
ORDER BY acquisition_count DESC
LIMIT 20;
```

---

## 🧪 Backtest Frame Quality

Run this query to validate frame extraction quality:

```sql
-- Frame confidence distribution
SELECT 
  event_type,
  COUNT(*) as total,
  AVG(frame_confidence) as avg_confidence,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY frame_confidence) as median_confidence,
  COUNT(*) FILTER (WHERE frame_confidence >= 0.8) as high_conf_count
FROM discovered_startups
WHERE frame_type IS NOT NULL
GROUP BY event_type
ORDER BY total DESC;
```

**Expected results:**
- EXEC_EVENT: avg_confidence ~0.93 (very high - specific pattern)
- BIDIRECTIONAL: avg_confidence ~0.88 (high - explicit keywords)
- DIRECTIONAL: avg_confidence ~0.85 (high - clear subject-object)
- SELF_EVENT: avg_confidence ~0.80 (threshold - some ambiguity)

---

## 🚀 Production Checklist

- [x] Frame engine implemented (27 patterns)
- [x] EventType mapping added
- [x] Publisher junk filtering
- [x] Test harnesses (9/9 + 13/13 passing)
- [ ] Add frame columns to database
- [ ] Update RSS scrapers to store frame data
- [ ] Enable `includeFrameDebug=true` in entityExtractor
- [ ] Build indexes on `event_type`, `frame_type`
- [ ] Create materialized view for event analytics
- [ ] Backfill existing `discovered_startups` (optional)

---

## 📦 Frame Storage Example (Full Record)

```json
{
  "id": "uuid-here",
  "name": "Coco Robotics",
  "headline": "Sam Altman-backed Coco Robotics raises $3M seed round",
  "source": "TechCrunch",
  "discovered_at": "2026-01-25T10:30:00Z",
  
  "frame_type": "SELF_EVENT",
  "event_type": "FUNDING",
  "verb_matched": "raise",
  "frame_subject": "Coco Robotics",
  "frame_object": null,
  "frame_confidence": 0.8,
  "frame_notes": ["stripped_leading_modifier"],
  
  "entities": [
    {"entity": "Coco Robotics", "confidence": 0.6, "kind": "company", "reasons": ["frame_subject"]}
  ],
  
  "status": "pending",
  "sectors": ["Robotics", "Delivery"],
  "funding_amount": "$3M",
  "funding_stage": "Seed"
}
```

---

## 🔍 Monitoring & Alerts

Set up alerts for:
1. **Frame match rate drop** - if < 70%, patterns may need tuning
2. **Publisher junk spike** - if > 25%, new junk patterns emerged
3. **Low confidence drift** - if avg drops below 0.75, data quality issue
4. **Event distribution shift** - sudden changes indicate feed source changes

```typescript
// Example monitoring query (run hourly)
const stats = await supabase.rpc('get_frame_health_stats');

if (stats.frame_match_rate < 0.7) {
  alert('Frame match rate below 70%');
}
```

---

*Last updated: January 25, 2026*  
*Parser version: jisst-lite-v1*  
*Pattern count: 27*
