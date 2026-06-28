# pyth ai - Administrator Guide for Andy Abramson

## What is pyth ai?

**pyth ai** is an AI-powered startup-investor matching platform—the oracle of matches for venture capital. We use pattern recognition at scale to reveal which startups and investors are perfect matches through probability perfected by data, not guesswork.

### Core Concept
Where VCs see 100 pitches and pick 3 based on gut feeling, **pyth ai** sees 100 startups and reveals which 3 have the mathematical signatures of success across **20+ different dimensions** (team velocity, market timing, traction acceleration, competitive positioning, founder psychology, investor thesis fit, and more).

---

## How It Works

### 1. Discovery
Automatically scrapes 100+ RSS feeds and discovers startups from news articles, funding announcements, and industry publications.

### 2. Enrichment
AI-powered extraction fills in startup data:
- Description, sectors, stage
- Funding amount, investors
- Team background, traction metrics

### 3. GOD Scoring
The **GOD Algorithm™** scores each startup across 8 dimensions:
- **Team** - Founders, experience, technical depth
- **Traction** - Revenue, users, growth rate
- **Market** - TAM, opportunity, timing
- **Product** - Demo, launch, defensibility
- **Vision** - Clarity, ambition, potential
- **Ecosystem** - Backers, advisors, partners
- **Grit** - Persistence, pivots, execution
- **Problem Validation** - Pain point, willingness to pay

### 4. Matching
Compares 1,000+ approved startups against 3,180+ investors to find perfect compatibility.

### 5. Learning
Machine learning continuously improves the algorithm based on real match outcomes.

---

## Current System Status

**Database:**
- ✅ 4,018 total startups (1,000 approved)
- ✅ 3,180 investors tracked
- ✅ 99,650 matches pre-calculated
- ✅ 808 discovered startups awaiting review

**Performance:**
- **<2 seconds** to generate matches
- **20+ algorithms** trained daily
- **Continuous ML** optimization

---

## Admin Dashboard Overview

**Main Dashboard URL:** `http://localhost:5177/admin/dashboard`

Your command center showing:
- System health overview (real-time status)
- Key metrics (startups, investors, matches, GOD scores)
- Quick access panels for deep dives
- Recent activity monitoring

---

## Key Admin Tools

### 1. **Unified Admin Dashboard** (`/admin/dashboard`)
**Your command center**

**What you see:**
- Total approved startups
- Total investors
- Total matches generated
- Average GOD score
- System health indicators
- Recent activity (last 24h)

**Quick actions:**
- Click any panel card to drill down
- Monitor GOD Agent deviations
- Check matching engine status
- Review industry rankings

---

### 2. **GOD Settings** (`/admin/god-settings`)
**Adjust algorithm weights**

**What you can do:**
- View current weights for all 8 components
- Adjust weights manually
- View weight change history
- **ML Recommendations Panel** - AI-generated optimization suggestions
- Accept/reject recommendations with one click
- Trigger ML training for new recommendations

**Workflow:**
1. Check ML Recommendations first (they're usually right)
2. Read the explanation and expected impact
3. Click "Accept" to apply or manually adjust
4. Monitor results in Matching Engine

**Pro Tip:** Small weight changes (0.1-0.2) often have big impacts. Trust the ML—it's trained on real outcomes.

---

### 3. **ML Dashboard** (`/admin/ml-dashboard`)
**Machine learning control center**

**Capabilities:**
- Run ML training cycles (analyzes all matches)
- View ML-generated recommendations
- Track GOD Score deviations (unexpected changes ≥10 points)
- Monitor performance metrics
- See improvement trends over time

**Workflow:**
1. Click "Run Training" (takes 5-10 minutes)
2. Review recommendations when complete
3. Check GOD Score Deviations section
4. Apply recommendations or investigate deviations
5. Monitor accuracy metrics

**Best Practice:** Run ML training weekly as new matches come in.

---

### 4. **GOD Scores Dashboard** (`/admin/god-scores`)
**Review startup scores and rankings**

**What you see:**
- Top startups by GOD score
- Score distribution across ranges
- Component breakdowns
- Individual startup details

**Use cases:**
- Browse top-ranked startups
- Filter by score range, industry, stage
- Drill into component scores
- Identify scoring patterns

---

### 5. **Industry Rankings** (`/admin/industry-rankings`)
**Sector performance analysis**

**Insights available:**
- Top industries by average GOD score
- Startup count per industry
- High scorers (80+) percentage
- Visual bar chart of top 5

**Use cases:**
- Identify strong sectors
- Spot data quality issues (consistently low scores)
- Track industry trends
- Sort by score, count, or high performers

---

### 6. **Matching Engine Admin** (`/admin/matching-engine`)
**Match generation monitoring**

**What you see:**
- Current matches in queue
- Match generation status
- Recent matches
- Match quality distribution
- Queue processor controls

**Actions:**
- Trigger queue processor if backed up
- Review match quality trends
- Monitor generation performance

---

### 7. **Startup Management Tools**

#### RSS Discoveries (`/admin/rss-discoveries`)
**Review and approve discovered startups**

**Workflow:**
1. Filter by "Unimported"
2. Review startup details
3. Click "Approve" for quality startups
4. System automatically scores and matches

#### Edit Startups (`/admin/edit-startups`)
**Manual profile editing**

**Actions:**
- Search for specific startups
- Edit fields (name, description, sectors, stage, funding)
- Update profiles as needed

---

## Understanding GOD Scores

### Score Ranges
| Range | Quality | Description |
|-------|---------|-------------|
| 90-100 | Elite | Rare, top-tier startups |
| 80-89 | Excellent | High-quality, investment-ready |
| 70-79 | Good | Solid potential |
| 60-69 | Average | Needs improvement but viable |
| <60 | Needs Work | Significant gaps to address |

### Current Distribution
- **Average:** ~60 (1,000 approved startups)
- **Many early-stage** startups (lower scores expected)
- **Algorithm calibrated** for VC-grade standards (high bar)
- **ML optimization** continuously improving accuracy

**This is normal.** The algorithm identifies truly exceptional companies by design.

---

## ML Recommendations Explained

### Example Recommendation:
```
Component: Team
Current Weight: 3.0
Recommended: 3.5 (+0.5)
Reason: Startups with strong teams (technical founders, 
        domain expertise) have 35% higher investment rates
Expected Impact: 12% increase in match success rate
```

**Best Practices:**
- Always review the "Reason" field
- Check "Expected Impact" before applying
- Apply one recommendation at a time
- Monitor results after changes
- Trust the data—it's trained on real outcomes

---

## Key Workflows

### Daily Check-In (5 minutes)
1. Open `/admin/dashboard`
2. Review key metrics
3. Check system health (all panels green)
4. Review recent activity

### Weekly Optimization (30 minutes)
1. Go to `/admin/ml-dashboard`
2. Click "Run Training" (wait 5-10 min)
3. Review ML recommendations
4. Accept recommendations in GOD Settings
5. Check Industry Rankings for anomalies
6. Monitor score distribution trends

### Adding New Startups
1. Go to `/admin/rss-discoveries`
2. Filter by "Unimported"
3. Review each startup
4. Click "Approve" for quality startups
5. System automatically:
   - Scores via GOD Algorithm
   - Adds to matching queue
   - Generates matches

### Adjusting Match Quality
1. Check ML recommendations first
2. Review component weights
3. Apply recommendations or adjust manually
4. Monitor Matching Engine results
5. Iterate based on outcomes

---

## Important URLs

### Admin Pages
| Page | URL | Purpose |
|------|-----|---------|
| Main Dashboard | `/admin/dashboard` | Overview & health |
| GOD Settings | `/admin/god-settings` | Weight adjustments |
| ML Dashboard | `/admin/ml-dashboard` | Training & recommendations |
| GOD Scores | `/admin/god-scores` | Score analysis |
| Industry Rankings | `/admin/industry-rankings` | Sector performance |
| Matching Engine | `/admin/matching-engine` | Match monitoring |
| RSS Discoveries | `/admin/rss-discoveries` | Approve startups |

### User-Facing Pages
| Page | URL | Purpose |
|------|-----|---------|
| Matching | `/` or `/match` | Main matching interface |
| Founder Toolkit | `/services` | Resources for founders |
| Fundraising Toolkit | `/strategies` | Fundraising guidance |
| Trending Startups | `/trending` | Hot startups feed |

---

## Troubleshooting

### Common Issues

**No matches appearing:**
- Check queue processor is running
- Verify startups are approved (status='approved')
- Trigger queue processor manually

**Low GOD scores:**
- Verify startup data completeness
- Check for missing fields
- Review data quality in discoveries

**ML training fails:**
- Confirm server running on port 3002
- Check server logs for errors
- Verify database connectivity

**Recommendations not showing:**
- Run ML training first
- Wait for training to complete (5-10 min)
- Check ML Dashboard for results

### System Health Check
1. Go to `/admin/dashboard`
2. All panels should show green/healthy
3. Check "Recent Activity" for matches
4. If errors, check server logs

---

## Tips & Best Practices

✅ **Trust the ML** - Recommendations are based on actual outcomes
✅ **Small Changes** - Weight adjustments of 0.1-0.2 have big impacts
✅ **Monitor Trends** - Use Industry Rankings to spot patterns
✅ **Keep Scrapers Running** - More data = better matches = better ML
✅ **Review Deviations** - Score changes indicate improvements
✅ **Data Quality** - Better profiles = better scores = better matches

---

## The Big Picture

**pyth ai learns continuously:**
- Every match teaches the system
- Every ML cycle optimizes the algorithm
- Every recommendation improves accuracy
- Every approved startup expands the universe

**Your role as administrator:**
- **Monitor** system health and metrics
- **Optimize** GOD Algorithm via ML insights
- **Maintain** data quality through approvals
- **Learn** from patterns the system reveals

The platform gets smarter every day. Your job is to guide it.

---

## Getting Started

**First Time Setup:**
- [ ] Access `/admin/dashboard` - verify all panels visible
- [ ] Review GOD weights in `/admin/god-settings`
- [ ] Check system health (all green)
- [ ] Review recent matches in `/admin/matching-engine`

**Weekly Tasks:**
- [ ] Run ML training (`/admin/ml-dashboard`)
- [ ] Review and apply ML recommendations
- [ ] Check Industry Rankings for trends
- [ ] Monitor match quality distribution

**As Needed:**
- [ ] Approve discovered startups
- [ ] Adjust GOD weights based on metrics
- [ ] Edit startup profiles
- [ ] Troubleshoot system errors

---

**Welcome to pyth ai, Andy.**

**oracle of matches.**

The best way to learn is to explore the dashboard and click around. Everything is designed to be intuitive. When in doubt, check the metrics—they tell the real story.

Let's build the future of startup-investor matching together. 🔮

---

*pyth ai - infrastructure for venture capital*
