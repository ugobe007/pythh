# Match Score Threshold Fix

## Problem Identified

✅ **Table exists**: `startup_investor_matches` table is created
✅ **Data exists**: Matches are in the database
❌ **Score too low**: Your matches have `match_score = 20.00`, but frontend was filtering for `>= 35`

## Solution Applied

I've **lowered the match score threshold from 35 to 20** in `MatchingEngine.tsx` to show your existing matches.

### Changes Made

- Changed `MIN_MATCH_SCORE` from `35` to `20`
- Updated error messages to reflect the new threshold
- Matches with score 20+ will now show in the frontend

## What This Means

- **Before**: Only matches with score >= 35 would show (you had 0)
- **After**: Matches with score >= 20 will show (you have at least 1)

## Verify It Works

1. **Restart your dev server**:
   ```bash
   npm run dev
   ```

2. **Check the frontend**: You should now see your match with score 20.00

3. **Test query** (run in Supabase):
   ```sql
   SELECT COUNT(*) 
   FROM startup_investor_matches
   WHERE status = 'suggested' AND match_score >= 20;
   ```

## Optional: Adjust Threshold

If you want to change the threshold, edit `src/components/MatchingEngine.tsx` line ~348:

```typescript
const MIN_MATCH_SCORE = 20; // Adjust this value (0-100)
```

**Recommendations**:
- `20` - Shows all matches (current setting)
- `35` - Shows medium+ quality matches (original)
- `50` - Shows only good matches
- `70` - Shows only excellent matches

## Why Your Matches Have Low Scores

Your match shows:
- `match_score: 20.00`
- `confidence_level: "low"`
- Reasoning mentions "GOD score: 34"

This suggests:
1. The startup's GOD score is relatively low (34)
2. The matching algorithm is scoring conservatively
3. You may need to improve startup data quality or adjust the matching algorithm

## Next Steps

1. ✅ Restart dev server (to pick up the threshold change)
2. ✅ Check frontend - should now show matches
3. 🔄 **Optional**: Generate more matches with higher scores by running the queue processor
4. 🔄 **Optional**: Improve startup GOD scores to get better match scores

## About Those "Junk" Tables

The empty tables you found are likely **NOT junk**:
- `current_algorithm_weights` - Used for ML training
- `investor_portfolio_performance` - Analytics/metrics
- `template_recommendations` - Template system
- `monthly_revenue` - Revenue tracking
- Views (v_*) - Database views, not tables

**Don't delete them** - they're part of your system architecture, just empty until data is populated.
