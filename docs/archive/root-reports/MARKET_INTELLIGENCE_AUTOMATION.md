# Market Intelligence & Talent Matching Automation

## Overview

Automated scripts that calculate market intelligence metrics and match startups with talent on a schedule.

---

## 🤖 Automated Jobs

### 1. **Market Intelligence Calculation** (`calculate-market-intelligence.js`)

**Schedule**: Daily (every 24 hours)

**What it does**:
- Calculates average GOD scores by sector
- Tracks founder courage/intelligence distributions
- Calculates funding velocity (days between rounds) by sector
- Stores overall market health metrics

**Output**:
- Stores data in `key_variables_tracking` table
- Stores aggregated metrics in `market_intelligence` table

**Run manually**:
```bash
node calculate-market-intelligence.js
```

### 2. **Automated Talent Matching** (`auto-match-talent.js`)

**Schedule**: Every 6 hours

**What it does**:
- Matches all approved startups with available talent
- Only creates matches with score ≥ 50 (high quality)
- Updates existing matches if scores change significantly
- Skips already-matched talent to avoid duplicates

**Output**:
- Creates/updates records in `founder_hire_matches` table

**Run manually**:
```bash
node auto-match-talent.js
```

---

## ⚙️ Automation Engine Integration

Both jobs are integrated into `automation-engine.js`:

```javascript
intervals: {
  market_intelligence: 1440, // Daily (24 hours * 60 min)
  talent_matching: 360,      // Every 6 hours (6 * 60 min)
}

enabled: {
  market_intelligence: true,
  talent_matching: true,
}
```

---

## 📊 What Gets Tracked

### Key Variables (in `key_variables_tracking`)

1. **`avg_god_score`** (by sector)
   - Average GOD score for each sector
   - Updated daily

2. **`founder_courage_distribution`**
   - Count of startups by courage level (low, moderate, high, exceptional)
   - Updated daily

3. **`founder_intelligence_distribution`**
   - Count of startups by intelligence level
   - Updated daily

4. **`founder_courage_avg_god_score_{level}`**
   - Average GOD score for each courage level
   - Shows correlation between courage and success

5. **`founder_intelligence_avg_god_score_{level}`**
   - Average GOD score for each intelligence level
   - Shows correlation between intelligence and success

6. **`avg_funding_velocity_days`** (by sector)
   - Average days between funding rounds
   - Updated daily

### Market Intelligence (in `market_intelligence` table)

1. **`overall_market_health`**
   - Overall average GOD score
   - Overall average MRR
   - Overall average growth rate
   - Total startup count

---

## 🚀 Starting Automation

### Option 1: Run automation engine
```bash
node automation-engine.js
```

### Option 2: Run with PM2 (recommended for production)
```bash
pm2 start automation-engine.js --name "hot-match-automation"
pm2 save
```

### Option 3: Run jobs manually
```bash
# Calculate market intelligence
node calculate-market-intelligence.js

# Match talent
node auto-match-talent.js
```

---

## 📈 Viewing Results

### Market Intelligence Dashboard
- Navigate to `/market-intelligence`
- View sector performance, founder patterns, trends

### Talent Matches
- Navigate to `/startup/:startupId/talent`
- See automatically generated matches

### Database Queries
```sql
-- View latest market intelligence
SELECT * FROM key_variables_tracking 
WHERE measurement_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY measurement_date DESC, variable_name;

-- View talent matches
SELECT 
  su.name as startup,
  tp.name as talent,
  fhm.match_score,
  fhm.status
FROM founder_hire_matches fhm
JOIN startup_uploads su ON fhm.startup_id = su.id
JOIN talent_pool tp ON fhm.talent_id = tp.id
ORDER BY fhm.match_score DESC;
```

---

## 🔧 Configuration

### Adjust Intervals

Edit `automation-engine.js`:

```javascript
intervals: {
  market_intelligence: 1440, // Change to 720 for twice daily
  talent_matching: 360,      // Change to 180 for every 3 hours
}
```

### Adjust Match Quality Threshold

Edit `auto-match-talent.js`:

```javascript
const matches = matchFounderToHires(founderProfile, availableTalent, {
  minScore: 50, // Change to 60 for higher quality only
  maxResults: 10,
  excludeCommitted: true
});
```

---

## ✅ Success Indicators

After automation runs, you should see:

1. **Market Intelligence**:
   - Records in `key_variables_tracking` table
   - Records in `market_intelligence` table
   - Dashboard shows updated metrics

2. **Talent Matching**:
   - Records in `founder_hire_matches` table
   - Founders can see matches in Talent Matching page

---

## 🐛 Troubleshooting

### No market intelligence data?
- Check if `calculate-market-intelligence.js` ran successfully
- Verify startups have `total_god_score` values
- Check logs: `tail -f logs/automation.log`

### No talent matches?
- Ensure talent pool has candidates: `SELECT COUNT(*) FROM talent_pool WHERE availability_status = 'available'`
- Check if startups have founder attributes in `extracted_data`
- Verify matching service is working: `node auto-match-talent.js`

### Jobs not running?
- Check automation engine is running: `pm2 status`
- Verify jobs are enabled in `automation-engine.js`
- Check job intervals are correct

---

## 📝 Next Steps

1. **Monitor**: Check automation logs regularly
2. **Refine**: Adjust intervals based on data volume
3. **Expand**: Add more key variables to track
4. **Alert**: Set up notifications for important metrics





