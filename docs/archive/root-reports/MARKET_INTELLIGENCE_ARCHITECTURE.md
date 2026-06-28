# 🧠 Market Intelligence Architecture

## The Problem

Current approach tries to scrape "5 points of truth" directly from news articles, which:
1. News articles don't discuss product-market fit
2. Scrapers capture minimal data (name, description, url)
3. GOD scoring defaults to base values (5/5/7/5/7 = 29) without rich data
4. **Score Reset Bug**: `recalculate-scores.ts` runs on cron and resets ALL scores to base values

## The Solution: Derived Intelligence

Instead of scraping values directly, we **infer** them by building market intelligence:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MARKET INTELLIGENCE LAYER                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│  │ MARKET PROBLEMS │  │ SOLUTION        │  │ TEAM SUCCESS    │        │
│  │ by Industry     │  │ PATTERNS        │  │ PATTERNS        │        │
│  │                 │  │                 │  │                 │        │
│  │ • Top 5 pains   │  │ • What works    │  │ • Winning team  │        │
│  │ • Ranked by     │  │ • From analyst  │  │   profiles by   │        │
│  │   severity      │  │   reports       │  │   industry      │        │
│  │ • Source: news  │  │ • Mapped to     │  │ • Weighted 1-5  │        │
│  │   & analysts    │  │   problems      │  │                 │        │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘        │
│           │                    │                    │                  │
│           └────────────────────┼────────────────────┘                  │
│                                │                                       │
│                    ┌───────────▼───────────┐                          │
│                    │   INVESTMENT          │                          │
│                    │   BENCHMARKS          │                          │
│                    │                       │                          │
│                    │ • AI vs non-AI       │                          │
│                    │   multiples (5-10x)  │                          │
│                    │ • Stage-appropriate  │                          │
│                    │   raise amounts      │                          │
│                    │ • Sector comparables │                          │
│                    └───────────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       GOD SCORE v2 ENGINE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  For each startup:                                                      │
│                                                                         │
│  1. VALUE PROPOSITION (20 pts)                                          │
│     → What do they offer?                                               │
│     → Match startup description to known solution patterns              │
│     → Score by uniqueness & market fit                                  │
│                                                                         │
│  2. PROBLEM (20 pts)                                                    │
│     → Why do we care?                                                   │
│     → Match startup's industry to top problems                          │
│     → Score by problem severity they address                            │
│                                                                         │
│  3. SOLUTION (20 pts)                                                   │
│     → Show us your stuff!                                               │
│     → Compare to known effective solutions                              │
│     → Score by innovation & completeness                                │
│                                                                         │
│  4. TEAM (20 pts)                                                       │
│     → Who and why do we care?                                           │
│     → Match team profile to success patterns                            │
│     → Score by industry-specific team weighting                         │
│                                                                         │
│  5. INVESTMENT (20 pts)                                                 │
│     → Is the raise appropriate?                                         │
│     → Compare to stage/sector benchmarks                                │
│     → Apply AI multiplier if applicable                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema Additions

### 1. `market_problems` - Industry Pain Points
```sql
CREATE TABLE market_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry VARCHAR(100) NOT NULL,
  problem_rank INTEGER NOT NULL CHECK (problem_rank BETWEEN 1 AND 5),
  problem_title VARCHAR(255) NOT NULL,
  problem_description TEXT,
  severity_score INTEGER CHECK (severity_score BETWEEN 1 AND 10),
  source_urls TEXT[],
  keywords TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(industry, problem_rank)
);

-- Example data:
-- HealthTech | 1 | "Clinical trial efficiency" | "Drug trials take 10+ years..." | 9
-- HealthTech | 2 | "Data interoperability" | "EHR systems don't talk..." | 8
-- FinTech | 1 | "Cross-border payments" | "International transfers cost 5%+..." | 9
```

### 2. `solution_patterns` - What Works
```sql
CREATE TABLE solution_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID REFERENCES market_problems(id),
  solution_type VARCHAR(100) NOT NULL,
  solution_description TEXT,
  effectiveness_score INTEGER CHECK (effectiveness_score BETWEEN 1 AND 10),
  example_companies TEXT[],
  key_features TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example:
-- problem_id: [clinical trial] | "AI-powered patient matching" | 8 | ["Unlearn.ai", "Deep 6"]
```

### 3. `team_success_patterns` - Winning Team Profiles
```sql
CREATE TABLE team_success_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry VARCHAR(100) NOT NULL,
  pattern_name VARCHAR(100) NOT NULL,
  weight INTEGER CHECK (weight BETWEEN 1 AND 5),
  criteria JSONB, -- {"technical_cofounder": true, "domain_experience_years": 5, etc}
  example_exits TEXT[],
  source_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example:
-- AI/ML | "Technical PhD + Business MBA" | 5 | {"has_phd": true, "has_mba": true} | ["OpenAI", "Anthropic"]
-- FinTech | "Ex-banker + Engineer" | 4 | {"banking_experience": true, "engineering_background": true}
```

### 4. `investment_benchmarks` - Raise Appropriateness
```sql
CREATE TABLE investment_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry VARCHAR(100) NOT NULL,
  stage VARCHAR(50) NOT NULL,
  median_raise_min BIGINT,
  median_raise_max BIGINT,
  ai_multiplier DECIMAL(3,1) DEFAULT 1.0,
  valuation_multiple_low DECIMAL(4,1),
  valuation_multiple_high DECIMAL(4,1),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  source VARCHAR(255),
  UNIQUE(industry, stage)
);

-- Example:
-- AI/ML | Seed | 2000000 | 5000000 | 5.0 | 15.0 | 30.0 | Crunchbase Q4 2024
-- FinTech | Series A | 8000000 | 15000000 | 2.0 | 8.0 | 15.0
```

---

## Data Sources for Intelligence

### Market Problems
- **TechCrunch** - Startup pain points mentioned in funding stories
- **CB Insights** - Industry reports & problem analyses
- **Gartner/Forrester** - Market research on industry challenges
- **Reddit/HackerNews** - Real practitioner pain points
- **LinkedIn** - Industry professional discussions

### Solution Patterns
- **a16z, Sequoia, Bessemer** - Thesis documents
- **Product Hunt** - What solutions are launching
- **G2/Capterra** - What solutions users are adopting
- **Academic papers** - Novel solution approaches

### Team Patterns
- **Crunchbase exits** - Team profiles of successful exits
- **LinkedIn** - Career paths of unicorn founders
- **PitchBook** - Deal data with founder backgrounds

### Investment Benchmarks
- **Crunchbase** - Median raise by stage/sector
- **PitchBook** - Valuation multiples
- **AngelList** - Early-stage benchmarks
- **News** - AI premium tracking (5-10x vs traditional)

---

## Implementation Plan

### Phase 1: Fix the Breaking (Today)
1. **Stop score reset bug** - Modify `recalculate-scores.ts` to preserve existing scores if no new data
2. **Remove destructive cron** - Or make it additive, not reset

### Phase 2: Build Intelligence Layer (Week 1)
1. Create the 4 new tables via migration
2. Seed initial market problems for top 10 industries
3. Seed team success patterns from known exits

### Phase 3: Intelligence Gathering Scripts (Week 2)
1. `gather-market-problems.js` - Scrape analyst reports
2. `gather-solution-patterns.js` - Map solutions to problems
3. `gather-team-patterns.js` - Analyze successful founder profiles
4. `update-investment-benchmarks.js` - Track raise amounts by sector

### Phase 4: GOD Score v2 Engine (Week 3)
1. New scoring service that queries intelligence tables
2. Inference engine: "This SaaS startup in FinTech → matches problem #2 → solving with pattern X"
3. No more base-5 defaults - actual derived scores

---

## Quick Win: Fix Score Reset Today

```typescript
// In recalculate-scores.ts - ADD THIS CHECK
function calculateGODScore(startup: Startup): ScoreBreakdown | null {
  // If startup already has valid scores and no new data, PRESERVE them
  if (startup.total_god_score && startup.total_god_score > 29) {
    // Only recalculate if we have NEW data to add
    const hasNewData = startup.mrr || startup.customer_count || 
                       startup.team_companies?.length || startup.problem;
    if (!hasNewData) {
      return null; // Skip - don't reset to defaults
    }
  }
  
  // ... existing calculation logic
}
```

---

## Expected Outcome

| Before | After |
|--------|-------|
| 58% startups score < 50 | Meaningful distribution based on market fit |
| All base scores: 5/5/7/5/7 | Derived scores from intelligence |
| Daily resets to 29 | Stable, additive scoring |
| News scraping fails | Industry intelligence informs scoring |

---

*Architecture designed: December 18, 2024*
*Goal: Make GOD scores meaningful through market intelligence*
