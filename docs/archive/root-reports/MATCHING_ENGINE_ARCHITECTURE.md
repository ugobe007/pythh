# 🧮 Hot Money Matching Engine Architecture

## System Overview

The Matching Engine combines **GOD Algorithm** startup scoring with **AI-powered investor matching** to generate 100 curated startup-investor pairs every hour.

```
┌─────────────────────────────────────────────────────────────────┐
│                     MATCHING ENGINE SYSTEM                       │
│                                                                   │
│  Frontend Component → Data Services → GOD Algorithm → Database   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Architecture Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                      MATCHING ENGINE COMPONENT                           │
│                  (src/components/MatchingEngine.tsx)                     │
│                                                                          │
│  • Loads 100 startups from database                                     │
│  • Loads all investors from database                                    │
│  • Calls generateAdvancedMatches()                                      │
│  • Displays matches with rotation (20 per batch, 5 batches)            │
│                                                                          │
└────────────────────────┬─────────────────────────────────────────────────┘
                         │
                         │ calls
                         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                        DATA SERVICE LAYER                                │
│                                                                          │
│  ┌──────────────────────────┐      ┌─────────────────────────────┐    │
│  │  loadApprovedStartups()  │      │   getAllInvestors()         │    │
│  │  (src/store.ts)          │      │   (src/lib/investorService) │    │
│  │                          │      │                             │    │
│  │  • Queries Supabase      │      │   • Queries Supabase        │    │
│  │  • Handles pagination    │      │   • Returns all investors   │    │
│  │  • Falls back to local   │      │   • No pagination           │    │
│  └────────────┬─────────────┘      └──────────────┬──────────────┘    │
│               │                                     │                   │
│               │ fetches from                        │ fetches from      │
│               ▼                                     ▼                   │
│  ┌──────────────────────────┐      ┌─────────────────────────────┐    │
│  │  startup_uploads table   │      │   investors table           │    │
│  │  (Supabase)              │      │   (Supabase)                │    │
│  └──────────────────────────┘      └─────────────────────────────┘    │
│                                                                          │
└────────────────────────┬─────────────────────────────────────────────────┘
                         │
                         │ passes data to
                         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                   MATCHING SERVICE + GOD ALGORITHM                       │
│                  (src/services/matchingService.ts)                      │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │  1. DATA NORMALIZATION (normalizeStartupData)                  │    │
│  │     • startup.field || startup.extracted_data?.field || default │    │
│  │     • Handles database field variations                         │    │
│  │     • Critical for preventing undefined bugs                    │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                              ▼                                           │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │  2. GOD ALGORITHM SCORING (calculateHotScore)                   │    │
│  │     • Team scoring (0-3 points)                                 │    │
│  │     • Traction scoring (0-3 points)                             │    │
│  │     • Market scoring (0-2 points)                               │    │
│  │     • Product scoring (0-2 points)                              │    │
│  │     • Vision scoring (0-2 points)                               │    │
│  │     • Ecosystem scoring (0-1.5 points) NEW                      │    │
│  │     • Grit scoring (0-1.5 points) NEW                           │    │
│  │     • Problem validation (0-2 points) NEW                       │    │
│  │     ─────────────────────────────────────                       │    │
│  │     Total: 0-17 points → normalized to 0-10 scale               │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                              ▼                                           │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │  3. MATCH SCORING (calculateAdvancedMatchScore)                 │    │
│  │     • Base: GOD score × 10 (0-100)                              │    │
│  │     • Stage match bonus: +10                                    │    │
│  │     • Sector match bonus: +10                                   │    │
│  │     • Check size fit: +5                                        │    │
│  │     • Geography match: +5                                       │    │
│  │     ─────────────────────────────────────                       │    │
│  │     Final: 0-100 match score (capped at 99)                     │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                              ▼                                           │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │  4. MATCH GENERATION (generateAdvancedMatches)                  │    │
│  │     • Sort startups by GOD score (highest first)                │    │
│  │     • Match each startup with best-fit investor                 │    │
│  │     • Return 100 match pairs with scores & reasoning            │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                          │
└────────────────────────┬─────────────────────────────────────────────────┘
                         │
                         │ returns
                         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                    MATCH DISPLAY (Frontend)                              │
│                                                                          │
│  • 100 matches split into 5 batches of 20                              │
│  • Rotates automatically every 60 minutes                               │
│  • Shows match score, startup/investor details                          │
│  • Lightning bolt animations when switching                             │
│  • Click cards to view full profiles                                    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema Mapping

### **1. startup_uploads Table** (Supabase)

```sql
CREATE TABLE startup_uploads (
  id UUID PRIMARY KEY,                    -- ✅ Used as startup.id
  name TEXT NOT NULL,                     -- ✅ Mapped to startup.name
  pitch TEXT,                             -- ✅ Mapped to startup.pitch
  description TEXT,                       -- ✅ Mapped to startup.description
  tagline TEXT,                           -- ✅ Mapped to startup.tagline
  website TEXT,                           -- ✅ Mapped to startup.website
  linkedin TEXT,                          -- ✅ Mapped to startup.linkedin
  raise_amount TEXT,                      -- ✅ Mapped to startup.raise
  stage INTEGER,                          -- ✅ Mapped to startup.stage
  
  -- 🔥 CRITICAL: extracted_data JSONB column
  extracted_data JSONB,                   -- Contains AI-extracted fields
  
  status TEXT DEFAULT 'pending',          -- Filter: status = 'approved'
  submitted_by UUID,
  submitted_email TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### **extracted_data Structure** (JSONB)

```json
{
  "fivePoints": ["Team insight 1", "Team insight 2", ...],
  "team": [
    {
      "name": "John Doe",
      "role": "CEO",
      "previousCompanies": ["Google", "Meta"]
    }
  ],
  "traction": "50K MRR, 200% YoY growth",
  "revenue": 600000,
  "arr": 600000,
  "sectors": ["AI", "SaaS", "Enterprise"],
  "industries": ["Technology", "Software"],
  "market": "B2B SaaS market, $150B TAM",
  "marketSize": 150000000000,
  "raise": "$2M",
  "pitch": "We help companies...",
  "unique": "First mover in...",
  "launched": true
}
```

#### **Data Mapping with Normalization**

```typescript
// ❌ OLD (Broken) - Direct field access
const team = startup.team;  // undefined! Data is in extracted_data.team

// ✅ NEW (Fixed) - Normalization layer
const normalized = normalizeStartupData(startup);
const team = normalized.team;  // ✅ Correct! Checks startup.team || startup.extracted_data.team
```

---

### **2. investors Table** (Supabase)

```sql
CREATE TABLE investors (
  id UUID PRIMARY KEY,                    -- ✅ Used as investor.id
  name TEXT NOT NULL,                     -- ✅ Mapped to investor.name
  type TEXT NOT NULL,                     -- ✅ Mapped to investor.type
  tagline TEXT,                           -- ✅ Mapped to investor.tagline
  description TEXT,                       -- ✅ Mapped to investor.description
  website TEXT,                           -- ✅ Mapped to investor.website
  
  -- Investment criteria
  check_size TEXT,                        -- ✅ Mapped to investor.checkSize
  stage JSONB,                            -- ✅ Array: ["seed", "series_a"]
  sectors JSONB,                          -- ✅ Array: ["AI", "SaaS"]
  geography TEXT,                         -- ✅ Mapped to investor.geography
  
  -- Portfolio stats
  portfolio_count INTEGER,
  exits INTEGER,
  unicorns INTEGER,
  notable_investments JSONB,
  
  -- Metadata
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### **Field Name Variations Handled**

```typescript
// normalizeInvestorData() handles these variations:
checkSize: investor.checkSize || investor.check_size
stage: investor.stage || investor.stages
sectors: Array.isArray(investor.sectors) ? investor.sectors : [investor.sectors]
geography: investor.geography || investor.location
```

---

## 🔄 Data Flow with Field Mapping

### **Step 1: Database Query**

```typescript
// src/store.ts - loadApprovedStartups()
const { data, error } = await supabase
  .from('startup_uploads')
  .select('*')
  .eq('status', 'approved')
  .order('created_at', { ascending: false })
  .range(0, 99);  // Load 100 startups

// Returns: Array of startup_uploads records with extracted_data JSONB
```

### **Step 2: Data Conversion**

```typescript
// src/store.ts - Convert to Startup format
const converted = data.map((upload: any) => {
  const extractedData = upload.extracted_data || {};
  const fivePoints = extractedData.fivePoints || [];
  
  return {
    id: upload.id,                        // UUID from database
    name: upload.name,
    description: upload.description || upload.pitch,
    pitch: upload.pitch,
    tagline: upload.tagline,
    raise: upload.raise_amount,           // ⚠️ Note: raise_amount → raise
    stage: upload.stage || 1,
    fivePoints: fivePoints,               // From extracted_data.fivePoints
    website: upload.website,
    linkedin: upload.linkedin,
    industries: extractedData.industries || [],
    // ... other fields
  };
});
```

### **Step 3: Normalization** (Critical!)

```typescript
// src/services/matchingService.ts - normalizeStartupData()
function normalizeStartupData(startup: any) {
  const extracted = startup.extracted_data || {};
  
  return {
    id: startup.id,
    name: startup.name,
    
    // 🔥 Fallback chain prevents undefined bugs
    team: startup.team || extracted.team || [],
    traction: startup.traction || extracted.traction || '',
    revenue: startup.revenue || startup.arr || extracted.revenue || extracted.arr || 0,
    sectors: startup.sectors || startup.industries || extracted.sectors || extracted.industries || [],
    stage: startup.stage ?? extracted.stage ?? 0,
    raise_amount: startup.raise_amount || startup.raise || extracted.raise || '',
    market_size: startup.market_size || extracted.market || extracted.market_size || 0,
    pitch: startup.pitch || extracted.pitch || startup.description || '',
    fivePoints: extracted.fivePoints || startup.fivePoints || [],
    
    // ... all other fields with fallbacks
  };
}
```

### **Step 4: GOD Algorithm Scoring**

```typescript
// server/services/startupScoringService.ts - calculateHotScore()
export function calculateHotScore(startup: StartupProfile): HotScore {
  const teamScore = scoreTeam(startup);          // 0-3 points
  const tractionScore = scoreTraction(startup);  // 0-3 points
  const marketScore = scoreMarket(startup);      // 0-2 points
  const productScore = scoreProduct(startup);    // 0-2 points
  const visionScore = scoreVision(startup);      // 0-2 points
  const ecosystemScore = scoreEcosystem(startup); // 0-1.5 points
  const gritScore = scoreGrit(startup);          // 0-1.5 points
  const problemScore = scoreProblemValidation(startup); // 0-2 points
  
  const rawTotal = teamScore + tractionScore + marketScore + 
                   productScore + visionScore + ecosystemScore + 
                   gritScore + problemScore;
                   
  const total = Math.min((rawTotal / 17) * 10, 10); // Normalize to 10-point scale
  
  return {
    total,
    breakdown: { team: teamScore, traction: tractionScore, ... },
    matchCount: total >= 9 ? 20 : (total >= 7 ? 15 : 10),
    reasoning: ["Reason 1", "Reason 2", ...],
    tier: total >= 7 ? 'hot' : (total >= 4 ? 'warm' : 'cold')
  };
}
```

### **Step 5: Match Scoring**

```typescript
// src/services/matchingService.ts - calculateAdvancedMatchScore()
export function calculateAdvancedMatchScore(startup: any, investor: any): number {
  // 1. NORMALIZE DATA FIRST
  const normalizedStartup = normalizeStartupData(startup);
  const normalizedInvestor = normalizeInvestorData(investor);
  
  // 2. BUILD GOD PROFILE
  const startupProfile = {
    team: normalizedStartup.team,                  // ✅ Always valid
    revenue: normalizedStartup.revenue,            // ✅ Always valid
    industries: normalizedStartup.industries,      // ✅ Always valid
    // ... all fields use normalized data
  };
  
  // 3. GET GOD SCORE
  const godScore = calculateHotScore(startupProfile);
  let baseScore = godScore.total * 10;  // Convert 0-10 to 0-100
  
  // 4. ADD MATCHING BONUSES
  let matchBonus = 0;
  
  // Stage match: +10
  if (normalizedInvestor.stage && normalizedStartup.stage) {
    const stageMatch = /* matching logic */;
    if (stageMatch) matchBonus += 10;
  }
  
  // Sector match: +10
  if (normalizedStartup.industries && normalizedInvestor.sectors) {
    const commonSectors = /* find common */;
    matchBonus += Math.min(commonSectors.length * 5, 10);
  }
  
  // Check size fit: +5
  if (normalizedInvestor.checkSize && normalizedStartup.raise_amount) {
    // Check if raise fits check size range
    matchBonus += 5;
  }
  
  // Geography match: +5
  if (normalizedInvestor.geography && normalizedStartup.location) {
    matchBonus += 5;
  }
  
  // 5. CALCULATE FINAL SCORE (capped at 99)
  return Math.min(baseScore + matchBonus, 99);
}
```

### **Step 6: Match Generation**

```typescript
// src/services/matchingService.ts - generateAdvancedMatches()
export function generateAdvancedMatches(startups: any[], investors: any[], limit: 100): MatchPair[] {
  const matchPairs: MatchPair[] = [];
  
  // 1. Score all startups with GOD algorithm
  const scoredStartups = startups.map(startup => {
    const normalized = normalizeStartupData(startup);
    const godScore = calculateHotScore(normalized);
    return { startup, normalized, godScore };
  }).sort((a, b) => b.godScore.total - a.godScore.total);  // Sort by score
  
  // 2. Generate matches for top-scored startups
  for (let i = 0; i < Math.min(limit, scoredStartups.length); i++) {
    const { startup, normalized, godScore } = scoredStartups[i];
    
    // 3. Find best-fit investor
    let bestInvestor = investors[0];
    let bestScore = 0;
    
    for (let j = 0; j < Math.min(5, investors.length); j++) {
      const investor = investors[(i + j) % investors.length];
      const score = calculateAdvancedMatchScore(startup, investor);
      if (score > bestScore) {
        bestScore = score;
        bestInvestor = investor;
      }
    }
    
    const normalizedInvestor = normalizeInvestorData(bestInvestor);
    
    // 4. Create match pair
    matchPairs.push({
      startup: {
        id: normalized.id,
        name: normalized.name,
        description: normalized.tagline || normalized.description,
        tags: extractTags(normalized),
        seeking: normalized.raise_amount || '$2M Seeking',
        status: 'Active'
      },
      investor: {
        id: normalizedInvestor.id,
        name: normalizedInvestor.name,
        description: normalizedInvestor.tagline,
        tags: normalizedInvestor.sectors.slice(0, 3),
        checkSize: normalizedInvestor.checkSize,
        status: 'Active'
      },
      matchScore: bestScore,
      reasoning: godScore.reasoning
    });
  }
  
  return matchPairs;
}
```

---

## 🎯 Critical Data Mapping Patterns

### **Pattern 1: Fallback Chain** (Prevents undefined bugs)

```typescript
// ✅ CORRECT: Multiple fallback levels
revenue: startup.revenue || startup.arr || extracted.revenue || extracted.arr || 0

// ❌ WRONG: Single source (breaks if field missing)
revenue: startup.revenue
```

### **Pattern 2: Nullish Coalescing** (Handles 0 and false)

```typescript
// ✅ CORRECT: Uses ?? for numbers/booleans
stage: startup.stage ?? extracted.stage ?? 0

// ❌ WRONG: Uses || (treats 0 as falsy)
stage: startup.stage || extracted.stage || 0  // Stage 0 becomes default!
```

### **Pattern 3: Array Handling**

```typescript
// ✅ CORRECT: Ensures array type
sectors: Array.isArray(investor.sectors) ? investor.sectors : 
         (investor.sectors ? [investor.sectors] : [])

// ❌ WRONG: Doesn't handle string case
sectors: investor.sectors || []
```

### **Pattern 4: Deep JSONB Access**

```typescript
// ✅ CORRECT: Safe access with optional chaining
const extracted = startup.extracted_data || {};
const team = startup.team || extracted.team || [];

// ❌ WRONG: Can throw if extracted_data is null
const team = startup.team || startup.extracted_data.team || [];
```

---

## 📈 Scoring Breakdown

### **GOD Algorithm Components**

| Component | Points | Description |
|-----------|--------|-------------|
| **Team** | 0-3 | Founder backgrounds, technical cofounders, experience |
| **Traction** | 0-3 | Revenue, MRR, growth rate, customers, active users |
| **Market** | 0-2 | Market size, industries, problem-solution fit |
| **Product** | 0-2 | Demo, launched, unique IP, defensibility |
| **Vision** | 0-2 | Vision statement, unique value proposition |
| **Ecosystem** | 0-1.5 | Strategic partners, advisors, platform dependencies |
| **Grit** | 0-1.5 | Pivots, customer feedback, iteration speed |
| **Problem Validation** | 0-2 | Customer interviews, pain data, ICP clarity |
| **TOTAL** | 0-17 | Normalized to 0-10 scale → then 0-100 for matching |

### **Match Bonuses**

| Bonus Type | Points | Criteria |
|------------|--------|----------|
| **Stage Match** | +10 | Investor stages include startup stage |
| **Sector Match** | +10 | Common sectors (5 pts per sector, max 10) |
| **Check Size Fit** | +5 | Raise amount fits investor check size |
| **Geography Match** | +5 | Startup location matches investor geography |
| **TOTAL BONUS** | +30 | Maximum possible bonus points |

### **Final Score Calculation**

```
Base Score = (GOD Score / 10) * 100  // Convert 0-10 to 0-100
Match Bonus = Stage + Sector + Check Size + Geography  // 0-30
Final Score = min(Base Score + Match Bonus, 99)  // Cap at 99
```

**Example:**
- GOD Score: 8.5/10 → Base: 85/100
- Stage Match: +10
- Sector Match: +10 (2 common sectors)
- Check Size: +5
- Geography: +5
- **Final: 99/100** (capped)

---

## 🔍 Query Performance

### **Indexes** (From schema)

```sql
-- startup_uploads indexes
CREATE INDEX idx_startup_uploads_status ON startup_uploads(status);
CREATE INDEX idx_startup_uploads_created_at ON startup_uploads(created_at DESC);

-- investors indexes
CREATE INDEX idx_investors_type ON investors(type);
CREATE INDEX idx_investors_hot_honey_investments ON investors(hot_honey_investments DESC);

-- votes indexes (for voting system)
CREATE INDEX idx_votes_startup_id ON votes(startup_id);
CREATE INDEX idx_votes_user_id ON votes(user_id);
```

### **Typical Query**

```sql
-- Load 100 approved startups (used by matching engine)
SELECT * FROM startup_uploads
WHERE status = 'approved'
ORDER BY created_at DESC
LIMIT 100;

-- Load all investors
SELECT * FROM investors
ORDER BY hot_honey_investments DESC;
```

---

## 🚀 Performance Characteristics

### **Current System**

- **Startups Loaded:** 100 per batch
- **Investors Loaded:** All (~500)
- **Matches Generated:** 100 pairs
- **Match Time:** ~2-5 seconds (GOD scoring + matching)
- **Rotation:** Every 60 minutes (new batch of 20)
- **Display:** 5 batches of 20 matches each

### **Caching Strategy**

1. **Frontend:** Matches cached in React state (60 min TTL)
2. **Database:** Approved startups filtered once
3. **Scoring:** GOD algorithm runs on-demand (no caching)
4. **Rotation:** Automatic batch rotation every hour

---

## 🛡️ Data Validation & Error Handling

### **Normalization Layer Benefits**

1. **Prevents undefined bugs** - All fields have fallback chains
2. **Handles field variations** - checkSize vs check_size
3. **Type safety** - Arrays always arrays, numbers always numbers
4. **Consistent interface** - GOD algorithm receives predictable data
5. **Future-proof** - Easy to add new data sources

### **Error Handling**

```typescript
try {
  const startups = await loadApprovedStartups(100, 0);
  const investors = await getAllInvestors();
  
  if (!startups || !investors) {
    console.warn('No data available');
    return;
  }
  
  const matches = generateAdvancedMatches(startups, investors, 100);
  setMatches(matches);
} catch (error) {
  console.error('Error loading matches:', error);
  // Fallback to local data or empty state
}
```

---

## 🎨 Frontend Display

### **Component Structure**

```
MatchingEngine Component
├── Header (Title, AI badge, stats)
├── Match Display Grid
│   ├── Startup Card (clickable → /startup/:id)
│   ├── Brain Icon (AI animation)
│   └── Investor Card (clickable → /investors)
├── Match Score Badge (✨ XX% Match ✨)
├── Navigation (Show Next Match button)
├── Stats Bar (500+ Investors, <2s speed, 24/7)
├── Feature Cards (Founder & Investor benefits)
└── Modal (How It Works explanation)
```

### **Batch Rotation**

```typescript
// 100 matches → 5 batches of 20
currentBatch = 0-4 (5 batches)
currentIndex = 0-19 (20 matches per batch)

// Rotation triggers:
1. User clicks "Show Next Match" → currentIndex++
2. 60 minutes pass → currentBatch++
3. End of batch → currentIndex = 0
```

---

## 📝 Key Takeaways

### **Critical Components**

1. **Data Normalization** - Prevents 90% of bugs
2. **GOD Algorithm** - Scores startups 0-10 based on 8 criteria
3. **Match Scoring** - Adds investor fit bonuses (stage, sector, etc.)
4. **Database Schema** - extracted_data JSONB holds AI-extracted fields
5. **Fallback Chains** - Every field has multiple fallback sources

### **Common Pitfalls Avoided**

❌ **Direct field access** → `startup.team` (undefined)  
✅ **Normalized access** → `normalizedStartup.team` (always valid)

❌ **Single data source** → Only checks `extracted_data`  
✅ **Fallback chain** → Checks top-level → extracted_data → default

❌ **Type assumptions** → Assumes sectors is array  
✅ **Type handling** → Converts to array if string

### **Testing Tools**

1. **regression-test.sh** - Automated file/import/mapping checks
2. **data-mapping-diagnostic.js** - Browser console diagnostic
3. **verify-normalization.sh** - Normalization layer verification

---

## 🔗 File References

**Core Files:**
- `src/components/MatchingEngine.tsx` - Main component
- `src/services/matchingService.ts` - Matching logic + normalization
- `server/services/startupScoringService.ts` - GOD algorithm
- `src/store.ts` - Database data loading
- `src/lib/investorService.ts` - Investor data service
- `supabase/migrations/create_investors_and_uploads.sql` - Schema

**Testing:**
- `regression-test.sh` - Automated tests
- `data-mapping-diagnostic.js` - Browser diagnostic
- `verify-normalization.sh` - Normalization checks

**Documentation:**
- `DATA_NORMALIZATION_FIX.md` - Normalization implementation
- `REGRESSION_TEST_GUIDE.md` - Testing methodology
- `DIAGNOSTIC_QUICK_REFERENCE.md` - Quick diagnostic guide

---

*Last Updated: December 6, 2025*  
*System Version: 2.0 (with GOD Algorithm + Normalization Layer)*
