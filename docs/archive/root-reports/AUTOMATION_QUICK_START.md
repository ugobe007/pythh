# Automation Quick Start Guide

## ✅ What's Automated

### 1. Market Intelligence (Daily)
- **Script**: `calculate-market-intelligence.js`
- **Schedule**: Every 24 hours
- **What it does**:
  - Calculates average GOD scores by sector
  - Tracks founder courage/intelligence distributions
  - Calculates funding velocity by sector
  - Stores overall market health metrics

### 2. Talent Matching (Every 6 Hours)
- **Script**: `auto-match-talent.js`
- **Schedule**: Every 6 hours
- **What it does**:
  - Matches all startups with available talent
  - Only creates high-quality matches (score ≥ 50)
  - Updates existing matches if scores change

---

## 🚀 How to Start

### Option 1: Start Automation Engine (Recommended)
```bash
node automation-engine.js
```

This will run all automated jobs including:
- Market intelligence (daily)
- Talent matching (every 6 hours)
- All other existing jobs (RSS scraping, match generation, etc.)

### Option 2: Run Jobs Manually (For Testing)
```bash
# Test market intelligence calculation
node calculate-market-intelligence.js

# Test talent matching
node auto-match-talent.js
```

### Option 3: Production with PM2
```bash
# Install PM2 if not already installed
npm install -g pm2

# Start automation engine
pm2 start automation-engine.js --name "hot-match-automation"

# Save PM2 configuration
pm2 save

# Auto-start on system reboot
pm2 startup
```

---

## 📊 Verify It's Working

### Check Market Intelligence Data
```sql
-- Run in Supabase SQL Editor
SELECT 
  variable_name,
  sector,
  value,
  measurement_date
FROM key_variables_tracking
WHERE measurement_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY measurement_date DESC, variable_name;
```

### Check Talent Matches
```sql
-- Run in Supabase SQL Editor
SELECT 
  su.name as startup,
  tp.name as talent,
  fhm.match_score,
  fhm.status,
  fhm.created_at
FROM founder_hire_matches fhm
JOIN startup_uploads su ON fhm.startup_id = su.id
JOIN talent_pool tp ON fhm.talent_id = tp.id
ORDER BY fhm.created_at DESC
LIMIT 20;
```

### Check Automation Logs
```bash
# View automation logs
tail -f logs/automation.log

# Or if using PM2
pm2 logs automation-engine
```

---

## ⚙️ Adjust Schedules

Edit `automation-engine.js`:

```javascript
intervals: {
  market_intelligence: 1440, // Change to 720 for twice daily
  talent_matching: 360,      // Change to 180 for every 3 hours
}
```

---

## 🎯 Expected Results

### After First Market Intelligence Run:
- Records in `key_variables_tracking` table
- Records in `market_intelligence` table
- Dashboard at `/market-intelligence` shows data

### After First Talent Matching Run:
- Records in `founder_hire_matches` table
- Founders can see matches at `/startup/:startupId/talent`

---

## 🔍 Monitoring

### Check if Automation is Running
```bash
# If using PM2
pm2 status

# Check process
ps aux | grep automation-engine
```

### View Recent Activity
```bash
# Check logs
tail -n 100 logs/automation.log | grep -E "(Market Intelligence|Talent Matching)"
```

---

## 🐛 Troubleshooting

### Scripts Not Running?
1. Check `.env` file has correct Supabase credentials
2. Verify automation engine is running: `pm2 status` or `ps aux | grep automation`
3. Check logs for errors: `tail -f logs/automation.log`

### No Data Being Generated?
1. Verify tables exist: Run `verify-market-intelligence-tables.sql`
2. Check if startups have data: `SELECT COUNT(*) FROM startup_uploads WHERE status = 'approved'`
3. Check if talent pool has candidates: `SELECT COUNT(*) FROM talent_pool WHERE availability_status = 'available'`

### Network Errors?
- Scripts need network access to connect to Supabase
- If running in restricted environment, ensure network permissions are granted

---

## 📝 Next Steps

1. **Start Automation**: Run `node automation-engine.js` or use PM2
2. **Add Talent**: Populate `talent_pool` table with candidates
3. **Monitor**: Check logs and dashboards regularly
4. **Refine**: Adjust schedules and thresholds based on results

---

## 🎉 Success!

Once automation is running, you'll have:
- ✅ Daily market intelligence updates
- ✅ Automatic talent matching every 6 hours
- ✅ Historical trend data
- ✅ Real-time insights for investors and startups





