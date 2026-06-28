# Health Dashboard Charts

## Overview

Three real-time analytics charts have been added to the System Health Dashboard (`/admin/health`) to provide live insights into system performance and data quality.

## Charts Implemented

### 1. GOD Score Trend Chart
**Location**: `src/components/charts/GODScoreTrendChart.tsx`

**Features**:
- Shows GOD score trends over the last 30 days
- Displays average, min, and max scores
- Shows trend indicator (up/down/stable)
- Auto-refreshes every 5 minutes
- Uses line chart with multiple series

**Data Sources**:
- Primary: `score_history` table (if available)
- Fallback: `startup_uploads.updated_at` grouped by date

**Metrics Displayed**:
- Average GOD score over time
- Score range (min/max)
- Current average score
- Trend direction

### 2. Inference Data Coverage Chart
**Location**: `src/components/charts/InferenceDataCoverageChart.tsx`

**Features**:
- Shows percentage of data fields populated by inference
- Tracks coverage trend over 7 days
- Field-by-field breakdown (top 15 fields)
- Shows impact of inference enrichment on data completeness
- Auto-refreshes every 2 minutes

**Data Sources**:
- `startup_uploads.extracted_data` JSONB field
- Direct columns from `startup_uploads`

**Fields Tracked**:
- Revenue: `mrr`, `arr`, `revenue`, `revenue_annual`
- Traction: `customer_count`, `growth_rate`, `growth_rate_monthly`
- Market: `market_size`, `marketSize`
- Team: `team`, `founders`, `founders_count`, `has_technical_cofounder`
- Product: `is_launched`, `has_demo`
- Content: `problem`, `solution`, `value_proposition`, `tagline`
- Metadata: `sectors`, `industries`, `stage`, `funding_stage`

**Metrics Displayed**:
- Overall data coverage percentage
- Coverage trend over time
- Per-field coverage breakdown
- Startups with vs without inference data

### 3. Match Quality Chart
**Location**: `src/components/charts/MatchQualityChart.tsx`

**Features**:
- Scatter plot showing correlation between GOD scores and match scores
- Distribution by GOD score ranges
- Correlation coefficient calculation
- Color-coded by GOD score quality
- Auto-refreshes every 3 minutes

**Data Sources**:
- `startup_investor_matches.match_score`
- `startup_uploads.total_god_score` (via join)

**Metrics Displayed**:
- Match score vs GOD score correlation
- Average match score by GOD score range
- Match count per range
- Correlation strength (strong/moderate/weak)

## Integration

All charts are integrated into `SystemHealthDashboard.tsx`:
- Located in new "Real-Time Analytics" section
- Appears after GOD Score Distribution
- Before Recent Guardian Reports
- Fully responsive and styled to match dashboard theme

## Auto-Refresh

Each chart has its own refresh interval:
- **GOD Score Trend**: 5 minutes
- **Inference Coverage**: 2 minutes
- **Match Quality**: 3 minutes

## Styling

- Dark theme matching dashboard
- Responsive design (mobile-friendly)
- Color-coded for quick visual understanding
- Tooltips with detailed information
- Legend for clarity

## Performance

- Charts sample data for performance (1000-5000 records)
- Efficient queries with proper indexing
- Lazy loading and error handling
- Graceful degradation if data unavailable

## Usage

Navigate to `/admin/health` to view all charts. Charts automatically:
1. Load data on mount
2. Refresh at their intervals
3. Update when dashboard is refreshed
4. Show loading states while fetching

## Future Enhancements

Potential improvements:
- Export chart data to CSV
- Time range selector (7/30/90 days)
- Real-time WebSocket updates
- Drill-down capabilities
- Comparison views (before/after inference)



