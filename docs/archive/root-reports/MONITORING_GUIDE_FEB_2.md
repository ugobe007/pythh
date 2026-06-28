# 🔍 Quick Monitoring Guide - Post-Fix Feb 2, 2026

## 1. ML Agent Health Check

### Status Check
```bash
pm2 status ml-ontology-agent
```

**Expected:**
- Status: 🟢 **online**
- Autorestart: **true** (self-healing enabled)
- Uptime: Should increase continuously (unless cron restart)
- Memory: 50-100 MB normal

### View Recent Activity
```bash
pm2 logs ml-ontology-agent --lines 30 --nostream
```

**Look for:**
- ✓ Entity classifications (STARTUP, PLACE, GENERIC_TERM)
- ✓ Confidence scores (85%+ = auto-applied)
- ✓ "Parser will automatically use new ontologies" message

### Manual Trigger (if needed)
```bash
pm2 restart ml-ontology-agent
```

---

## 2. Live Investor Signals Check

### Frontend Test
Visit https://pythh.ai (main page)

**Verify:**
- ✅ Top ticker scrolling with investor names
- ✅ Green "Live" badge next to "Investor Signals"
- ✅ Table showing 8 investors with scores
- ✅ Data refreshes every 60 seconds

### Database Query
```sql
-- Check if we have investor data
SELECT 
  name, 
  sectors, 
  stage,
  created_at,
  updated_at
FROM investors
ORDER BY created_at DESC
LIMIT 10;
```

**Expected:** 20+ investors with recent timestamps

### Browser Console Test
```javascript
// Open browser console on pythh.ai
// Should see data fetching without errors
// Look for: "Failed to fetch live signals" = NOT GOOD
```

---

## 3. Dashboard Nav Check

### Test All Routes
Visit each route - should see **ONE nav bar only**:

- ✅ https://pythh.ai/app (Dashboard)
- ✅ https://pythh.ai/app/engine
- ✅ https://pythh.ai/app/signals
- ✅ https://pythh.ai/app/logs

**What to look for:**
- Single nav at top: "Dashboard | Engine | Signals | Logs"
- NO duplicate "PYTHH" brand + nav below it
- Consistent header across all pages

---

## 4. RSS Scraper Performance

### Check Collection Rate
```bash
pm2 logs rss-scraper --lines 20 --nostream
```

### Database Query
```sql
-- Events collected in last hour
SELECT 
  COUNT(*) as events_last_hour,
  COUNT(*) FILTER (WHERE event_type != 'OTHER') as classified,
  ROUND(COUNT(*) FILTER (WHERE event_type != 'OTHER') * 100.0 / COUNT(*), 2) as accuracy_pct
FROM startup_events
WHERE created_at > NOW() - INTERVAL '1 hour';
```

**Expected:**
- Events/hour: 40-60
- Accuracy: 15-20% (improving as filters deploy)

---

## 5. Alert Conditions

### 🚨 RED FLAGS - Immediate Action

| Condition | Command | Expected | Alert |
|-----------|---------|----------|-------|
| ML agent stopped | `pm2 status ml-ontology-agent` | online | 🚨 If stopped, check logs |
| High restart rate | `pm2 describe ml-ontology-agent \| grep restarts` | <15/day | 🚨 If >20, investigate crash cause |
| No live data | Check pythh.ai ticker | Scrolling names | 🚨 If "Unknown Investor", check DB |
| Double nav | Visit /app | 1 nav bar | 🚨 If 2 nav bars, check Dashboard.tsx |

### ⚠️ WARNINGS - Monitor

| Condition | Threshold | Action |
|-----------|-----------|--------|
| ML agent memory | >200 MB | Check for memory leak |
| RSS scraper errors | >30% | Check [SCRAPER_EFFECTIVENESS_REPORT.md](SCRAPER_EFFECTIVENESS_REPORT.md) |
| Live data stale | >5 min | Check Supabase connection |
| Classification accuracy | <10% | Run source quality audit |

---

## 6. Quick Fixes

### ML Agent Not Running
```bash
pm2 restart ml-ontology-agent
pm2 logs ml-ontology-agent --lines 50
```

### Live Data Not Updating
```bash
# Check Supabase connection
psql $DATABASE_URL -c "SELECT COUNT(*) FROM investors;"

# Clear browser cache
# Hard refresh: Cmd+Shift+R (Mac) / Ctrl+Shift+R (PC)
```

### Double Nav Bar Returns
```bash
# Check if Dashboard.tsx was reverted
grep -n "Topbar (Supabase-like)" src/pages/app/Dashboard.tsx

# Should return nothing - if it exists, nav was re-added
```

---

## 7. Daily Health Check Script

```bash
#!/bin/bash
echo "=== PYTHH HEALTH CHECK ==="
echo ""
echo "1. ML Agent:"
pm2 describe ml-ontology-agent | grep -E "status|restart|uptime"
echo ""
echo "2. RSS Scraper:"
pm2 describe rss-scraper | grep -E "status|uptime"
echo ""
echo "3. Events Last Hour:"
psql $DATABASE_URL -c "SELECT COUNT(*) as events FROM startup_events WHERE created_at > NOW() - INTERVAL '1 hour';"
echo ""
echo "4. Investors in DB:"
psql $DATABASE_URL -c "SELECT COUNT(*) as total FROM investors;"
echo ""
echo "=== END CHECK ==="
```

Save as `scripts/health-check.sh`, then:
```bash
chmod +x scripts/health-check.sh
./scripts/health-check.sh
```

---

## 8. Useful PM2 Commands

```bash
# View all processes
pm2 list

# Restart specific process
pm2 restart ml-ontology-agent

# Restart all processes
pm2 restart all

# View logs (live)
pm2 logs ml-ontology-agent

# View logs (last 50 lines)
pm2 logs ml-ontology-agent --lines 50 --nostream

# Reload ecosystem config
pm2 reload ecosystem.config.js

# Stop process (temporary)
pm2 stop ml-ontology-agent

# Delete process (remove from PM2)
pm2 delete ml-ontology-agent
```

---

## Related Documentation

- [FIXES_COMPLETED_FEB_2.md](FIXES_COMPLETED_FEB_2.md) - Complete fix details
- [SCRAPER_EFFECTIVENESS_REPORT.md](SCRAPER_EFFECTIVENESS_REPORT.md) - Scraper performance analysis
- [OTHER_CLASSIFICATION_ANALYSIS.md](OTHER_CLASSIFICATION_ANALYSIS.md) - Classification accuracy deep dive
- [SYSTEM_GUARDIAN.md](SYSTEM_GUARDIAN.md) - Automated health monitoring

---

**Last Updated:** February 2, 2026  
**Status:** ✅ All systems operational
