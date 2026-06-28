# 🔧 Fix Your Scrapers - Complete Guide

## The Problem

You have **multiple overlapping systems** that don't work together:

1. ❌ **automation-engine.js** - Calls scripts that don't exist
2. ❌ **scripts/hot-match-autopilot.js** - Another orchestrator (different approach)
3. ❌ **system-guardian.js** - Monitors but doesn't orchestrate
4. ❌ **Multiple scrapers** - No clear hierarchy

## The Solution

### ✅ Use `unified-scraper-orchestrator.js`

This is your **single source of truth** that:
- ✅ Only calls scripts that actually exist
- ✅ Has proper error handling and retries
- ✅ Integrates all components (Parse.bot, inference, scrapers)
- ✅ Clear logging and monitoring

## Quick Start

### 1. Run Once (Test)
```bash
cd ~/Desktop/hot-honey
node unified-scraper-orchestrator.js
```

### 2. Run Continuously (Daemon)
```bash
node unified-scraper-orchestrator.js --daemon
```

### 3. Run with PM2 (Production)
```bash
pm2 start unified-scraper-orchestrator.js --name scraper-orchestrator -- --daemon
pm2 save
```

## What It Does

### Pipeline Steps:

1. **📡 Discovery** (every 30 min)
   - RSS scraper (`simple-rss-scraper.js`)
   - Intelligent scraper (`intelligent-scraper.js` - Wellfound)
   - Speedrun scraper (`speedrun-full.mjs`)
   - Auto-imports discovered startups

2. **🧠 Inference** (every 60 min)
   - Startup inference engine (`startup-inference-engine.js`)
   - Investor inference engine (`investor-inference-engine.js`)

3. **⚡ Scoring** (every 2 hours)
   - GOD Score calculation (`god-score-v5-tiered.js`)

4. **🔗 Matching** (every 4 hours)
   - Match generation (`queue-processor-v16.js`)

5. **🔍 Validation** (daily)
   - Data quality audit (`data-quality-audit.mjs`)

## Integration with Your Components

### ✅ Parse.bot Dynamic Parser
- Located: `lib/dynamic-parser.js`
- Status: **EXISTS** but not integrated
- **Action**: Update `intelligent-scraper.js` to use it

### ✅ Inference Engine
- Located: `startup-inference-engine.js`, `investor-inference-engine.js`
- Status: **EXISTS** and **INTEGRATED** ✅
- Runs automatically every 60 minutes

### ✅ Stagehand
- Status: **ABANDONED** (switched to Playwright + Claude)
- **Action**: Remove Stagehand references, use Playwright directly

### ✅ Guardian Scout
- Located: `system-guardian.js`
- Status: **EXISTS** but separate
- **Action**: Run alongside orchestrator (monitors, doesn't orchestrate)

## What's Fixed

### ✅ Script Name Mismatches
- `automation-engine.js` called `run-rss-scraper.js` → Now uses `simple-rss-scraper.js` or `run-rss-scraper.js` (whichever exists)
- `automation-engine.js` called `discover-startups-from-rss.js` → Now uses `discover-more-startups.js` (if exists)
- `automation-engine.js` called `generate-matches.js` → Now uses `queue-processor-v16.js` ✅

### ✅ Missing Scripts
- All scripts checked for existence before calling
- Fallback to alternative scripts when available
- Clear error messages when scripts don't exist

### ✅ Error Handling
- Retry logic (3 attempts with 5s delay)
- Timeout handling
- Clear error logging
- Continues even if one step fails

## Next Steps

### 1. Test the Orchestrator
```bash
node unified-scraper-orchestrator.js
```

### 2. Check Logs
```bash
tail -f logs/unified-orchestrator.log
```

### 3. Integrate Parse.bot Parser
Update `intelligent-scraper.js` to use `lib/dynamic-parser.js`:
```javascript
const DynamicParser = require('./lib/dynamic-parser');
const parser = new DynamicParser();
const data = await parser.parse(url, schema);
```

### 4. Run Guardian Alongside
```bash
# In separate terminal or PM2
pm2 start system-guardian.js --name guardian --cron "*/10 * * * *"
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│           UNIFIED SCRAPER ORCHESTRATOR                        │
│              (single source of truth)                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Discovery   │→ │  Inference  │→ │   Scoring    │       │
│  │  (30 min)    │  │  (60 min)    │  │  (2 hours)   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│         │                 │                  │                │
│         └─────────────────┴──────────────────┘                │
│                            │                                  │
│                            ▼                                  │
│                    ┌──────────────┐                          │
│                    │   Matching   │                          │
│                    │  (4 hours)   │                          │
│                    └──────────────┘                          │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              SYSTEM GUARDIAN (separate)                     │
│              (monitors, doesn't orchestrate)                  │
└─────────────────────────────────────────────────────────────┘
```

## Stop Using These

❌ **automation-engine.js** - Replaced by unified orchestrator
❌ **scripts/hot-match-autopilot.js** - Replaced by unified orchestrator
❌ **launch-scrapers.sh** - Replaced by unified orchestrator

## Keep Using These

✅ **system-guardian.js** - Run alongside (monitors health)
✅ **unified-scraper-orchestrator.js** - Your new orchestrator
✅ **Individual scrapers** - Called by orchestrator automatically

## Troubleshooting

### Script not found?
- Check `SCRIPTS` object in `unified-scraper-orchestrator.js`
- Add your script if it exists with a different name

### Errors in logs?
- Check `logs/unified-orchestrator.log`
- Each error includes script name, error message, and timestamp

### Not running automatically?
- Use `--daemon` flag or PM2
- Check intervals in `CONFIG.intervals`

### Want to add a new scraper?
1. Add to `SCRIPTS` object
2. Add to appropriate pipeline step
3. Test with `node unified-scraper-orchestrator.js`


