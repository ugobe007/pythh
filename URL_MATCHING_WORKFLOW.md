# URL Submission → Matching Workflow

**Date:** January 28, 2026  
**Purpose:** Document how URL-based matching works vs database matching

---

## 🔄 TWO MATCHING MODES

### Mode 1: Database Matching (Demo Mode)
**Route:** `/` (no URL parameter)  
**Flow:**
```
User visits landing page
  ↓
MatchingEngine loads
  ↓
Queries: startup_investor_matches table
  WHERE status = 'suggested' AND score >= 20
  ↓
Shows pre-calculated matches (250k rows)
  ↓
User swipes through investor cards
```

**Data Source:** Batch-generated matches from `match-regenerator.js`

---

### Mode 2: URL Submission (Live Mode)
**Route:** `/?url=autoops.ai` (with URL parameter)  
**Flow:**
```
1. User enters startup URL in SplitScreenHero input
     ↓
2. URL submitted via form → navigate(`/?url=${url}`)
     ↓
3. MatchingEngine detects urlParam
     ↓
4. Calls API: /api/discovery/submit
     ↓
5. Server processes startup:
     a) Scrapes website
     b) Extracts 5-point value prop
     c) Calculates GOD score
     d) Stores in startup_uploads table
     ↓
6. Server generates matches:
     a) Queries investors table
     b) Calculates compatibility scores
     c) Creates matches in startup_investor_matches
     d) Sets status = 'suggested'
     ↓
7. MatchingEngine queries matches
     WHERE startup_id = {discovered_startup_id}
     AND status = 'suggested'
     ↓
8. Shows live-generated matches for THAT startup
```

---

## 📊 DATABASE TABLES INVOLVED

### 1. `startup_uploads` (Master Startup Registry)
**Purpose:** All startups (batch + discovered)

```sql
Columns:
- id (uuid, PK)
- name (text)
- website (text) -- URL submitted by user
- status (text) -- 'pending', 'approved', 'published'
- total_god_score (numeric) -- 0-100
- team_score, traction_score, market_score, product_score, vision_score
- sectors (text[] or jsonb)
- stage (integer or text)
- extracted_data (jsonb) -- Scraped/parsed data
- value_proposition, problem, solution, team, investment (text) -- 5 points
- created_at, updated_at
```

**Sources:**
- Batch upload (admin)
- URL discovery (user submission)
- API import

---

### 2. `investors` (Master Investor Registry)
**Purpose:** All VCs/angels in system

```sql
Columns:
- id (uuid, PK)
- name (text)
- firm (text)
- sectors (text[] or jsonb) -- Investment focus
- stage (text[] or text) -- Seed, Series A, etc.
- check_size_min, check_size_max (numeric)
- geography_focus (text)
- investor_score (numeric) -- Quality/tier score
- investor_tier (text) -- 'tier1', 'tier2', 'tier3'
- bio, linkedin_url, twitter_url
- created_at, updated_at
```

---

### 3. `startup_investor_matches` (Match Records)
**Purpose:** Pre-calculated or live-generated matches

```sql
Columns:
- id (uuid, PK)
- startup_id (uuid, FK → startup_uploads.id)
- investor_id (uuid, FK → investors.id)
- match_score (numeric) -- 0-100 compatibility
- status (text) -- 'suggested', 'viewed', 'contacted', 'passed'
- confidence_level (text) -- 'high', 'medium', 'low'
- reasoning (text[] or jsonb) -- Why they match
- fit_analysis (jsonb) -- Score breakdown
- created_at, updated_at
```

**Two Creation Paths:**

#### Path A: Batch Generation
```bash
node match-regenerator.js
```
- Loops through ALL startups × ALL investors
- Calculates scores (sector + stage + quality)
- Inserts 250k+ matches
- Sets status = 'suggested'

#### Path B: Live Discovery
```
User submits URL → API processes
  ↓
server/services/investorMatching.ts
  - calculateMatches(startup)
  - Queries investors matching criteria
  - Generates matches on-the-fly
  - Inserts to startup_investor_matches
  - Sets status = 'suggested'
```

---

## 🎯 MATCHING SCORE CALCULATION

### Components (from match-regenerator.js):

```javascript
// 1. Sector Match (0-40 points)
const sectorScore = calculateSectorMatch(startup.sectors, investor.sectors);
// Exact match: 40, Partial: 20-30, None: 0

// 2. Stage Match (0-30 points)  
const stageScore = calculateStageMatch(startup.stage, investor.stage);
// Match: 30, Adjacent: 15, Far: 0

// 3. Investor Quality (0-20 points)
const investorQuality = calculateInvestorQuality(
  investor.investor_score, 
  investor.investor_tier
);
// Tier 1: 20, Tier 2: 15, Tier 3: 10

// 4. Startup Quality (0-10 points)
const startupQuality = calculateStartupQuality(startup.total_god_score);
// GOD 80+: 10, 60-80: 8, 40-60: 6, <40: 3

// Total Match Score (0-100)
const totalScore = sectorScore + stageScore + investorQuality + startupQuality;
```

**Minimum Threshold:** 20 points (configurable)

---

## 🔗 HOW GOD SCORE INTEGRATES

### GOD Score Calculation (server/services/startupScoringService.ts):

```typescript
total_god_score = (
  team_score +        // 0-20 points
  traction_score +    // 0-20 points  
  market_score +      // 0-20 points
  product_score +     // 0-20 points
  vision_score        // 0-20 points
) // = 0-100
```

**When Calculated:**
1. **URL Submission:** Immediately after scraping
2. **Batch Processing:** Via `scripts/recalculate-scores.ts`
3. **Manual Update:** Admin can trigger

**Used In Matching:**
- Contributes to `startupQuality` component (0-10 points)
- Higher GOD score = Higher match scores
- Threshold: GOD < 40 gets lowest quality boost

---

## 🚦 STATUS FIELD WORKFLOW

### Match Lifecycle:
```
'suggested' (initial)
    ↓
'viewed' (user saw it)
    ↓
'contacted' (user reached out)
    ↓
'intro_requested' (user wants warm intro)
    ↓
'passed' (user rejected)
```

**Critical:** All queries filter by `status = 'suggested'` to show only fresh matches.

---

## 🎨 UI COMPONENTS & DATA FLOW

### Component Hierarchy:
```
LandingPage (/)
  └─ MatchingEngine.tsx
      ├─ SplitScreenHero (URL input)
      ├─ LiveMatchingStrip (proof of live matching) ← TO ADD
      ├─ LongitudinalMatchPair (main match card)
      └─ HomeProofFeed (founder testimonials)

SignalRadarPage (/signals-radar)
  ├─ TopBar (URL input for signals)
  ├─ LiveMatchingStrip (live proof) ← ALREADY ADDED
  ├─ MatchEngineStrip (subset of matches)
  └─ 3-column grid (signals display)
```

### Data Flow:
```
URL Input (SplitScreenHero)
  ↓ [submit event]
navigate(`/?url=${url}`)
  ↓
MatchingEngine detects urlParam
  ↓
useEffect triggers loadMatches()
  ↓
API call: /api/discovery/submit
  ↓ [server processing]
Startup created + Matches generated
  ↓
MatchingEngine queries matches
  WHERE startup_id = {id}
  ↓
LongitudinalMatchPair renders cards
```

---

## 🛠️ KEY API ENDPOINTS

### `/api/discovery/submit`
**Method:** POST  
**Payload:** `{ url: "autoops.ai" }`  
**Returns:** `{ startup_id, match_count, job_id }`

**What It Does:**
1. Scrapes website
2. Extracts data (5 points, team, traction)
3. Calculates GOD score
4. Stores startup
5. Generates matches
6. Returns results

---

### `/api/discovery/results`
**Method:** GET  
**Query:** `?job_id=xxx`  
**Returns:** Scraping/matching status

**Used For:** Polling long-running jobs

---

## 🎯 NEXT STEPS

### Task 1: Add LiveMatchingStrip to Main Page
**Location:** After `SplitScreenHero`, before `LongitudinalMatchPair`  
**Purpose:** Show live proof of matching happening  
**Replace:** HomeProofFeed (don't stack elements)

### Task 2: Keep LiveMatchingStrip on Signal Radar
**Status:** Already added ✅  
**Location:** After URL input bar

### Task 3: Map URL Submission Flow
**Status:** Documented above ✅

---

## 📝 IMPLEMENTATION NOTES

**URL Input Component:**
- Lives in `SplitScreenHero.tsx`
- Submits to `/?url=` route parameter
- MatchingEngine detects via `useSearchParams()`

**Match Display:**
- `LongitudinalMatchPair` = full card view (1 at a time)
- `MatchEngineStrip` = horizontal strip (multiple)
- `LiveMatchingStrip` = auto-rotating proof (2 side-by-side)

**Differences:**
- **Demo Mode:** Shows ALL matches (no filtering by startup)
- **URL Mode:** Shows matches for THAT startup only
- **Both:** Query `status='suggested'` for fresh matches

---

*Workflow documented by AI Assistant - January 28, 2026*
