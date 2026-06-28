# 🔥 HOT MONEY 5-POINT FORMAT INTEGRATION

## Overview

Complete integration of the Hot Money 5-point format across the entire platform pipeline:
**RSS Scraping → AI Extraction → GOD Algorithm → Matching Engine**

## The 5-Point Format

Every startup is evaluated on these 5 critical points:

1. **VALUE PROPOSITION** - One-line tagline (e.g., "Tesla for home solar")
2. **PROBLEM** - Specific customer pain being solved
3. **SOLUTION** - How they solve it (unique approach/technology)
4. **MARKET SIZE** - TAM/market opportunity (e.g., "$280B mental health market")
5. **TEAM COMPANIES** - Notable previous employers of founders/team

## System Architecture

```
┌─────────────────┐
│   RSS Feeds     │ (TechCrunch, VentureBeat, etc.)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AI Scraper     │ GPT-4 extracts startup data + 5 points
│  (OpenAI)       │ 
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ discovered_     │ Stores scraped data with 5-point format
│ startups table  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ GOD Algorithm   │ Scores startups (bonus for 5-point quality)
│ (Scoring)       │ Returns 0-100 score + tier (HOT/WARM/COLD)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Admin Review    │ Approve high-scoring startups
│                 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ startup_uploads │ Approved startups with 5-point data
│ table (approved)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Matching Engine │ Uses 5-point data to match with investors
│                 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Vote Page      │ Displays startups with 5-point format
│  (User UI)      │
└─────────────────┘
```

## Database Schema

### discovered_startups table
```sql
-- Core fields
id UUID PRIMARY KEY
name TEXT
website TEXT
description TEXT

-- 🔥 HOT MONEY 5-POINT FORMAT
value_proposition TEXT
problem TEXT
solution TEXT
market_size TEXT
team_companies TEXT[]
sectors TEXT[]

-- Funding info
funding_amount TEXT
funding_stage TEXT
investors_mentioned TEXT[]

-- GOD scoring
god_score INTEGER (0-100)
god_score_breakdown JSONB
god_score_reasoning TEXT[]

-- Source tracking
article_url TEXT
article_title TEXT
rss_source TEXT
discovered_at TIMESTAMP
```

### startup_uploads table
```sql
-- Inherits all fields above, plus:
status TEXT (pending/approved/rejected)
submitted_email TEXT
raise_amount TEXT
raise_type TEXT
```

## Usage

### 1. Run Discovery with 5-Point Format

```bash
node discover-with-5points.js
```

This will:
- ✅ Scrape RSS feeds
- ✅ Extract 5-point format using AI
- ✅ Score with GOD algorithm
- ✅ Save to `discovered_startups` table

### 2. Review in Admin Dashboard

Navigate to `/admin/discovered` to see:
- All discovered startups
- GOD scores (0-100)
- Complete 5-point format
- Source articles

### 3. Approve Startups

Click "Approve" on high-scoring startups to move them to `startup_uploads` table with status='approved'

### 4. Display on Vote Page

Approved startups automatically appear on `/vote` with:
- Simple list display of 5 points (white text)
- GOD score badge
- Vote buttons
- Sectors/tags

## AI Extraction Prompt

The scraper uses this prompt structure:

```
Extract these 5 specific points for investor evaluation:

1. VALUE_PROPOSITION: One-line tagline
2. PROBLEM: What specific customer pain are they solving?
3. SOLUTION: How do they solve it?
4. MARKET_SIZE: TAM/market opportunity
5. TEAM_COMPANIES: Notable previous companies of founders

Response format:
{
  "startups": [
    {
      "name": "Company Name",
      "five_point_format": {
        "value_proposition": "...",
        "problem": "...",
        "solution": "...",
        "market_size": "...",
        "team_companies": ["Tesla", "Google"]
      }
    }
  ]
}
```

## GOD Algorithm Scoring

The GOD algorithm gives **bonus points** for 5-point format quality:

```typescript
// 5-Point Format Bonus (up to 2.5 points)
- Problem/Value Prop: 0-0.5 pts (based on detail/length)
- Solution: 0-0.5 pts
- Market Size: 0.5 pts if present
- Team Companies: 0.2-0.5 pts (based on count)
- Investment Amount: 0.5 pts if present
```

Total GOD score breakdown:
- Team: 0-3 pts
- Traction: 0-3 pts
- Market: 0-2 pts
- Product: 0-2 pts
- Vision: 0-2 pts
- Problem Validation: 0-2 pts
- **5-Point Bonus: 0-2.5 pts** ⭐

Final score normalized to 0-100 scale.

## Frontend Display

The StartupCardOfficial component shows 5 points as simple list:

```tsx
<div className="space-y-1">
  <p className="text-white font-bold text-sm">{value_proposition}</p>
  <p className="text-white font-bold text-sm">{market_size}</p>
  <p className="text-white font-bold text-sm">{solution}</p>
  <p className="text-white font-bold text-sm">{team_companies.join(', ')}</p>
  <p className="text-white font-bold text-sm">💰 {raise_amount}</p>
</div>
```

## Matching Engine Integration

The matching engine can use 5-point data for better matches:

```typescript
// Match investors to startups based on:
- Sectors (from 5-point extraction)
- Problem domain (healthcare, fintech, etc.)
- Team pedigree (FAANG backgrounds, etc.)
- Market size (seed vs. growth stage)
- Stage (based on funding_amount)
```

## Files Modified

1. **server/services/startupDiscoveryService.ts** - AI extraction with 5-point format
2. **server/services/startupScoringService.ts** - GOD scoring with 5-point bonus
3. **src/components/StartupCardOfficial.tsx** - Display 5-point format
4. **src/store.ts** - Data mapping for 5-point fields
5. **discover-with-5points.js** - New unified discovery script

## Database Migrations

Run these migrations:

```bash
# Add 5-point fields to discovered_startups
psql $DATABASE_URL -f supabase-add-5point-to-discovered.sql

# Add 5-point fields to startup_uploads (already done)
# Fields: value_proposition, problem, solution, market_size, team_companies
```

## Testing

Test the complete pipeline:

```bash
# 1. Run discovery
node discover-with-5points.js

# 2. Check database
SELECT name, value_proposition, market_size, god_score 
FROM discovered_startups 
ORDER BY god_score DESC 
LIMIT 10;

# 3. Approve a startup
UPDATE startup_uploads 
SET status = 'approved' 
WHERE name = 'Test Startup';

# 4. Clear localStorage and view on frontend
# Open browser console:
localStorage.clear()
location.reload()
```

## Benefits

✅ **Structured Data** - Consistent format across all startups
✅ **Better Scoring** - GOD algorithm rewards quality 5-point data
✅ **Improved Matching** - More data points for investor-startup matching
✅ **User Experience** - Clean, simple display on vote cards
✅ **Automated Pipeline** - From RSS to approved startups with minimal manual work

## Next Steps

1. **Add more RSS sources** - Expand discovery reach
2. **Enhance matching** - Use 5-point data for better investor matches
3. **A/B test display** - Optimize how 5 points are shown
4. **Add validation** - Ensure 5-point data quality before approval
5. **Export for investors** - Generate reports using 5-point format

## Support

For issues or questions, check:
- GOD_SCORE_INTEGRATION_COMPLETE.md
- STARTUP_DISCOVERY_GUIDE.md
- DATABASE_SEEDING_GUIDE.md
