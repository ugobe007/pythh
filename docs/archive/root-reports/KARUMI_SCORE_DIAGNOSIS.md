# Karumi.ai Score Drop Investigation

## The Issue
Signal score displayed as "6.5" → "5.0" in the last hour.

## Root Cause Analysis

### Display Formula (convergenceAPI.ts line 196)
```typescript
signal_strength_0_10: Math.min(10, godScore / 10)
```

**This means:**
- Database stores: `total_god_score` (0-100 scale)
- Display shows: `signal_strength_0_10` (0-10 scale)
- Conversion: `total_god_score / 10`

### Possible Scenarios

#### 1. **Score Recalculation Ran** ⚠️ MOST LIKELY
- Script: `npx tsx scripts/recalculate-scores.ts`
- If this ran in the last hour, it would have recalculated ALL startup GOD scores
- Database `total_god_score` changed: 65 → 50
- Display changed: 6.5 → 5.0

**Check:**
```sql
SELECT id, name, total_god_score, updated_at
FROM startup_uploads
WHERE website ILIKE '%karumi%' OR name ILIKE '%karumi%'
ORDER BY updated_at DESC;
```

#### 2. **Manual Score Update**
Someone updated the database directly via Supabase SQL Editor or admin panel.

#### 3. **Market Signal Scraper** (UNLIKELY)
The RSS/news scraper picked up negative signals and auto-updated the score.
- Script: `continuous-scraper.js` or related
- However, scrapers typically create NEW records in `discovered_startups`, not update existing `startup_uploads`

#### 4. **Database Trigger** ⚠️ POSSIBLE
Check if there's a database trigger on `startup_uploads` that recalculates scores:
```sql
SELECT tgname, tgtype, tgenabled, tgisinternal
FROM pg_trigger
WHERE tgrelid = 'startup_uploads'::regclass;
```

#### 5. **Cache/Session Issue** (UNLIKELY)
User saw cached old data (6.5) then fresh data (5.0), but actual DB score was always 50.

## Investigation Steps

### Step 1: Check Current Database Score
```sql
SELECT 
  id,
  name,
  website,
  total_god_score,
  team_score,
  traction_score,
  market_score,
  product_score,
  vision_score,
  status,
  updated_at,
  created_at
FROM startup_uploads
WHERE website ILIKE '%karumi%' OR name ILIKE '%karumi%'
ORDER BY updated_at DESC;
```

### Step 2: Check Score History (if table exists)
```sql
SELECT 
  startup_id,
  total_god_score,
  team_score,
  traction_score,
  market_score,
  product_score,
  vision_score,
  changed_at,
  reason
FROM score_history
WHERE startup_id IN (
  SELECT id FROM startup_uploads WHERE website ILIKE '%karumi%' OR name ILIKE '%karumi%'
)
ORDER BY changed_at DESC
LIMIT 10;
```

### Step 3: Check AI Logs for Recent Scoring Activity
```sql
SELECT 
  type,
  action,
  status,
  output,
  created_at
FROM ai_logs
WHERE type IN ('scoring', 'recalculation', 'enrichment')
  AND created_at > NOW() - INTERVAL '2 hours'
ORDER BY created_at DESC
LIMIT 20;
```

### Step 4: Check PM2 Logs for Recalculation
```bash
pm2 logs --lines 100 | grep -i "karumi\|recalc\|scoring"
```

### Step 5: Check for Database Triggers
```sql
SELECT 
  tgname AS trigger_name,
  pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid = 'startup_uploads'::regclass
  AND tgname NOT LIKE 'RI_%'; -- Exclude foreign key triggers
```

## Expected Behavior

### GOD Score Range (0-100)
According to `startupScoringService.ts`:
- **Elite**: 78-98
- **Average**: 50-77
- **Low quality**: 30-48

### Score Components (startup_uploads table)
- `total_god_score`: Sum of weighted components
- `team_score`: 0-10 (weighted in algorithm)
- `traction_score`: 0-10
- `market_score`: 0-10
- `product_score`: 0-10
- `vision_score`: 0-10

### Scoring Service
File: `server/services/startupScoringService.ts`
- normalizationDivisor: 10.5 (as of Jan 22, 2026)
- baseBoostMinimum: 2.0
- Expected average: 55-65

## Resolution Actions

### If Score Drop is Legitimate
1. **Check startup data quality**
   - Has team info degraded?
   - Traction metrics disappeared?
   - Market size data changed?
   
2. **Review scoring algorithm**
   - Check `startupScoringService.ts` for recent changes
   - Verify normalization divisor (10.5)
   - Check component weights

3. **Verify input data**
   - Run enrichment: `node enrich-startup.js karumi.ai`
   - Check `extracted_data` JSONB field

### If Score Drop is a Bug
1. **Rollback database** (if score_history exists)
2. **Fix scoring algorithm** if bug found
3. **Re-run recalculation**: `npx tsx scripts/recalculate-scores.ts`
4. **Add safeguards**: Database trigger to prevent scores below minimum threshold

## Database Trigger Prevention (ALREADY EXISTS)
According to ADMIN_CLEANUP_COMPLETE.md:
```sql
-- Prevent GOD scores below 40 (was creating bad matches)
CREATE OR REPLACE FUNCTION check_god_score()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.total_god_score < 40 THEN
    RAISE EXCEPTION 'GOD score cannot be below 40 (got %)', NEW.total_god_score;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_god_score
BEFORE INSERT OR UPDATE ON startup_uploads
FOR EACH ROW
EXECUTE FUNCTION check_god_score();
```

**This means**: Score cannot go below 40, so karumi.ai's score of 50 is valid but low.

## Conclusion

**Most likely cause**: Score recalculation script ran, and karumi.ai legitimately scored lower (50/100 = 5.0/10) based on current data quality.

**Action items**:
1. Run SQL queries above to confirm current score
2. Check ai_logs for recent scoring activity
3. Review karumi.ai's startup data (team, traction, market)
4. If data is poor, enrich it: `node enrich-startup.js karumi.ai`
5. If enrichment improves data, re-run scoring: `npx tsx scripts/recalculate-scores.ts`

**Score interpretation**:
- 5.0/10 (50/100) = Average startup, not elite
- Still above minimum threshold (40)
- Improvements needed in: team, traction, or market data
