# Page Comparison: SubmitStartupPage vs SignalMatches

## SubmitStartupPage (Report View) - `/submit` route

**Layout:** Centered, narrow (max-w-2xl), single column

**Elements (in order):**
1. ✅ **Header Section**
   - "Investor Readiness Report" label
   - Startup name (large, bold)
   - Tagline (if available)
   - Percentile text ("Top X% of all startups on pythh")

2. ✅ **GOD Score + Components Card**
   - Circular gauge (ScoreGauge component)
   - Component bars (Team, Traction, Market, Product, Vision)

3. ✅ **Focus Areas Card**
   - "Where to Focus Before Outreach"
   - Shows 2 weakest components with insights
   - Icon + label + score + explanation for each

4. ✅ **Top Investor Matches Card**
   - "Top Investor Matches" header with flame icon
   - 5 MatchCard components (first 3 visible, last 2 blurred)
   - Paywall section at bottom

5. ✅ **Meeting Success Forecast Card**
   - Large percentage (estimated response rate)
   - Progress bar
   - Explanation text

6. ✅ **Next Steps Card**
   - "Your Next 3 Steps"
   - Numbered list with actionable steps

7. ✅ **Bottom CTA Card**
   - "Ready to move fast?" message
   - Signup button + "Analyze Another Startup" button

---

## SignalMatches Page - `/signal-matches` route

**Layout:** Wide (max-w-7xl), multi-column capable

**Elements (in order):**
1. ❌ **Intro Text** (not in SubmitStartupPage)
   - "Signal = timing. GOD = your position..."

2. ✅ **StartupProfileCard**
   - GOD Score ring (circular, not gauge)
   - Startup name, website link
   - Description/tagline
   - Signal score + Matches count
   - GOD breakdown (compact bars)
   - Industry comparison

3. ✅ **TopMatchesCards** (NEW - just added)
   - "Top Investor Matches" header
   - 5 MatchCard components
   - Paywall section

4. ❌ **RadarMatchTable** (not in SubmitStartupPage)
   - Full table of all matches
   - Unlock functionality

5. ❌ **SignalPathDashboard** (not in SubmitStartupPage)
   - Match Profile
   - Signal Health
   - Match Landscape
   - GOD Breakdown

6. ❌ **Locked Matches Section** (not in SubmitStartupPage)
   - Additional matches table

7. ❌ **Tools Links** (not in SubmitStartupPage)
   - Oracle coaching, Signal Playbook, Pitch Scan

---

## Key Differences

### Layout
- **SubmitStartupPage:** Centered, narrow (max-w-2xl), report-style
- **SignalMatches:** Wide (max-w-7xl), dashboard-style

### GOD Score Display
- **SubmitStartupPage:** Circular gauge (ScoreGauge) + horizontal bars
- **SignalMatches:** Circular ring (ScoreRing) + compact bars in card

### Missing from SignalMatches
- ❌ Focus Areas section
- ❌ Meeting Success Forecast
- ❌ Next Steps section
- ❌ Bottom CTA card

### Extra in SignalMatches
- ❌ Full match table (RadarMatchTable)
- ❌ SignalPathDashboard
- ❌ Tools links
- ❌ Locked matches section

---

## Recommendation

To make SignalMatches consistent with SubmitStartupPage, we should:

1. **Add Focus Areas section** - Show weakest components with insights
2. **Add Meeting Success Forecast** - Calculate and display response rate
3. **Add Next Steps section** - Show actionable steps
4. **Consider layout** - Optionally switch to centered narrow layout for URL submissions
5. **Keep extra features** - The table and dashboard can stay, but add the missing report sections
