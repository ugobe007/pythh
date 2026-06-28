# ✅ Simple Status Check Commands

## **Check Discovered Startups**

```bash
node scripts/check-discovered-startups.js
```

This will show:
- 📦 Unimported discovered startups
- 📊 Discovered in last 24h
- ✅ Imported in last 24h
- 🚀 Rate (startups/hour and projected daily)

---

## **Check Autopilot Logs**

```bash
pm2 logs hot-match-autopilot --lines 50
```

Look for:
- ✅ "RSS scrape complete"
- ✅ "Discovered startups pending: [number]"
- ✅ "Import complete"

---

## **Check RSS Scraper Directly**

```bash
npm run scrape
```

This runs the RSS scraper directly and shows what it discovers.

---

## **Quick Commands Reference**

```bash
# Check status
node scripts/check-discovered-startups.js

# View logs
pm2 logs hot-match-autopilot

# Restart autopilot
pm2 restart hot-match-autopilot --update-env

# Check all PM2 processes
pm2 status
```

---

**Much simpler!** Just run: `node scripts/check-discovered-startups.js`

