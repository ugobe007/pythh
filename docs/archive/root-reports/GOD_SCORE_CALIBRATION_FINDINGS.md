# GOD Score Calibration - Findings & Recommendations

## Executive Summary

After analyzing the GOD scoring system with real data, we've identified the root cause of score clustering and lack of differentiation. **The issue is not with normalization settings, but with missing data and scoring logic that doesn't handle sparse data well.**

---

## 🔍 Key Findings

### 1. **Data Availability Crisis**

**Traction Data:**
- Only **6%** of startups have `mrr`, `arr`, `growth_rate`, or `customer_count`
- **0%** have this data in `extracted_data` JSONB column
- **Result**: 97.2% of startups score 0-20 for Traction (median 8.0)

**Market Data:**
- **100%** have `sectors` (good!)
- **0%** have `market_size` in extracted_data
- **0%** have `problem`/`solution` in extracted_data
- **Result**: 96.8% score 0-20 for Market (median 8.0)

**Product Data:**
- Only **15%** have `is_launched` flag
- Only **2%** have `has_demo` flag
- **Result**: 97.2% score 0-20 for Product (median 8.0)

**extracted_data Column:**
- Only **7%** of startups have any data in `extracted_data` JSONB
- This is the primary source for enrichment data, but it's mostly empty

### 2. **Component Differentiation Issues**

| Component | Avg | Median | Std Dev | Issue |
|-----------|-----|--------|---------|-------|
| **Team** | 31.0 | 12.0 | 26.1 | ✅ Good differentiation |
| **Vision** | 20.6 | 8.0 | 21.9 | ✅ Good differentiation |
| **Traction** | 9.5 | 8.0 | 8.4 | ❌ Low differentiation |
| **Market** | 10.1 | 8.0 | 8.3 | ❌ Low differentiation |
| **Product** | 9.5 | 8.0 | 8.1 | ❌ Low differentiation |

### 3. **Correlation Analysis**

- **Vision**: 0.529 correlation (strong predictor)
- **Traction**: 0.149 correlation (weak - not contributing meaningfully)
- **Product**: 0.148 correlation (weak - not contributing meaningfully)
- **Market**: 0.115 correlation (weak - not contributing meaningfully)
- **Team**: 0.083 correlation (weak - surprising, but may be due to data issues)

---

## ✅ What We Fixed

### 1. **Improved Scoring Functions**

**Traction Scoring:**
- Added lower thresholds ($10K+ gets 0.75, 5%+ growth gets 0.15)
- Added customer signals (1+ customer = 0.15)
- Added fallback logic (launched/demo = 0.2, value prop = 0.1)
- **Impact**: Startups with minimal data can now score above 0

**Market Scoring:**
- Better sector handling (100% have sectors, now properly weighted)
- Improved market_size parsing (handles "$10B" strings)
- More granular problem/solution scoring
- Added fallback to value_proposition/pitch for market keywords
- **Impact**: Better differentiation using available data

**Product Scoring:**
- Multiple field checks (launched, is_launched, mvp_stage)
- Stage-based fallback (uses funding stage as maturity signal)
- Website fallback (website = 0.2 product presence)
- Solution description fallback (50+ chars = 0.15)
- **Impact**: Can differentiate even when launch flags missing

### 2. **Fixed Data Mapping**

- Updated `toScoringProfile()` to use `extracted_data` as fallback
- Fixed component score mapping (was using wrong breakdown fields)
- Added support for multiple field name variations

### 3. **Created Diagnostic Tools**

- `scripts/calibrate-god-scores.ts` - Analyzes real investment outcomes
- `scripts/analyze-god-score-distribution.ts` - Shows score distribution
- `scripts/analyze-god-components.ts` - Component-level analysis
- `scripts/diagnose-scoring-data.ts` - Data availability analysis

---

## 🎯 Root Cause

**The GOD scoring system is working correctly**, but:

1. **Missing Data**: 94% of startups don't have traction/market/product data
2. **Old Scoring Logic**: Previous logic gave 0 when data missing, causing clustering
3. **No Fallbacks**: System didn't use available signals (sectors, stage, website) as fallbacks

**This is NOT a normalization problem** - it's a data availability and scoring logic problem.

---

## 📋 Recommendations

### Immediate Actions (Priority 1)

1. **Recalculate All Scores**
   ```bash
   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npx tsx scripts/recalculate-scores.ts
   ```
   - This will apply the new improved scoring logic
   - Should see better differentiation in Traction, Market, Product
   - Scores will use fallback logic when data is missing

2. **Verify Improvements**
   ```bash
   npx tsx scripts/analyze-god-components.ts
   ```
   - Check if std dev improved for Traction, Market, Product
   - Verify scores are no longer clustering at 8.0

### Medium-Term Actions (Priority 2)

3. **Improve Data Extraction**
   - Run AI enrichment to populate `extracted_data` column
   - Extract traction metrics from pitch/description text
   - Parse market size from descriptions
   - Identify product maturity from website/stage

4. **Monitor Real Outcomes**
   - Once you have matches with `funded`, `meeting_scheduled`, `declined` status
   - Run `scripts/calibrate-god-scores.ts` to see which scores correlate with investments
   - Adjust based on REAL data, not arbitrary targets

### Long-Term Actions (Priority 3)

5. **Data Collection Pipeline**
   - Improve scraper to capture more traction signals
   - Add market size extraction to AI enrichment
   - Set product flags (is_launched, has_demo) during ingestion
   - Populate `extracted_data` for all startups

6. **Component Weight Optimization**
   - Once you have investment outcome data
   - Use ML recommendations to adjust component weights
   - Ensure weights reflect actual predictive power

---

## ⚠️ Important Notes

### DO NOT:
- ❌ Arbitrarily change normalization divisor without data justification
- ❌ Add baselines that inflate all scores equally
- ❌ Adjust weights without real investment outcome data
- ❌ Make changes that corrupt the GOD scoring logic integrity

### DO:
- ✅ Recalculate scores with improved logic
- ✅ Improve data collection and extraction
- ✅ Use real investment outcomes to calibrate
- ✅ Maintain GOD scoring system integrity
- ✅ Base all adjustments on actual data, not arbitrary targets

---

## 📊 Expected Improvements After Recalculation

**Before (Current State):**
- Traction: 97.2% score 0-20, std dev 8.4
- Market: 96.8% score 0-20, std dev 8.3
- Product: 97.2% score 0-20, std dev 8.1

**After Recalculation (Expected):**
- Traction: Better spread, std dev > 10 (using fallbacks)
- Market: Better spread, std dev > 12 (using sectors + problem/solution)
- Product: Better spread, std dev > 10 (using stage + website + solution)

**Total Score Distribution:**
- Should see better spread across 50-75 range
- Less clustering in 49-64 range
- Better differentiation between startup quality levels

---

## 🔬 Validation Process

1. **Recalculate scores** with new logic
2. **Run component analysis** to verify improvements
3. **Check distribution** to ensure better spread
4. **Monitor** as more data is collected
5. **Calibrate** once investment outcomes are available

---

**Last Updated**: 2024
**Status**: Ready for recalculation
**Next Step**: Run `npx tsx scripts/recalculate-scores.ts` to apply improvements



