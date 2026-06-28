# Funding Rounds Extraction - Automated 🤖

## ✅ Automation Complete!

Funding rounds extraction is now fully automated and integrated into your automation engine.

## What's Automated

- **Extraction**: Runs every 2 hours automatically
- **Duplicate Prevention**: Checks for duplicates before inserting
- **Date Validation**: Fixes future dates automatically
- **Error Handling**: Robust error handling and logging
- **Startup Matching**: Automatically matches companies to your startups

## How It Works

1. **RSS Scraping** (every 30 min) → Collects articles
2. **Funding Extraction** (every 2 hours) → Extracts funding rounds from articles
3. **Automatic Matching** → Matches companies to startups
4. **Duplicate Prevention** → Skips duplicates automatically
5. **Saves to Database** → Inserts into `funding_rounds` table

## Files Created

- `extract-funding-rounds.js` - Main extraction script
- Integrated into `automation-engine.js` - Runs automatically

## Configuration

The extraction runs every **2 hours** (120 minutes). To change the interval, edit `automation-engine.js`:

```javascript
intervals: {
  funding_extraction: 120,  // Change to 60 for hourly, 240 for every 4 hours
}
```

## Manual Run

You can also run it manually anytime:

```bash
node extract-funding-rounds.js
```

## Monitoring

Check the automation logs:

```bash
# View automation logs
tail -f logs/automation.log

# Check PM2 status
pm2 status

# View specific process logs
pm2 logs automation-engine
```

## Expected Results

- **Extracts** funding rounds from RSS articles
- **Matches** companies to startups automatically
- **Prevents** duplicates
- **Builds** historical funding data over time
- **Enables** velocity calculations once startups have 2+ rounds

## Next Steps

1. **Let it run** - The automation will extract rounds every 2 hours
2. **Monitor** - Check logs to see extraction progress
3. **Build data** - Over time, you'll accumulate funding history
4. **Calculate velocity** - Once startups have 2+ rounds, enable velocity scoring

## Status

✅ **Automated** - Runs every 2 hours  
✅ **Integrated** - Part of automation-engine.js  
✅ **Production Ready** - Error handling and logging included  
✅ **Duplicate Prevention** - Built-in  
✅ **Date Validation** - Automatic  

The system will now continuously extract funding rounds from RSS articles! 🚀





