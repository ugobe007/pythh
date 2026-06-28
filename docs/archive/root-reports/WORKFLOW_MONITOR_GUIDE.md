# Workflow Health Monitor Guide

## Overview

The workflow monitor checks all critical systems and notifies you when fixes are needed.

## Usage

### Manual Run
```bash
node workflow-monitor.js
```

### Scheduled Monitoring (Recommended)

#### Option 1: Cron Job (Mac/Linux)
```bash
# Edit crontab
crontab -e

# Add line to run every hour:
0 * * * * cd /Users/leguplabs/Desktop/hot-honey && node workflow-monitor.js >> workflow-monitor.log 2>&1

# Run every 15 minutes:
*/15 * * * * cd /Users/leguplabs/Desktop/hot-honey && node workflow-monitor.js >> workflow-monitor.log 2>&1

# Run once per day at 9 AM:
0 9 * * * cd /Users/leguplabs/Desktop/hot-honey && node workflow-monitor.js >> workflow-monitor.log 2>&1
```

#### Option 2: npm Script
Add to `package.json`:
```json
{
  "scripts": {
    "monitor": "node workflow-monitor.js",
    "monitor:watch": "nodemon --watch src --watch server workflow-monitor.js"
  }
}
```

Then run:
```bash
npm run monitor
```

## What It Checks

### 1. ✅ Environment Variables
- Verifies all required env vars are set
- Checks format validity

### 2. ✅ Database Connection
- Tests Supabase connectivity
- Verifies authentication

### 3. ✅ Database Schema
- Confirms all required tables exist
- Checks table accessibility

### 4. ✅ Investor Data Quality
- Total investor count
- Missing descriptions (bio)
- Missing sectors
- Missing stages
- Missing check sizes

### 5. ✅ Startup Data Quality
- Total startup count
- Missing extracted_data
- Pending reviews

### 6. ✅ Matching System Health
- Match generation working
- Match quality scores
- Recent match performance

### 7. ✅ Build Health
- Production build exists
- Build freshness (age)

### 8. ✅ Critical Files
- All essential files present
- No missing components

## Output

### Status Levels

- **✅ PASS**: Everything working correctly
- **⚠️ WARNING**: Non-critical issue, action recommended
- **❌ FAILURE**: System degraded, needs attention
- **🚨 CRITICAL**: Immediate action required

### Exit Codes

- `0` - All systems healthy
- `1` - Failures detected
- `2` - Critical issues detected
- `3` - Monitor crashed

## Notification Log

Results are saved to: `workflow-alerts.log`

Each line is a JSON object with:
```json
{
  "timestamp": "2025-12-12T10:30:00.000Z",
  "summary": {
    "passed": 15,
    "warnings": 2,
    "failures": 0,
    "critical": 0
  },
  "critical": [],
  "failures": [],
  "warnings": [
    {
      "category": "Investors",
      "message": "Only 60% have sectors - run enrichment",
      "timestamp": "2025-12-12T10:30:00.000Z"
    }
  ]
}
```

## Setting Up Alerts

### Email Notifications

1. Install nodemailer:
```bash
npm install nodemailer
```

2. Update `sendAlerts()` in workflow-monitor.js:
```javascript
const nodemailer = require('nodemailer');

async function sendAlerts() {
  if (results.critical.length >= CRITICAL_THRESHOLD) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.ALERT_EMAIL,
        pass: process.env.ALERT_EMAIL_PASSWORD
      }
    });

    await transporter.sendMail({
      from: process.env.ALERT_EMAIL,
      to: 'your-email@example.com',
      subject: `🚨 Hot Match Alert: ${results.critical.length} Critical Issues`,
      text: JSON.stringify(results.critical, null, 2)
    });
  }
}
```

### Slack Notifications

1. Create Slack webhook URL

2. Install axios:
```bash
npm install axios
```

3. Update `sendAlerts()`:
```javascript
const axios = require('axios');

async function sendAlerts() {
  if (results.critical.length >= CRITICAL_THRESHOLD) {
    await axios.post(process.env.SLACK_WEBHOOK_URL, {
      text: `🚨 *Hot Match Critical Alert*\n${results.critical.length} critical issues detected!`,
      attachments: results.critical.map(item => ({
        color: 'danger',
        title: item.category,
        text: item.message
      }))
    });
  }
}
```

## Common Issues & Fixes

### Issue: "No investors in database"
**Fix**: Run the scraper
```bash
node intelligent-scraper.js https://www.forbes.com/midas-list/ investors
```

### Issue: "Only X% have sectors"
**Fix**: Run enrichment script
```bash
node auto-enrich-investors.js
```

### Issue: "No matches generated"
**Fix**: Run auto-match service
```bash
node server/services/autoMatchService.js
```

### Issue: "Missing critical file"
**Fix**: Check git status and restore file
```bash
git status
git checkout <filename>
```

### Issue: "Database connection failed"
**Fix**: Check environment variables
```bash
cat .env | grep SUPABASE
```

## Monitoring Dashboard

View recent logs:
```bash
tail -n 50 workflow-alerts.log | jq '.'
```

Count issues by type:
```bash
cat workflow-alerts.log | jq '.summary'
```

View only critical issues:
```bash
cat workflow-alerts.log | jq 'select(.summary.critical > 0)'
```

## Integration with CI/CD

### GitHub Actions

Create `.github/workflows/health-check.yml`:
```yaml
name: Health Check
on:
  schedule:
    - cron: '0 */4 * * *'  # Every 4 hours
  workflow_dispatch:

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: node workflow-monitor.js
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          VITE_OPENAI_API_KEY: ${{ secrets.VITE_OPENAI_API_KEY }}
```

## Customization

### Add New Check

```javascript
async function checkMyCustomSystem() {
  console.log('\n🔧 Checking My System...');
  
  try {
    // Your check logic
    const isHealthy = await myHealthCheck();
    
    if (!isHealthy) {
      logResult('fail', 'MySystem', 'System is down');
      return false;
    }
    
    logResult('pass', 'MySystem', 'System healthy');
    return true;
  } catch (error) {
    logResult('fail', 'MySystem', 'Check failed', { error: error.message });
    return false;
  }
}

// Add to runHealthChecks():
await checkMyCustomSystem();
```

### Adjust Warning Thresholds

```javascript
// In checkInvestorDataQuality():
if (bioPercent < 30) {  // Changed from 50
  logResult('warn', 'Investors', `Only ${bioPercent}% have descriptions`);
}
```

## Best Practices

1. **Run regularly** - Set up cron to run every hour
2. **Monitor logs** - Check `workflow-alerts.log` daily
3. **Act on warnings** - Don't wait for critical alerts
4. **Test alerts** - Verify notification system works
5. **Update thresholds** - Adjust based on your needs

## Troubleshooting

### Monitor not running
```bash
# Check if node is installed
node --version

# Check file permissions
chmod +x workflow-monitor.js

# Run with debug
NODE_DEBUG=* node workflow-monitor.js
```

### Cron not working
```bash
# Check cron is running
sudo launchctl list | grep cron

# View cron logs
tail -f /var/log/cron.log
```

---

**Quick Start:**
```bash
# Test it now
node workflow-monitor.js

# Set up hourly checks
crontab -e
# Add: 0 * * * * cd /Users/leguplabs/Desktop/hot-honey && node workflow-monitor.js >> workflow-monitor.log 2>&1
```
