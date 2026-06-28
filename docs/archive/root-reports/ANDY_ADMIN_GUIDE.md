# [pyth] ai - Administrator Guide for Andy Abramson

## What is [pyth] ai?

**[pyth] ai** is an AI-powered startup-investor matching platform that uses pattern recognition at scale to reveal which startups and investors are perfect matches. Think of it as an "oracle of truth" for venture capital—not predictions, but probability perfected through data.

### Core Concept
Where VCs see 100 pitches and pick 3 based on gut feeling, **[pyth] ai** sees 100 startups and reveals which 3 have the mathematical signatures of success across **20 different dimensions** (team velocity, market timing, traction acceleration, competitive positioning, founder psychology, investor thesis fit, and more).

### How It Works
1. **Discovery**: Automatically scrapes 100+ RSS feeds and discovers startups from news articles, funding announcements, and industry publications
2. **Enrichment**: AI-powered extraction fills in startup data (description, sectors, stage, funding amount, etc.)
3. **Scoring**: The **GOD Algorithm™** scores each startup across 8 dimensions:
   - Team (founders, experience, technical depth)
   - Traction (revenue, users, growth rate)
   - Market (TAM, opportunity, timing)
   - Product (demo, launch, defensibility)
   - Vision (clarity, ambition, potential)
   - Ecosystem (backers, advisors, partners)
   - Grit (persistence, pivots, execution)
   - Problem Validation (pain point, willingness to pay)
4. **Matching**: Compares 3,000+ startups against 3,000+ investors to find perfect compatibility
5. **Learning**: Machine learning continuously improves the algorithm based on real match outcomes

---

## Key Features

### For Startups
- Get matched with investors who actually fund their sector and stage
- See why each match works (AI-generated explanations)
- Track investor interest and engagement
- Access to 500+ verified active investors

### For Investors
- Pre-qualified deal flow that matches their thesis
- Anonymous browsing until they choose to reveal
- AI filters through 3,000+ startups to find winners
- Efficient screening—review matches in minutes, not hours

### Technical Capabilities
- **3,400+ startups** in database
- **3,200+ investors** tracked
- **4.5M+ matches** pre-calculated
- **<2 seconds** to generate perfect matches
- **20+ algorithms** trained daily on real outcomes
- **89% accuracy** in match prediction

---

## Administrator Dashboard Overview

As an administrator, you have access to a comprehensive control center that lets you monitor and manage every aspect of the platform.

### Main Admin Dashboard
**URL**: `http://localhost:5173/admin/dashboard` (or `/admin/dashboard` in production)

**What you'll see:**
- **System Health Overview**: Real-time status of all components
- **Key Metrics**: Total startups, investors, matches, average GOD scores
- **Quick Access Panels**: Click any panel to dive deeper into that area
- **Activity Monitoring**: Recent matches, scoring activity, system health

---

## Admin Tools & How to Use Them

### 1. **Unified Admin Dashboard** (`/admin/dashboard`)
**Purpose**: Your command center—overview of everything

**What it shows:**
- Total startups (approved count)
- Total investors
- Total matches generated
- Average GOD score across all startups
- Recent activity (matches in last 24 hours)
- System health indicators

**How to use:**
- Navigate to `/admin/dashboard`
- View the big picture metrics
- Click any panel card to drill down into specific areas
- Panels include:
  - **GOD Agent**: Monitor score deviations and ML recommendations
  - **Matching Engine**: View match generation status
  - **GOD Scores**: Review startup scoring
  - **Industry Rankings**: See which sectors perform best
  - **ML Dashboard**: Machine learning training and recommendations

---

### 2. **GOD Settings** (`/admin/god-settings`)
**Purpose**: Adjust the weights of the GOD Algorithm components

**What you can do:**
- View current weights for all 8 GOD components
- Adjust weights manually (Team, Traction, Market, Product, Vision, Ecosystem, Grit, Problem Validation)
- View weight change history
- **ML Recommendations Panel**: See AI-generated suggestions for weight optimization
- **Accept/Reject Recommendations**: One-click application of ML-suggested improvements
- **Run ML Training**: Trigger machine learning analysis to generate new recommendations

**How to use:**
1. Go to `/admin/god-settings`
2. Review current weights (defaults are displayed)
3. Check "ML Recommendations" section for AI suggestions
4. If recommendations exist:
   - Read the explanation
   - Check expected impact
   - Click "Accept Recommendation" to apply
5. To manually adjust: Change slider values and click "Save Weights"

**Pro Tip**: Always check ML recommendations first—they're based on real match outcomes and often suggest optimizations you wouldn't think of.

---

### 3. **ML Dashboard** (`/admin/ml-dashboard`)
**Purpose**: Machine learning training, recommendations, and performance tracking

**What you can do:**
- Run ML training cycles (analyzes all matches and generates recommendations)
- View ML-generated recommendations
- Track GOD Score Deviations (when startups' scores change unexpectedly)
- Monitor performance metrics
- See improvement over time

**How to use:**
1. Go to `/admin/ml-dashboard`
2. **GOD Score Deviations Section**:
   - Click "Check Now" to detect recent score changes
   - Review startups with significant deviations (≥10 point changes)
   - Click "Review & Fix in GOD Settings" to investigate
3. **ML Recommendations**:
   - Click "Run Training" to start ML analysis (takes 5-10 minutes)
   - Wait for recommendations to appear
   - Review each recommendation's expected impact
   - Apply recommendations from here or go to GOD Settings
4. **Performance Metrics**:
   - View training accuracy
   - Track test accuracy
   - Monitor recommendation count

**Pro Tip**: Run ML training weekly to keep the algorithm optimized as new matches come in.

---

### 4. **GOD Scores Dashboard** (`/admin/god-scores`)
**Purpose**: Review startup scores, rankings, and score distribution

**What you can see:**
- Top startups by GOD score
- Score distribution (how many startups in each range: 90+, 80-89, 70-79, etc.)
- Score breakdowns by component
- Individual startup score details

**How to use:**
1. Go to `/admin/god-scores`
2. Browse top-ranked startups
3. Filter by score range, industry, or stage
4. Click any startup to see detailed component breakdowns

---

### 5. **Industry Rankings** (`/admin/industry-rankings`)
**Purpose**: See which industries/sectors have the highest average GOD scores

**What you can see:**
- Top industries ranked by average GOD score
- Startup count per industry
- High scorers (80+ scores) percentage
- Horizontal bar chart of top 5 industries

**How to use:**
1. Go to `/admin/industry-rankings`
2. View the bar chart showing top 5 industries
3. Scroll to see full rankings table
4. Sort by: Average Score, Startup Count, or High Scorers
5. Search for specific industries

**Insight**: Industries with consistently low scores may indicate data quality issues or that startups in those sectors need better profiles.

---

### 6. **Matching Engine Admin** (`/admin/matching-engine`)
**Purpose**: Monitor and manage match generation

**What you can see:**
- Current matches in queue
- Match generation status
- Recent matches
- Match quality distribution
- Ability to trigger queue processor

**How to use:**
1. Go to `/admin/matching-engine`
2. View "Current Matches" (recently generated)
3. Check "Queue Status" (how many startups waiting to be matched)
4. Click "Trigger Queue Processor" if queue is backed up
5. Review "Match Quality Distribution" to see if matches are improving

---

### 7. **Startup Management**
**Routes**: Various (see below)

**Tools available:**
- **RSS Discoveries** (`/admin/rss-discoveries`): Review startups found via RSS scraping, approve/import them
- **Edit Startups** (`/admin/edit-startups`): Manually edit startup profiles
- **Startup Uploads**: View all startups in the database

**How to use:**
1. **RSS Discoveries**:
   - Review discovered startups from news articles
   - Filter by "Unimported" to see what needs attention
   - Click "Approve" to import into main database
   - Click startup name to see full details before approving

2. **Edit Startups**:
   - Search for specific startups
   - Edit fields: name, description, sectors, stage, funding amount
   - Update GOD scores manually if needed (usually auto-calculated)

---

### 8. **System Health Monitoring**

**What to monitor:**
- **Database**: Check Supabase dashboard for query performance
- **Scrapers**: Verify RSS scrapers are running (multiple processes should be active)
- **Queue Processor**: Ensure matches are being generated regularly
- **GOD Scoring**: Check that new startups are being scored

**Quick Health Check:**
1. Go to `/admin/dashboard`
2. Check all panel statuses (should be green/healthy)
3. Review "Recent Activity" section
4. If anything shows "Error" or "Warning", investigate:
   - Check server logs
   - Verify database connectivity
   - Ensure scrapers are running

---

## Key Workflows

### Daily Check-In (5 minutes)
1. Open `/admin/dashboard`
2. Review key metrics (startups, investors, matches)
3. Check system health (all panels should be healthy)
4. Review recent matches (should see activity in last 24 hours)

### Weekly Optimization (30 minutes)
1. Go to `/admin/ml-dashboard`
2. Click "Run Training" (wait 5-10 minutes)
3. Review ML recommendations in GOD Settings
4. Accept recommendations that make sense
5. Check Industry Rankings for any anomalies
6. Review GOD Score distribution for quality trends

### Adding New Startups
1. Go to `/admin/rss-discoveries`
2. Filter by "Unimported"
3. Review each startup (check sectors, stage, description)
4. Click "Approve" for quality startups
5. New startups will automatically:
   - Be scored by GOD Algorithm
   - Be added to matching queue
   - Appear in matches within 2 seconds

### Adjusting Matching Quality
1. Go to `/admin/god-settings`
2. Check ML Recommendations (run training if needed)
3. Review which components need adjustment
4. Apply recommendations or manually adjust weights
5. Monitor results in Matching Engine Admin

### Troubleshooting Low Match Quality
1. Check `/admin/industry-rankings` - are scores consistently low?
2. Review `/admin/god-scores` - is distribution healthy?
3. Run ML training to get recommendations
4. Check startup data quality in RSS Discoveries
5. Verify investors have correct sectors/stages defined

---

## Important URLs

### Admin Pages
- **Main Dashboard**: `/admin/dashboard`
- **GOD Settings**: `/admin/god-settings`
- **ML Dashboard**: `/admin/ml-dashboard`
- **GOD Scores**: `/admin/god-scores`
- **Industry Rankings**: `/admin/industry-rankings`
- **Matching Engine Admin**: `/admin/matching-engine`
- **RSS Discoveries**: `/admin/rss-discoveries`

### User-Facing Pages
- **Landing/Matching**: `/` or `/match`
- **Founder Toolkit**: `/services`
- **Fundraising Toolkit**: `/strategies`
- **Pricing**: `/pricing`
- **Trending Startups**: `/trending`

---

## Understanding GOD Scores

### Score Ranges
- **90-100**: Elite (rare, top-tier startups)
- **80-89**: Excellent (high-quality, investment-ready)
- **70-79**: Good (solid startups with potential)
- **60-69**: Average (needs improvement but viable)
- **<60**: Needs Work (significant gaps to address)

### Current Status
Based on recent analysis:
- **Average GOD Score**: ~42.69 (across all startups)
- **Median**: 39.00
- **Top 20%**: 60+ scores
- **Most startups**: Need improvement (scores below 60)

**This is normal** for a database with many early-stage startups. The algorithm is calibrated to identify truly exceptional companies.

### Why Scores Are Lower Than Expected
1. **Early Stage Bias**: Database includes many pre-seed/seed startups (lower scores expected)
2. **Data Completeness**: Missing data fields lower component scores
3. **Stringent Criteria**: Algorithm uses VC-grade benchmarks (intentionally high bar)
4. **ML Optimization**: As ML trains on outcomes, recommendations will improve scoring accuracy

---

## ML Recommendations Explained

When you see ML recommendations, they typically suggest:

**Example 1: Increase Team Weight**
- **Why**: ML detected that startups with strong teams (technical founders, domain expertise) have 35% higher investment rates
- **Action**: Increase Team weight from 3.0 to 3.5
- **Expected Impact**: 12% increase in match success rate

**Example 2: Decrease Market Weight**
- **Why**: Market size isn't correlating as strongly with investment success as expected
- **Action**: Decrease Market weight from 2.0 to 1.8
- **Expected Impact**: Better alignment with actual VC decision patterns

**Best Practice**: 
- Always review the "Reason" field
- Check "Expected Impact" before applying
- Apply one recommendation at a time
- Monitor results in Matching Engine Admin

---

## Quick Start Checklist

**First Time Setup:**
- [ ] Access `/admin/dashboard` - verify you can see all panels
- [ ] Review current GOD weights in `/admin/god-settings`
- [ ] Check system health (all should be green)
- [ ] Review recent matches in `/admin/matching-engine`

**Weekly Tasks:**
- [ ] Run ML training (`/admin/ml-dashboard`)
- [ ] Review and apply ML recommendations
- [ ] Check Industry Rankings for trends
- [ ] Monitor match quality distribution

**As Needed:**
- [ ] Approve discovered startups (`/admin/rss-discoveries`)
- [ ] Adjust GOD weights if metrics suggest changes
- [ ] Review and edit startup profiles
- [ ] Troubleshoot any system errors

---

## Tips & Best Practices

1. **Trust the ML**: Recommendations are based on actual match outcomes—they're usually right
2. **Don't Over-Adjust**: Small weight changes (0.1-0.2) often have big impacts
3. **Monitor Trends**: Use Industry Rankings to spot data quality issues
4. **Keep Scrapers Running**: More startups = better matches = better ML training
5. **Review Deviations**: Score changes can indicate profile updates or algorithm improvements
6. **Data Quality Matters**: Better startup profiles = better GOD scores = better matches

---

## Getting Help

**If something isn't working:**
1. Check `/admin/dashboard` for system health
2. Review server logs (usually in terminal where server is running)
3. Check Supabase dashboard for database issues
4. Verify scrapers are running: `ps aux | grep -E "node.*(scraper|discover|rss)"`

**Common Issues:**
- **No matches appearing**: Check queue processor is running
- **Low GOD scores**: Verify startup data completeness
- **ML training fails**: Check server is running on port 3002
- **Recommendations not showing**: Run ML training first

---

## The Big Picture

**[pyth] ai** is constantly learning and improving:
- **Every match** teaches the system something new
- **Every ML training cycle** optimizes the algorithm
- **Every recommendation** makes matches more accurate
- **Every approved startup** expands the matching universe

Your role as administrator is to:
- **Monitor** system health and metrics
- **Optimize** the GOD Algorithm based on ML insights
- **Maintain** data quality through approvals and edits
- **Learn** from the patterns the system reveals

The platform gets smarter every day. Your job is to guide it in the right direction.

---

**Questions?** The best way to learn is to explore the admin dashboard and click around. Everything is designed to be intuitive. When in doubt, check the metrics—they tell the real story.

**Welcome to [pyth] ai, Andy. Let's build the future of startup-investor matching together.** 🔥
