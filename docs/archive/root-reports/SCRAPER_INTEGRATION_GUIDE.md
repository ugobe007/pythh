# SCRAPER INTEGRATION GUIDE - Observer Tracking Moat
## Wire Discovery Events to Behavioral Gravity System

**Purpose**: Every time a scraper detects investor activity, track it as observer event

**Moat**: This data compounds. More events → Better FOMO detection → More founders → More events

---

## Integration Points

### 1. RSS Scraper (When Investor Reads Startup News)

**File**: `server/services/rssScraper.js` or similar

**Trigger**: Investor reads article about startup

**Code**:
```javascript
// After detecting investor viewed startup article
const { supabase } = require('./lib/supabaseClient');

await supabase.from('investor_startup_observers').insert({
  investor_id: investor.id,
  startup_id: startup.id,
  source: 'news',
  weight: 0.6,
  meta: {
    article_url: article.url,
    article_title: article.title
  }
});
```

---

### 2. Similar Startup Browser (When Investor Views Related Company)

**File**: Discovery pipeline, recommendation engine

**Trigger**: Investor clicks on "Similar to [Startup]"

**Code**:
```javascript
await supabase.from('investor_startup_observers').insert({
  investor_id: investor.id,
  startup_id: target_startup.id,
  source: 'browse_similar',
  weight: 1.2,
  meta: {
    referrer_startup_id: source_startup.id,
    referrer_name: source_startup.name
  }
});
```

**Why Weight 1.2**: Strong signal - investor actively browsing similar companies

---

### 3. Search/Discovery (When Investor Searches Sector)

**File**: Search service, discovery flow

**Trigger**: Investor searches for "AI/ML startups" and startup appears in results

**Code**:
```javascript
// For each startup shown in search results
await supabase.from('investor_startup_observers').insert({
  investor_id: investor.id,
  startup_id: startup.id,
  source: 'search',
  weight: 1.0,
  meta: {
    search_query: query,
    result_position: index
  }
});
```

---

### 4. Portfolio Overlap Detection (Automated)

**File**: Portfolio adjacency computation job

**Trigger**: Nightly job detects investor portfolio overlaps with startup

**Code**:
```javascript
// When adjacency score > 0.7
await supabase.from('investor_startup_observers').insert({
  investor_id: investor.id,
  startup_id: startup.id,
  source: 'portfolio_overlap',
  weight: 1.5,
  meta: {
    overlap_score: adjacency.overlap_score,
    adjacent_companies: adjacency.adjacent_companies
  }
});
```

**Why Weight 1.5**: Very strong signal - portfolio alignment detected

---

### 5. Partner View (When VC Partner Opens Startup Page)

**File**: UI tracking, analytics pipeline

**Trigger**: Investor with "partner" role views startup profile

**Code**:
```javascript
// In frontend or analytics tracking
await fetch('/api/track-view', {
  method: 'POST',
  body: JSON.stringify({
    investor_id: user.id,
    startup_id: startup.id,
    is_partner: user.role === 'partner'
  })
});

// Backend:
if (is_partner) {
  await supabase.from('investor_startup_observers').insert({
    investor_id: investor_id,
    startup_id: startup_id,
    source: 'partner_view',
    weight: 2.0,
    meta: {
      partner_name: user.name,
      firm: user.firm
    }
  });
}
```

**Why Weight 2.0**: Strongest signal - decision-maker viewing startup

---

### 6. Forum/Discussion (When Investor Engages)

**File**: Forum/community features

**Trigger**: Investor comments on or upvotes startup

**Code**:
```javascript
await supabase.from('investor_startup_observers').insert({
  investor_id: investor.id,
  startup_id: startup.id,
  source: 'forum',
  weight: 0.8,
  meta: {
    action: 'comment' // or 'upvote', 'share'
  }
});
```

---

## Weight Guidelines (From User Spec)

| Source | Weight | Meaning |
|--------|--------|---------|
| `partner_view` | 2.0 | Decision-maker viewing |
| `portfolio_overlap` | 1.5 | Strong portfolio fit |
| `browse_similar` | 1.2 | Active discovery |
| `search` | 1.0 | Passive discovery |
| `forum` | 0.8 | Community engagement |
| `news` | 0.6 | Indirect signal |

---

## Bulk Insert Pattern (High-Volume Scrapers)

For scrapers processing 100+ events per run:

```javascript
const events = [];

// Collect events
for (const item of scrapedItems) {
  events.push({
    investor_id: item.investor_id,
    startup_id: item.startup_id,
    source: 'news',
    weight: 0.6,
    occurred_at: item.published_at
  });
}

// Batch insert (max 1000 per batch)
for (let i = 0; i < events.length; i += 1000) {
  const batch = events.slice(i, i + 1000);
  await supabase.from('investor_startup_observers').insert(batch);
}
```

---

## Deduplication Strategy

To avoid duplicate events:

```javascript
// Check if event already exists (same investor + startup + source + day)
const today = new Date().toISOString().split('T')[0];

const { data: existing } = await supabase
  .from('investor_startup_observers')
  .select('id')
  .eq('investor_id', investor.id)
  .eq('startup_id', startup.id)
  .eq('source', source)
  .gte('occurred_at', `${today}T00:00:00Z`)
  .lte('occurred_at', `${today}T23:59:59Z`)
  .limit(1);

if (!existing?.length) {
  // Insert only if no event today
  await supabase.from('investor_startup_observers').insert(...);
}
```

---

## Testing Your Integration

### 1. Insert Test Event
```bash
psql $DATABASE_URL -c "
INSERT INTO investor_startup_observers 
(investor_id, startup_id, source, weight)
SELECT 
  (SELECT id FROM investors LIMIT 1),
  (SELECT id FROM startup_uploads WHERE status='approved' LIMIT 1),
  'browse_similar',
  1.2;
"
```

### 2. Verify FOMO Triggered
```bash
psql $DATABASE_URL -c "
SELECT 
  startup_id, 
  signal_7d, 
  fomo_state 
FROM investor_startup_fomo_triggers 
LIMIT 5;
"
```

### 3. Check Observer Count
```bash
curl "http://localhost:3002/api/discovery/convergence?url=<startup-url>" | jq '.status.observers_7d'
# Should return > 0
```

---

## Production Monitoring

### Key Metrics to Track

```sql
-- Events inserted per day
SELECT DATE(occurred_at), COUNT(*) 
FROM investor_startup_observers 
WHERE occurred_at > now() - interval '7 days'
GROUP BY DATE(occurred_at)
ORDER BY 1;

-- FOMO state distribution
SELECT fomo_state, COUNT(*) 
FROM investor_startup_fomo_triggers 
GROUP BY fomo_state;

-- Top observers (most active investors)
SELECT investor_id, COUNT(*) as observations
FROM investor_startup_observers
WHERE occurred_at > now() - interval '30 days'
GROUP BY investor_id
ORDER BY observations DESC
LIMIT 20;

-- Top observed startups
SELECT startup_id, COUNT(DISTINCT investor_id) as observers
FROM investor_startup_observers
WHERE occurred_at > now() - interval '7 days'
GROUP BY startup_id
ORDER BY observers DESC
LIMIT 20;
```

---

## Troubleshooting

### Events Not Showing Up

1. Check table exists:
   ```sql
   \d investor_startup_observers
   ```

2. Check foreign keys valid:
   ```sql
   SELECT COUNT(*) FROM investor_startup_observers 
   WHERE investor_id NOT IN (SELECT id FROM investors);
   ```

3. Check view updates:
   ```sql
   REFRESH MATERIALIZED VIEW IF EXISTS mv_convergence_candidates;
   ```

### FOMO States Not Updating

1. Check view definition:
   ```sql
   \d+ investor_startup_fomo_triggers
   ```

2. Manually check threshold:
   ```sql
   SELECT 
     signal_24h, 
     signal_7d, 
     signal_24h / NULLIF(signal_7d, 0) as fomo_ratio,
     CASE
       WHEN signal_24h > 10 AND (signal_24h / NULLIF(signal_7d, 0)) > 0.6 THEN 'breakout'
       WHEN signal_24h > 5  AND (signal_24h / NULLIF(signal_7d, 0)) > 0.3 THEN 'surge'
       WHEN signal_7d  > 3  THEN 'warming'
       ELSE 'watch'
     END as should_be_state
   FROM investor_startup_fomo
   LIMIT 10;
   ```

---

## Next Steps After Integration

1. **Monitor event volume**: Should see 100-1000+ events/day once scrapers wired
2. **Verify FOMO accuracy**: Check if breakout/surge states correlate with real founder interest
3. **Add more sources**: Email opens, deck downloads, intro requests
4. **Build Investor Observatory**: Show investors where capital is converging

---

**This is your moat**: The more discovery events you track, the better your timing intelligence becomes. Competitors can't replicate months/years of behavioral data.

