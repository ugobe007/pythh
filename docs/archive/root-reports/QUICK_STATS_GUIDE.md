# 📊 Quick Stats Guide

## Check Startup Stats & GOD Score Trends

Run this command to see:
- Recent startup discoveries
- GOD score distribution
- GOD score trends over time
- Match generation stats

```bash
node check-startup-stats.js
```

## What It Shows

### 1. Discovered Startups
- Total discovered startups
- Imported vs pending import
- Recent activity (last 24h, 7 days)
- Most recent discoveries

### 2. Approved Startups
- Total approved startups
- Recent approvals (last 24h, 7 days)

### 3. GOD Score Distribution
- Average, median, min, max scores
- Distribution by tier:
  - 🏆 Elite (85+)
  - 🔥 High (70-84)
  - ⚡ Medium (50-69)
  - 📊 Low (<50)

### 4. GOD Score Trends
- Last 7 days average scores
- Trend analysis (improving/declining)
- Daily breakdown

### 5. Match Generation Stats
- Total matches generated
- Recent matches (last 24h)
- Match quality distribution

## Requirements

Make sure your `.env` file has:
```
VITE_SUPABASE_URL=your_url_here
SUPABASE_SERVICE_KEY=your_key_here
```

## Example Output

```
══════════════════════════════════════════════════════════════════
🔥 HOT MATCH - STARTUP STATS & GOD SCORE ANALYSIS
══════════════════════════════════════════════════════════════════
⏰ 12/20/2025, 3:45:00 PM

══════════════════════════════════════════════════════════════════
📊 DISCOVERED STARTUPS
══════════════════════════════════════════════════════════════════

Total Discovered: 1,234
  ✅ Imported: 1,100
  ⏳ Pending Import: 134

Recent Activity:
  Last 24 hours: 45 startups
  Last 7 days: 234 startups

Most Recent Discoveries:
  1. ✅ StartupName (Dec 20, 3:30 PM)
  2. ⏳ AnotherStartup (Dec 20, 2:15 PM)
  ...

══════════════════════════════════════════════════════════════════
⚡ GOD SCORE DISTRIBUTION
══════════════════════════════════════════════════════════════════

Statistics:
  Total scored: 1,100
  Average: 67.3/100
  Median: 65/100
  Range: 45 - 92

Distribution:
  🏆 Elite (85+): 45 (4.1%)
  🔥 High (70-84): 234 (21.3%)
  ⚡ Medium (50-69): 567 (51.5%)
  📊 Low (<50): 254 (23.1%)

══════════════════════════════════════════════════════════════════
📈 GOD SCORE TRENDS
══════════════════════════════════════════════════════════════════

Last 7 Days Average GOD Scores:
  🔥 2025-12-20: 68.5/100 (45 startups)
  ⚡ 2025-12-19: 67.2/100 (38 startups)
  ⚡ 2025-12-18: 66.8/100 (42 startups)
  ...

Trend: 📈 +1.7 points (recent vs older)
```

---

**Run `node check-startup-stats.js` to see your current stats!**

