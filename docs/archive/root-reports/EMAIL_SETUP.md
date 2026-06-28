# 📧 Email Alert Setup Guide

Your workflow monitor is now configured to send email alerts to **ugobe07@gmail.com**.

## Quick Setup (5 minutes)

### Step 1: Create Gmail App Password

Since Gmail requires 2-factor authentication, you need to create an "App Password":

1. **Go to your Google Account**: https://myaccount.google.com/
2. **Security** → **2-Step Verification** (enable if not already)
3. **App passwords**: https://myaccount.google.com/apppasswords
4. **Select app**: Mail
5. **Select device**: Other (Custom name) → "Hot Match Monitor"
6. **Click Generate**
7. **Copy the 16-character password** (format: xxxx xxxx xxxx xxxx)

### Step 2: Update .env File

```bash
# Open .env and update these lines:
ALERT_EMAIL=your-email@gmail.com
ALERT_EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
```

**Important**: Use the App Password, NOT your regular Gmail password!

### Step 3: Test It

```bash
node workflow-monitor.js
```

You should receive an email within seconds if there are any warnings/failures.

---

## Email Alert Behavior

### When You'll Get Emails

- ⚠️ **Warnings**: Match scores low, data quality issues
- ❌ **Failures**: Missing data, system errors
- 🚨 **Critical**: Database down, multiple failures

### When You WON'T Get Emails

- ✅ All systems healthy (no warnings/failures)

### Email Contains

- Summary of passed/warned/failed/critical checks
- Detailed list of issues with timestamps
- Color-coded severity levels
- Link to workflow-alerts.log for full details

---

## Example Email

```
Subject: ❌ 2 System Failures - Hot Match

🚨 Hot Match Workflow Monitor
Report generated: Dec 12, 2025, 10:54 PM

Summary:
✅ Passed: 8
⚠️ Warnings: 1
❌ Failures: 2
🚨 Critical: 0

❌ Failures (Action Needed)

1. Investors
   Quality check failed
   {"error": "column investors.checkSize does not exist"}

2. Startups
   27/50 missing enriched data - check scraper

⚠️ Warnings (Action Recommended)

1. Matching
   Average match score low: 37.1% - check algorithm
```

---

## Automated Monitoring

### Hourly Checks (Recommended)

```bash
# Add to crontab (crontab -e):
0 * * * * cd /Users/leguplabs/Desktop/hot-honey && node workflow-monitor.js >> workflow-monitor.log 2>&1
```

You'll receive an email every hour if there are issues.

### Every 15 Minutes (Aggressive)

```bash
*/15 * * * * cd /Users/leguplabs/Desktop/hot-honey && node workflow-monitor.js >> workflow-monitor.log 2>&1
```

### Daily Summary (9 AM)

```bash
0 9 * * * cd /Users/leguplabs/Desktop/hot-honey && node workflow-monitor.js >> workflow-monitor.log 2>&1
```

---

## Troubleshooting

### "Invalid login: 535-5.7.8 Username and Password not accepted"

**Solution**: You're using your regular Gmail password. Use the App Password instead.

### "Error: Missing credentials for PLAIN"

**Solution**: Check that ALERT_EMAIL and ALERT_EMAIL_PASSWORD are set in .env

### No Email Received

1. Check spam/junk folder
2. Verify App Password is correct
3. Check console for error messages
4. Run `node workflow-monitor.js` manually to see errors

### Gmail Security Alert

**Solution**: Normal! Google may email you about "new sign-in". Click "Yes, it was me" to approve.

---

## Customization

### Change Recipient Email

Edit [workflow-monitor.js](workflow-monitor.js) line ~167:

```javascript
to: 'different-email@example.com',
```

### Change Alert Threshold

Edit [workflow-monitor.js](workflow-monitor.js) line ~14:

```javascript
const CRITICAL_THRESHOLD = 5; // Send urgent alert if 5+ critical issues
```

### Add Multiple Recipients

```javascript
to: 'ugobe07@gmail.com, team@example.com',
```

### Disable Emails for Warnings

Edit [workflow-monitor.js](workflow-monitor.js) line ~255:

```javascript
const shouldAlert = results.failures.length > 0 || results.critical.length > 0;
// Removed: results.warnings.length > 0
```

---

## Advanced: Other Email Providers

### Using Outlook/Hotmail

```javascript
service: 'hotmail',
auth: {
  user: 'your-email@outlook.com',
  pass: 'your-password'
}
```

### Using Custom SMTP

```javascript
host: 'smtp.example.com',
port: 587,
secure: false,
auth: {
  user: 'your-email@example.com',
  pass: 'your-password'
}
```

---

## Security Best Practices

1. ✅ **Use App Passwords** - Never use your real Gmail password
2. ✅ **Keep .env Private** - Never commit to Git
3. ✅ **Rotate Passwords** - Change App Password every 6 months
4. ✅ **Limited Scope** - App Password only for this monitor

---

## Next Steps

1. Create Gmail App Password ⬆️
2. Update .env with credentials
3. Test: `node workflow-monitor.js`
4. Set up cron job for automated monitoring
5. Check email for alerts!

**Questions?** Check [WORKFLOW_MONITOR_GUIDE.md](WORKFLOW_MONITOR_GUIDE.md) for more details.
