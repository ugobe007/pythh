# 📊 Scoring Metrics Explained

## Two Different Metrics - Two Different Purposes

### 🔥 GOD Scores (Internal Quality Metric)
**Range:** 0-100  
**Current Average:** 70.4  
**Purpose:** Internal quality assessment of startup fundamentals  
**Audience:** Internal use only (admin analysis)

**What It Measures:**
- Team quality (ex-FAANG, founders, technical depth)
- Traction (revenue, growth rate, customers)
- Market opportunity (TAM, competition, timing)
- Product strength (MVP, IP, differentiation)
- Vision clarity (founder intelligence, strategic thinking)

**Score Distribution:**
- 63-89: Current range in database (1000 samples)
- 70.4: Average score
- This is NORMAL - these are quality startups that made it into the system

**Why 70.4 is Expected:**
- Algorithm uses 0-10 scale (7/10 = good startup)
- Multiplies by 10 to get 0-100 (70 = solid quality)
- Startups below 40 are filtered out by database trigger
- These are pre-screened companies, not random submissions

**DO NOT SHOW TO USERS** - This is like showing restaurant health inspection scores instead of Yelp reviews. Technically accurate but wrong narrative.

---

### ⚡ Signal Match Scores (User-Facing Metric)
**Range:** 0-100  
**Current Average:** 74.7 (match scores)  
**Purpose:** Alignment between startup and investor signals  
**Audience:** Public-facing (founders searching for investors)

**What It Measures:**
- Sector alignment (startup industry ↔ investor focus)
- Stage fit (pre-seed, seed, A, B ↔ investor stage preference)
- Geographic match (startup location ↔ investor region)
- Signal correlation (high/mid/low = cyan/green/orange)
- Semantic similarity (when embeddings available)

**Signal Levels:**
- **High (70%+)**: Cyan - Strong alignment, high probability
- **Mid (50-69%)**: Green - Good fit, moderate probability  
- **Low (<50%)**: Orange - Weak alignment, exploratory

**Why Show This Instead:**
- Tells the founder story: "This investor matches your signal"
- Action-oriented: "75% match means reach out"
- Product narrative: "Find investors through signal alignment"
- Builds intrigue: "What makes this a 92% match?"

---

## What Changed

### Before (Wrong)
```
Home Page Power Indicators:
- 3.2K Investors
- 6.1K Startups  
- 435K Matches
- GOD 88 Avg Score ❌ (internal quality metric shown publicly)
```

### After (Correct)
```
Home Page Power Indicators:
- 3.2K Investors
- 6.1K Startups
- 435K Matches
- 75% Signal Match ✅ (user-facing alignment metric)
```

---

## Technical Implementation

### GOD Score Calculation
**Source:** `server/services/startupScoringService.ts`  
**Recalculation:** `scripts/recalculate-scores.ts` (hourly via PM2)

```typescript
// 0-10 scale scoring
const result = calculateHotScore(profile);
// Convert to 0-100
const total = Math.round(result.total * 10);
```

**Component Breakdown:**
- Team execution (0-3) + Team age (0-1) → team_score (0-100)
- Traction (0-3) → traction_score (0-100)
- Market (0-2) + Market insight (0-1.5) → market_score (0-100)
- Product (0-2) → product_score (0-100)
- Vision (0-2) → vision_score (0-100)

### Signal Match Calculation
**Source:** `src/services/matchingService.ts`  
**Database:** `startup_investor_matches.match_score`

```typescript
// Match score combines:
// - GOD score weight (60%) - quality baseline
// - Semantic similarity (40%) - signal alignment when embeddings available
// - Sector/stage filters - hard requirements
```

**Color Coding:**
```typescript
function getSignalColor(score: number) {
  if (score >= 70) return 'cyan'; // High signal
  if (score >= 50) return 'green'; // Mid signal
  return 'orange'; // Low signal
}
```

---

## For Admins

### When to Check GOD Scores
- **Admin Dashboard** - Analyze startup quality distribution
- **Data Quality Audits** - Verify scoring algorithm working
- **ML Training** - Use as features for investment predictions
- **System Health** - Monitor via System Guardian

### When to Show Signal Scores
- **Home Page** - "75% Signal Match" indicator
- **Match Results** - Individual match percentages
- **Live Feed** - Real-time signal correlations
- **Discovery** - Ranked investor matches

---

## Database Reference

```sql
-- GOD scores (internal quality)
SELECT 
  name,
  total_god_score,
  team_score,
  traction_score,
  market_score,
  product_score,
  vision_score
FROM startup_uploads
WHERE status = 'approved'
ORDER BY total_god_score DESC;

-- Signal match scores (user-facing)
SELECT 
  s.name as startup,
  i.name as investor,
  m.match_score,
  m.sector_match,
  m.stage_match
FROM startup_investor_matches m
JOIN startup_uploads s ON m.startup_id = s.id
JOIN investors i ON m.investor_id = i.id
WHERE m.match_score >= 70
ORDER BY m.match_score DESC;
```

---

## Summary

| Metric | Purpose | Average | Show Where |
|--------|---------|---------|-----------|
| **GOD Score** | Internal quality | 70.4 | Admin only |
| **Signal Match** | Alignment strength | 74.7 | Public pages |

**Bottom Line:** GOD scores measure startup quality (like a credit score). Signal scores measure investor fit (like dating compatibility). Show compatibility, not credit scores! 🎯

---

*Last updated: December 19, 2025*
