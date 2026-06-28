# Targeted Startup Enrichment - Inference Engine

## Overview
Instead of broad RSS scraping, we use **targeted news searches** for specific data-sparse startups to find missing information. This inference engine prioritizes **fast feeds** over lengthy analysis.

## Strategy
```
1. Identify data-sparse startups (Phase 3-4: 0-4 signals, GOD score < 55)
2. For each startup, search Google News RSS with startup name
3. Extract missing data using pattern-matching (NO AI calls)
4. Update startup records with enriched data
5. Re-run GOD score recalculation
```

## Usage
```bash
# Test with 5 startups
node scripts/enrich-sparse-startups.js --limit=5

# Enrich 50 startups (takes ~2 minutes with rate limiting)
node scripts/enrich-sparse-startups.js --limit=50

# Full enrichment run (all sparse startups)
node scripts/enrich-sparse-startups.js --limit=5000
```

## What It Extracts
| Data Type | Pattern Matching | Mapped To Column |
|-----------|------------------|------------------|
| **Funding** | "$X million raised", "Series A" | `raise_amount`, `raise_type` |
| **Sectors** | "fintech", "AI/ML", "healthtech" | `sectors[]` |
| **Customers** | "10,000 users", "500 customers" | `customer_count` |
| **Revenue** | "$2M ARR", "$100K MRR" | `arr`, `mrr` |

## Data Sources (Fast Feeds)
- **Google News RSS** (primary) - fastest, most reliable
  - Query format: `"StartupName" startup funding`
  - Limit: 5 most recent articles per startup
  - Rate limit: 2 seconds between searches

## Expected Results
- **Enrichment Rate**: 40-60% (depends on startup visibility)
- **Score Impact**: +5 to +10 GOD points after re-scoring
- **Time**: ~2.4 seconds per startup (with rate limiting)

## Example Run
```
📊 Processing up to 50 startups
✅ Found 50 Phase 3-4 startups (0-4 signals)

[3/50] Eric Trump
  Current score: 35
  🔍 Searching: ""Eric Trump" startup funding"
  ✅ Found 5 articles
    🏷️  Found sectors: FinTech, Robotics
  ✅ Enriched 1 fields

========================
📊 ENRICHMENT SUMMARY
========================
  Processed:     50 startups
  ✅ Enriched:   22 (44.0%)
  ⚠️  No Data:    25
  ❌ Errors:     3
```

## Integration with GOD Scores
After enrichment, run:
```bash
# Recalculate GOD scores with new data
npx tsx scripts/recalculate-scores.ts

# Verify score improvements
node scripts/check-god-scores.js
```

## Technical Details

### Pattern Matching (NO AI)
- Uses `/lib/inference-extractor.js` (pure regex + keyword matching)
- Extracts: funding, sectors, team, execution signals
- No external API calls → fast and free

### Data Quality
- Only updates if field is **currently missing/empty**
- Stores article references in `extracted_data.enrichment_sources`
- Tracks `last_enrichment_date` for audit trail

### Rate Limiting
- **2 seconds** between searches (respectful to Google News)
- Processes 30 startups/minute
- 1,800 startups/hour max throughput

## Automation (Future)
Can be scheduled via PM2:
```javascript
// ecosystem.config.js
{
  name: 'enrichment-worker',
  script: 'scripts/enrich-sparse-startups.js',
  args: '--limit=100',
  cron_restart: '0 */6 * * *', // Every 6 hours
  autorestart: false
}
```

## Success Metrics
| Metric | Before | After Enrichment | Target |
|--------|--------|------------------|--------|
| Avg GOD Score | 46.3 | TBD | 52-55 |
| Phase 3-4 Count | 5200 | TBD | < 4000 |
| Fair (40-49) | 40.2% | TBD | 20-25% |
| Good (50-59) | 46.0% | TBD | 35-40% |

## Next Steps
1. ✅ Test enrichment on 50 startups
2. ⏳ Run full batch on all Phase 3-4 startups
3. ⏳ Re-run GOD score recalculation
4. ⏳ Measure score improvements
5. ⏳ Schedule automated enrichment runs

---

**Philosophy**: Use the inference engine to **find missing data** before scoring, not to inflate scores with bootstrap contamination. This maintains Pythh architecture integrity.
