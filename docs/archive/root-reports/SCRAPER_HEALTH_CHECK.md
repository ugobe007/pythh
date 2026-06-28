# Scraper Health Check System

## What It Does

The health check script monitors your continuous scraper and can automatically fix issues:

✅ **Checks if process is running**
✅ **Detects if scraper is stuck** (no log updates in 35 minutes)
✅ **Finds errors in logs**
✅ **Detects multiple instances running**
✅ **Auto-restarts when needed**

## Quick Start

### Check Scraper Status
```bash
npm run scrape:check
```
Shows current status, recent logs, and any errors.

### Auto-Fix Issues
```bash
npm run scrape:fix
```
Checks status and automatically restarts if there are problems.

### Force Restart
```bash
npm run scrape:restart
```
Forces a restart regardless of status.

### View Live Logs
```bash
npm run scrape:logs
```
Shows real-time scraper output (Ctrl+C to exit).

## What Gets Checked

### 1. Process Running
- ✅ Is the scraper process active?
- ⚠️ Multiple instances? (shouldn't happen)
- ❌ Process died?

### 2. Activity Check
- ✅ Has the log file updated recently?
- ⚠️ No updates in 35+ minutes = stuck
- ❌ Log file missing?

### 3. Error Detection
- ✅ Scanning last 50 log lines
- ⚠️ Multiple errors = problems
- ❌ Critical failures?

## Auto-Restart Triggers

The scraper will auto-restart if:
1. **Process not running** - Scraper crashed or was never started
2. **Log hasn't updated in 35 minutes** - Scraper is stuck
3. **Multiple instances running** - Duplicate processes conflict
4. **Too many errors** - More than 3 errors in recent logs

## Example Output

```
🏥 Checking scraper health...

============================================================
🔍 SCRAPER HEALTH CHECK
============================================================

📊 Process Status:
   ✅ Running (PID: 26777)

📝 Log Status:
   ✅ Log file exists
   📅 Last updated: 2025-12-11T16:33:34.615Z
   ⏰ Age: 1 minutes ago

🚨 Error Status:
   ✅ No recent errors

📄 Recent Log Activity:
   🔍 [STARTUPS] Starting startup discovery...
   ✅ Discovered 5 new startups
   💾 Saved to database
   ⏰ Next cycle in 30 minutes

============================================================

✅ Scraper is healthy!
```

## Automated Monitoring with Cron

To automatically check and fix issues every 10 minutes, add to crontab:

```bash
# Edit crontab
crontab -e

# Add this line (replace with your actual path):
*/10 * * * * cd /Users/leguplabs/Desktop/hot-honey && node check-scraper-health.js --fix >> scraper-health.log 2>&1
```

This will:
- Run every 10 minutes
- Check scraper health
- Auto-restart if needed
- Log results to `scraper-health.log`

## Manual Commands

### Check without fixing
```bash
node check-scraper-health.js
```

### Check and auto-fix
```bash
node check-scraper-health.js --fix
```

### Force restart
```bash
node check-scraper-health.js --restart
```

### Show help
```bash
node check-scraper-health.js --help
```

## Troubleshooting

### Scraper keeps crashing
1. Check logs: `npm run scrape:logs`
2. Look for errors in last run
3. Check environment variables are set
4. Verify Supabase/OpenAI API keys

### Multiple instances running
```bash
# Find all processes
ps aux | grep continuous-scraper

# Kill specific PID
kill <PID>

# Or use the health check to fix
npm run scrape:fix
```

### No log updates
1. Check if scraper is actually running: `npm run scrape:check`
2. View recent logs: `tail -50 scraper.log`
3. Look for infinite loops or hangs
4. Restart: `npm run scrape:restart`

### Can't kill the scraper
```bash
# Force kill by PID
kill -9 <PID>

# Or kill all node processes (careful!)
pkill -9 node
```

## Integration with Admin Panel

Consider adding a health check button in the admin panel that calls:
```javascript
// In your admin component
const checkScraperHealth = async () => {
  const response = await fetch('/api/scraper/health');
  const status = await response.json();
  // Display status to user
};
```

## Log Files

- `scraper.log` - Main scraper output
- `scraper-health.log` - Health check history (if using cron)

## Best Practices

1. **Run health check before deploying** - Ensure scraper is working
2. **Set up cron job** - Automatic monitoring in production
3. **Monitor logs regularly** - Check for patterns or issues
4. **Keep logs trimmed** - Archive old logs to prevent disk fill-up

## Commands Summary

| Command | Description |
|---------|-------------|
| `npm run scrape:check` | Check status (no changes) |
| `npm run scrape:fix` | Check and auto-restart if needed |
| `npm run scrape:restart` | Force restart scraper |
| `npm run scrape:logs` | View live logs |
| `npm run scrape` | Run in foreground (testing) |
| `npm run scrape:bg` | Start in background (production) |
