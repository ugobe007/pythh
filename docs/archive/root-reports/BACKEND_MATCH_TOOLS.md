# Backend Match Tools for Startups & Investors 🚀

## Overview

Comprehensive backend services for startups and investors to search, filter, investigate, and analyze their matches. These tools enable users to find the perfect match and make data-driven decisions.

---

## Services Created

### 1. **Startup Match Search Service** (`startupMatchSearchService.ts`)

**Purpose:** Allows startup founders to search and filter their investor matches with advanced criteria.

**Key Functions:**

#### `searchStartupMatches(startupId, filters)`
Search matches with comprehensive filtering:
- **Score filters**: min/max score, confidence level
- **Investor filters**: tier, type, leads rounds, active status
- **Sector/Stage filters**: sectors, stages, geography
- **Check size filters**: min/max check size
- **Portfolio fit**: similar, complementary, gap, any
- **Sorting**: by score, recent, investor tier, check size
- **Pagination**: limit and offset

**Example:**
```typescript
const { matches, total } = await searchStartupMatches(startupId, {
  minScore: 60,
  confidenceLevel: 'high',
  investorTier: 'elite',
  leadsRounds: true,
  sectors: ['fintech', 'saas'],
  sortBy: 'score',
  sortOrder: 'desc',
  limit: 50,
});
```

#### `getTopStartupMatches(startupId, limit)`
Get top matches (simplified, no filters).

#### `getStartupMatchStats(startupId)`
Get comprehensive statistics:
- Total matches
- Confidence distribution
- Average score
- Top sectors
- Top investor tiers
- Score distribution

---

### 2. **Investor Match Search Service** (`investorMatchSearchService.ts`)

**Purpose:** Allows investors to search and filter their startup matches with advanced criteria.

**Key Functions:**

#### `searchInvestorMatches(investorId, filters)`
Search matches with comprehensive filtering:
- **Score filters**: min/max score, confidence level
- **Startup quality**: min/max GOD score, GOD score ranges (elite/high/quality/good)
- **Sector/Stage filters**: sectors, stages, geography
- **Traction filters**: revenue, MRR, ARR, growth rate, customers, team size
- **Stage-specific**: funding stage, raise amount
- **Team filters**: technical cofounder, founder count, background
- **Sorting**: by score, recent, GOD score, traction, stage
- **Pagination**: limit and offset

**Example:**
```typescript
const { matches, total } = await searchInvestorMatches(investorId, {
  minScore: 60,
  godScoreRange: 'elite', // 80+ GOD score
  hasRevenue: true,
  minMRR: 10000,
  minGrowthRate: 20,
  sectors: ['ai', 'ml'],
  sortBy: 'god_score',
  sortOrder: 'desc',
  limit: 50,
});
```

#### `getTopInvestorMatches(investorId, limit)`
Get top matches (simplified, no filters).

#### `getInvestorMatchStats(investorId)`
Get comprehensive statistics:
- Total matches
- Confidence distribution
- Average match score
- Average GOD score
- Top sectors
- Top stages
- Score distribution
- GOD score distribution

---

### 3. **Match Insights Service** (`matchInsightsService.ts`)

**Purpose:** Provides AI-powered insights, trends, and recommendations for matches.

**Key Functions:**

#### `getStartupMatchInsights(startupId)`
Get insights for a startup's matches:
- Match quality trends (improving/declining)
- Elite investor opportunities
- Sector concentration warnings
- Active investor opportunities
- Lead investor opportunities
- AI-generated insights

**Example Insights:**
- "Match Quality Improving - Your recent matches have an average score of 72.5, which is 8.3 points higher than your older matches."
- "5 Elite Investor Matches - You have 5 matches with elite-tier investors. These are high-value opportunities worth prioritizing."
- "Sector Concentration Risk - 60% of your matches are in fintech. Consider diversifying your investor outreach."

#### `getInvestorMatchInsights(investorId)`
Get insights for an investor's matches:
- Elite startup opportunities
- High-traction startup opportunities
- Sector alignment analysis
- Stage distribution trends
- AI-generated insights

#### `getMatchTrends(entityId, entityType, days)`
Get trends over time:
- Average match score trend
- High confidence match trend
- Direction (up/down/stable)
- Change percentage
- Significance level

---

### 4. **Match Investigation Service** (`matchInvestigationService.ts`)

**Purpose:** Provides deep-dive analysis tools for investigating individual matches.

**Key Functions:**

#### `getMatchBreakdown(matchId)`
Get detailed breakdown of match score components:
- **GOD Score Base** (55 points)
- **Quality Bonuses** (up to 15 points)
- **Stage Fit** (15 points)
- **Sector Fit** (20 points)
- **Geography Fit** (5 points)
- **Investor Quality** (5 points)
- **Check Size Fit** (10 points)
- **Investment Activity** (5 points)

Also includes:
- **Strengths**: What makes this a good match
- **Weaknesses**: Areas for improvement
- **Recommendations**: Actionable next steps

#### `getPortfolioAnalysis(investorId, startupId)`
Analyze investor portfolio fit:
- **Similar companies**: Same sector/stage
- **Complementary companies**: Adjacent sectors
- **Portfolio gaps**: New opportunities

#### `getFitAnalysis(matchId)`
Get comprehensive fit analysis:
- **Stage fit**: Alignment with investor stage focus
- **Sector fit**: Matched sectors and alignment
- **Geography fit**: Location alignment
- **Check size fit**: Raise amount vs investor range
- **Portfolio fit**: Similar companies in portfolio
- **Traction fit**: Revenue, growth, customer metrics

---

### 5. **Match Reports Service** (`matchReportsService.ts`)

**Purpose:** Generates comprehensive reports and exports for matches.

**Key Functions:**

#### `generateStartupMatchReport(startupId, options)`
Generate comprehensive report:
- Summary statistics
- Top matches
- Insights
- Recommendations
- Format: JSON or human-readable summary

#### `generateInvestorMatchReport(investorId, options)`
Generate comprehensive report:
- Summary statistics
- Top matches
- Insights
- Recommendations
- Format: JSON or human-readable summary

#### `exportMatchesToCSV(entityId, entityType)`
Export matches to CSV format:
- All match data
- Formatted for Excel/Google Sheets
- Includes all relevant fields

---

## Usage Examples

### For Startups

```typescript
import { 
  searchStartupMatches, 
  getStartupMatchStats,
  getTopStartupMatches 
} from './server/services/startupMatchSearchService';

// Search for elite investors who lead rounds
const { matches } = await searchStartupMatches(startupId, {
  investorTier: 'elite',
  leadsRounds: true,
  minScore: 70,
  sortBy: 'score',
});

// Get statistics
const stats = await getStartupMatchStats(startupId);
console.log(`Average match score: ${stats.averageScore}`);
console.log(`High confidence matches: ${stats.highConfidence}`);

// Get top 10 matches
const topMatches = await getTopStartupMatches(startupId, 10);
```

### For Investors

```typescript
import { 
  searchInvestorMatches, 
  getInvestorMatchStats,
  getTopInvestorMatches 
} from './server/services/investorMatchSearchService';

// Search for elite startups with revenue
const { matches } = await searchInvestorMatches(investorId, {
  godScoreRange: 'elite', // 80+ GOD score
  hasRevenue: true,
  minMRR: 10000,
  minGrowthRate: 20,
  sortBy: 'god_score',
});

// Get statistics
const stats = await getInvestorMatchStats(investorId);
console.log(`Average GOD score: ${stats.averageGODScore}`);
console.log(`High confidence matches: ${stats.highConfidence}`);

// Get top 10 matches
const topMatches = await getTopInvestorMatches(investorId, 10);
```

### Match Investigation

```typescript
import { 
  getMatchBreakdown,
  getPortfolioAnalysis,
  getFitAnalysis 
} from './server/services/matchInvestigationService';

// Get detailed breakdown
const breakdown = await getMatchBreakdown(matchId);
console.log('Strengths:', breakdown.strengths);
console.log('Weaknesses:', breakdown.weaknesses);
console.log('Recommendations:', breakdown.recommendations);

// Get portfolio analysis
const portfolio = await getPortfolioAnalysis(investorId, startupId);
console.log('Similar companies:', portfolio.similar_companies);
console.log('Portfolio gaps:', portfolio.portfolio_gaps);

// Get fit analysis
const fit = await getFitAnalysis(matchId);
console.log('Stage fit:', fit.stage_fit.match);
console.log('Sector fit:', fit.sector_fit.matched_sectors);
```

### Insights & Reports

```typescript
import { 
  getStartupMatchInsights,
  getMatchTrends 
} from './server/services/matchInsightsService';
import { 
  generateStartupMatchReport,
  exportMatchesToCSV 
} from './server/services/matchReportsService';

// Get insights
const insights = await getStartupMatchInsights(startupId);
insights.forEach(insight => {
  console.log(`${insight.type}: ${insight.title}`);
  console.log(insight.description);
});

// Get trends
const trends = await getMatchTrends(startupId, 'startup', 30);
trends.forEach(trend => {
  console.log(`${trend.metric}: ${trend.direction} by ${trend.change}`);
});

// Generate report
const report = await generateStartupMatchReport(startupId, {
  includeAllMatches: true,
  minScore: 50,
  format: 'summary',
});

// Export to CSV
const csv = await exportMatchesToCSV(startupId, 'startup');
```

---

## Integration with Frontend

These services can be integrated into frontend components:

1. **Search/Filter UI**: Use `searchStartupMatches` / `searchInvestorMatches` with filters
2. **Dashboard Stats**: Use `getStartupMatchStats` / `getInvestorMatchStats`
3. **Insights Panel**: Use `getStartupMatchInsights` / `getInvestorMatchInsights`
4. **Match Details**: Use `getMatchBreakdown`, `getFitAnalysis`, `getPortfolioAnalysis`
5. **Reports Page**: Use `generateStartupMatchReport` / `generateInvestorMatchReport`
6. **Export Button**: Use `exportMatchesToCSV`

---

## Next Steps

1. **Create API Routes**: Wrap these services in REST API endpoints
2. **Frontend Components**: Build UI components for search, filtering, insights
3. **Real-time Updates**: Add WebSocket support for live match updates
4. **Caching**: Implement caching for frequently accessed data
5. **Analytics**: Track usage patterns and popular filters

---

## Files Created

- ✅ `server/services/startupMatchSearchService.ts` - Startup match search & filtering
- ✅ `server/services/investorMatchSearchService.ts` - Investor match search & filtering
- ✅ `server/services/matchInsightsService.ts` - AI-powered insights & trends
- ✅ `server/services/matchInvestigationService.ts` - Deep-dive analysis tools
- ✅ `server/services/matchReportsService.ts` - Report generation & exports

All services are TypeScript-based, fully typed, and ready for integration! 🎉





