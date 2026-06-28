# Impact of Courage & Intelligence on GOD Scoring System

## Overview

The addition of **Founder Courage** and **Founder Intelligence** (based on Ben Horowitz / a16z framework) has expanded the GOD scoring system from **14 components to 16 components**.

---

## Scoring System Changes

### Before (14 Components)
```
Total Possible Points: 34.5
Components:
- Base Boost: ~17 (minimum)
- Team: 0-3
- Traction: 0-3
- Market: 0-2
- Product: 0-2
- Vision: 0-2
- Ecosystem: 0-1.5
- Grit: 0-1.5
- Problem Validation: 0-2
- Founder Age: 0-1.5
- Sales Velocity: 0-2
- Founder Speed: 0-3
- Unique Insight: 0-2.5
- User Love: 0-2
- Learning Velocity: 0-1.5
```

### After (16 Components)
```
Total Possible Points: 37.5 (+3 points)
Components:
- Base Boost: ~17 (minimum)
- Team: 0-3
- Traction: 0-3
- Market: 0-2
- Product: 0-2
- Vision: 0-2
- Ecosystem: 0-1.5
- Grit: 0-1.5
- Problem Validation: 0-2
- Founder Age: 0-1.5
- Sales Velocity: 0-2
- Founder Speed: 0-3
- Unique Insight: 0-2.5
- User Love: 0-2
- Learning Velocity: 0-1.5
- Founder Courage: 0-1.5 ⭐ NEW (a16z)
- Founder Intelligence: 0-1.5 ⭐ NEW (a16z)
```

---

## Impact on Final Scores

### Normalization Formula

**Before:**
```typescript
total = (rawTotal / 34.5) * 10
```

**After:**
```typescript
total = (rawTotal / 37.5) * 10
```

### Score Impact Examples

#### Example 1: Startup with Average Scores (No Courage/Intelligence Data)
- **Before**: Raw total = 20 points → Score = (20 / 34.5) * 10 = **5.80/10**
- **After**: Raw total = 20 points → Score = (20 / 37.5) * 10 = **5.33/10**
- **Impact**: Slight decrease (~0.47 points) due to larger denominator

#### Example 2: Startup with High Courage & Intelligence
- **Before**: Raw total = 20 points → Score = **5.80/10**
- **After**: Raw total = 23 points (20 + 1.5 courage + 1.5 intelligence) → Score = (23 / 37.5) * 10 = **6.13/10**
- **Impact**: Increase of **0.33 points** from founder attributes

#### Example 3: Startup with Maximum Scores
- **Before**: Raw total = 34.5 points → Score = **10.0/10**
- **After**: Raw total = 37.5 points (34.5 + 1.5 + 1.5) → Score = **10.0/10** (capped)
- **Impact**: Can now reach maximum score with founder attributes

---

## Minimum Score Impact

### Base Boost Calculation

**Before:**
- Minimum base boost: 17 points
- Minimum score: (17 / 34.5) * 10 = **4.93/10** (~50/100)

**After:**
- Minimum base boost: 17 points (unchanged)
- Minimum score: (17 / 37.5) * 10 = **4.53/10** (~45/100)
- **Impact**: Minimum score decreased by ~0.40 points

**However**, with default courage/intelligence scores (0.5 each):
- Minimum raw total: 17 + 0.5 + 0.5 = 18 points
- Minimum score: (18 / 37.5) * 10 = **4.80/10** (~48/100)
- **Actual impact**: Only ~0.13 point decrease

---

## Component Weight Distribution

### Weight Analysis

| Component | Max Points | % of Total | Impact Level |
|-----------|-----------|------------|--------------|
| Base Boost | ~17 | 45.3% | High |
| Team | 3 | 8.0% | Medium |
| Traction | 3 | 8.0% | Medium |
| Founder Speed | 3 | 8.0% | Medium |
| Market | 2 | 5.3% | Low |
| Product | 2 | 5.3% | Low |
| Vision | 2 | 5.3% | Low |
| Unique Insight | 2.5 | 6.7% | Medium |
| Problem Validation | 2 | 5.3% | Low |
| Sales Velocity | 2 | 5.3% | Low |
| User Love | 2 | 5.3% | Low |
| **Founder Courage** | **1.5** | **4.0%** | **Low-Medium** |
| **Founder Intelligence** | **1.5** | **4.0%** | **Low-Medium** |
| Ecosystem | 1.5 | 4.0% | Low |
| Grit | 1.5 | 4.0% | Low |
| Founder Age | 1.5 | 4.0% | Low |
| Learning Velocity | 1.5 | 4.0% | Low |

**Total**: 37.5 points

---

## Key Insights

### 1. **Founder Attributes Now Matter**
- Startups with high courage/intelligence can gain up to **3 points** (1.5 each)
- This represents **8% of total scoring** (3/37.5)
- Can move a startup from "warm" to "hot" tier

### 2. **Default Behavior**
- If no courage/intelligence data exists, both default to **0.5 points**
- This prevents penalizing startups without this data
- Total default contribution: **1.0 point** (0.5 + 0.5)

### 3. **Score Compression**
- The larger denominator (37.5 vs 34.5) slightly compresses all scores
- However, startups with strong founder attributes can offset this
- Net effect: Better differentiation for founders with courage/intelligence

### 4. **Tier Thresholds (Unchanged)**
- **Hot**: ≥ 7.0/10
- **Warm**: ≥ 4.0/10
- **Cold**: < 4.0/10

### 5. **Match Count Impact**
- **Super Hot** (≥9.0): 20 matches
- **Hot** (≥7.0): 15 matches
- **Warm** (≥5.0): 10 matches
- **Default**: 5 matches

Startups with high courage/intelligence are more likely to reach higher tiers and get more matches.

---

## Recommendations

### For Startups
1. **Collect Founder Data**: Gather evidence of courage and intelligence
   - Bold decisions made
   - Times rejected but persisted
   - Strategic thinking examples
   - Problem-solving examples

2. **Document Resilience**: Track pivots, setbacks overcome, and high-risk bets

3. **Show Strategic Depth**: Provide examples of analytical thinking and learning velocity

### For the System
1. **Data Collection**: Update startup intake forms to capture courage/intelligence indicators
2. **AI Enrichment**: Enhance AI enrichment to infer these attributes from pitch/description
3. **Scoring Transparency**: Show courage/intelligence scores in breakdown for founders

---

## Conclusion

The addition of courage and intelligence:
- ✅ Adds **3 points** to maximum possible score
- ✅ Provides **8% weight** to founder attributes (a16z framework)
- ✅ Slightly compresses scores (due to larger denominator)
- ✅ Rewards founders with documented courage/intelligence
- ✅ Maintains backward compatibility (defaults to 0.5 each)

**Net Impact**: Startups with strong founder attributes (courage + intelligence) can now score **0.33-0.80 points higher**, potentially moving them up a tier and getting more investor matches.





