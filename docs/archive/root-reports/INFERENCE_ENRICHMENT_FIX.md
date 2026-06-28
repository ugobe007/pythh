# Inference Model Fix - Populating Missing Data

## Problem Identified

**The GOD scoring system is biased because 94% of startups are missing critical data:**

- **Traction**: Only 6% have `mrr`, `arr`, `growth_rate`, or `customer_count`
- **Market**: 0% have `market_size` in `extracted_data`
- **Product**: Only 15% have `is_launched` flag, 2% have `has_demo`
- **extracted_data**: Only 7% of startups have any data in this JSONB column

**Result**: Components cluster at low scores (8.0 median) because scoring functions return 0 when data is missing.

## Root Cause

The inference model extracts data during discovery/scraping, but:

1. **Import scripts don't transfer `extracted_data`** - When startups are imported from `discovered_startups` to `startup_uploads`, the `extracted_data` is not populated
2. **No batch enrichment process** - Existing startups never get enriched with missing data
3. **Enrichment scripts are incomplete** - Current scripts only enrich basic fields (description, sectors, location), not traction/market/product data

## Solution Implemented

### 1. Created `startupEnrichmentService.ts`

**Location**: `server/services/startupEnrichmentService.ts`

**Features**:
- Uses Anthropic Claude to infer missing data from available fields
- Extracts traction, market, product, team, and funding data
- Populates `extracted_data` JSONB column
- Can enrich single startup or batch process

**Extracted Fields**:
- **Traction**: `revenue`, `mrr`, `arr`, `growth_rate`, `active_users`, `customers`, `customer_count`
- **Market**: `market_size`, `problem`, `solution`, `value_proposition`
- **Product**: `is_launched`, `has_demo`, `mvp_stage`
- **Team**: `founders_count`, `technical_cofounders`, `team_companies`
- **Funding**: `funding_amount`, `funding_stage`, `investors_mentioned`

### 2. Created Batch Enrichment Script

**Location**: `scripts/enrich-startups-inference.ts`

**Usage**:
```bash
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... ANTHROPIC_API_KEY=... \
  npx tsx scripts/enrich-startups-inference.ts [--limit 100] [--all] [--missing]
```

**Options**:
- `--limit N`: Process N startups (default: 100)
- `--all`: Process all startups
- `--missing`: Only process startups missing data (default: true)

## How It Works

1. **Fetches startups** from `startup_uploads` that need enrichment
2. **Uses AI inference** to extract data from:
   - Company name
   - Description
   - Tagline
   - Pitch
   - Website
   - Sectors
3. **Merges inferred data** with existing `extracted_data`
4. **Updates database** with enriched data

## Next Steps

### Immediate Actions

1. **Run enrichment on existing startups**:
   ```bash
   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... ANTHROPIC_API_KEY=... \
     npx tsx scripts/enrich-startups-inference.ts --limit 1000
   ```

2. **Recalculate GOD scores** after enrichment:
   ```bash
   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
     npx tsx scripts/recalculate-scores.ts
   ```

3. **Verify improvements**:
   ```bash
   npx tsx scripts/analyze-god-components.ts
   ```

### Long-Term Improvements

1. **Auto-enrich on import**: Update import scripts to automatically enrich new startups
2. **Scheduled enrichment**: Run enrichment as part of the automation pipeline
3. **Incremental enrichment**: Enrich startups as new data becomes available

## Expected Impact

**Before Enrichment**:
- Traction: 97.2% score 0-20, std dev 8.4
- Market: 96.8% score 0-20, std dev 8.3
- Product: 97.2% score 0-20, std dev 8.1

**After Enrichment** (Expected):
- Traction: Better spread, std dev > 12 (using inferred revenue/growth)
- Market: Better spread, std dev > 15 (using inferred problem/solution/market_size)
- Product: Better spread, std dev > 12 (using inferred launch/demo status)

**Result**: GOD scoring system can properly differentiate startups based on real data, not just fallback logic.

## Integration Points

### Update Import Scripts

When importing from `discovered_startups` to `startup_uploads`, call enrichment:

```typescript
import { enrichStartup } from '../server/services/startupEnrichmentService';

// After inserting startup
await enrichStartup(newStartupId);
```

### Add to Automation Pipeline

Add to `automation-pipeline.js`:

```javascript
// After importing discovered startups
await batchEnrichStartups(100, true);
```

## Monitoring

Track enrichment success:
- Number of startups enriched
- Fields populated per startup
- Impact on GOD score differentiation
- Component score improvements

## Notes

- **API Costs**: Anthropic API calls cost money - batch processing helps manage costs
- **Rate Limiting**: Script includes 2-second delays between batches
- **Data Quality**: AI inference is not perfect - manual review may be needed for critical startups
- **Incremental**: Can run multiple times - merges with existing `extracted_data`

---

**Status**: ✅ Ready to use
**Priority**: 🔴 Critical - Required for unbiased GOD scoring
**Next Action**: Run enrichment script on existing startups



