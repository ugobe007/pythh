# Startup Discovery from RSS Feeds - Quick Guide

**Created:** December 10, 2025  
**Feature:** Automatic startup discovery and extraction from RSS feeds

---

## 📚 Overview

This feature automatically scrapes RSS feeds (TechCrunch, Crunchbase, Product Hunt, etc.) to discover startups mentioned in articles. It extracts:
- Startup names
- Websites
- Descriptions
- Funding information
- Investor mentions

Discovered startups are saved to a staging table and can be reviewed, exported, and bulk imported into your main startup database.

---

## 🗄️ Database Setup

### 1. Create the Table

Run this SQL in Supabase SQL Editor:

```bash
# File: supabase-discovered-startups.sql
```

This creates the `discovered_startups` table with:
- Basic company info (name, website, description)
- Funding details (amount, stage, investors)
- Source tracking (article URL, RSS source)
- Import status tracking
- Full RLS policies

---

## 🚀 How to Use

### Step 1: Run Discovery Script

```bash
node discover-startups-from-rss.js
```

This script:
1. Fetches all active RSS sources from `rss_sources` table
2. Scrapes recent articles (last 30 days)
3. Uses OpenAI GPT-4o-mini to extract startup mentions
4. Saves discovered startups to `discovered_startups` table
5. Automatically deduplicates by name

**Expected Runtime:** 5-10 minutes depending on number of RSS sources

### Step 2: Review Discovered Startups

Navigate to: **http://localhost:5173/admin/discovered-startups**

Features:
- ✅ View all discovered startups
- ✅ Filter by import status (All, Ready to Import, Already Imported)
- ✅ Select multiple startups
- ✅ Export selected to CSV
- ✅ See funding details, investors, source articles
- ✅ Click through to original articles

### Step 3: Export & Import

1. **Select Startups:** Check the boxes next to startups you want to import
2. **Export CSV:** Click "Export Selected" to download CSV file
3. **Bulk Import:** Use the CSV in `/admin/bulk-upload` to add to main database

---

## 📁 Files Created

```
/Users/leguplabs/Desktop/hot-honey/
├── supabase-discovered-startups.sql              # Database migration
├── discover-startups-from-rss.js                 # Discovery script
├── server/
│   ├── index.js                                  # Added API endpoint
│   └── services/
│       └── startupDiscoveryService.ts            # Core discovery service
└── src/
    ├── App.tsx                                   # Added route
    └── pages/
        └── DiscoveredStartups.tsx                # Admin UI page
```

---

## 🔧 Service Functions

### StartupDiscoveryService

Located: `server/services/startupDiscoveryService.ts`

**Main Methods:**

```typescript
// Discover startups from all RSS sources
await startupDiscoveryService.discoverStartupsFromRSS()

// Get unimported startups
await startupDiscoveryService.getUnimportedStartups()

// Mark as imported
await startupDiscoveryService.markAsImported(discoveredId, startupId)

// Bulk import to main table
await startupDiscoveryService.bulkImportToStartups([ids])
```

---

## 🎯 What Gets Extracted

From each article, the AI extracts:

```typescript
{
  name: "Startup Name",
  website: "https://startup.com",
  description: "Brief description of what they do",
  funding_amount: "$10M",
  funding_stage: "Series A",
  investors_mentioned: ["Sequoia Capital", "a16z"],
  article_url: "https://techcrunch.com/...",
  article_title: "Startup raises $10M...",
  article_date: "2025-12-10",
  rss_source: "TechCrunch Funding"
}
```

---

## 📊 Database Schema

```sql
discovered_startups (
  id                        UUID PRIMARY KEY
  name                      TEXT NOT NULL
  website                   TEXT
  description               TEXT
  funding_amount            TEXT
  funding_stage             TEXT
  investors_mentioned       TEXT[]
  article_url               TEXT
  article_title             TEXT
  article_date              TIMESTAMPTZ
  rss_source                TEXT
  imported_to_startups      BOOLEAN DEFAULT false
  startup_id                UUID
  discovered_at             TIMESTAMPTZ DEFAULT NOW()
)
```

---

## 🔄 Workflow

```
1. RSS Sources (rss_sources table)
        ↓
2. Discovery Script (discover-startups-from-rss.js)
        ↓
3. AI Extraction (GPT-4o-mini)
        ↓
4. Save to discovered_startups table
        ↓
5. Review in Admin UI (/admin/discovered-startups)
        ↓
6. Export selected startups to CSV
        ↓
7. Bulk upload to startups table (/admin/bulk-upload)
```

---

## 🎨 Admin UI Features

**Location:** `/admin/discovered-startups`

**Stats Dashboard:**
- Total Discovered
- Ready to Import
- Already Imported

**Filters:**
- All
- Ready to Import (not yet imported)
- Imported (already in main database)

**Actions:**
- Select individual startups
- Select all unimported
- Export to CSV
- Refresh data
- View source articles

**Card Details:**
- Company name & website
- Description
- Funding amount & stage
- Investors list
- Source & discovery date
- Link to original article
- Import status badge

---

## 🔑 API Endpoints

### Trigger Discovery
```bash
POST http://localhost:3002/api/rss/discover-startups
```

Returns:
```json
{
  "success": true,
  "message": "Startup discovery initiated...",
  "timestamp": "2025-12-10T..."
}
```

---

## 💡 Best Practices

### When to Run Discovery

- **Weekly:** Run once per week to catch new startups
- **After Adding RSS Sources:** Run after adding new feeds to `rss_sources`
- **Before Bulk Import:** Run discovery before planning a bulk import session

### Review Process

1. **Check for Duplicates:** Look for startups already in your database
2. **Verify Websites:** Check that extracted websites are correct
3. **Quality Filter:** Only import startups relevant to your focus
4. **Batch Import:** Export 10-50 at a time for easier management

### Performance Tips

- Script processes feeds sequentially with 2-second delays
- Limits to 15 most recent articles per source
- Uses GPT-4o-mini for cost efficiency
- Automatically deduplicates within same run

---

## 🐛 Troubleshooting

### No Startups Found

1. Check RSS sources are active: `SELECT * FROM rss_sources WHERE active = true`
2. Verify OpenAI API key is set in `.env`
3. Check if articles are recent (last 30 days)
4. Look for errors in console output

### Duplicate Entries

- Script checks for existing names before inserting
- Unique index on (name, website) prevents exact duplicates
- Manual deduplication available in admin UI

### Import Failures

- Verify `startups` table schema matches
- Check RLS policies allow insertion
- Ensure user is authenticated

---

## 🔐 Security

**Row Level Security (RLS):**
- ✅ Authenticated users can read/insert/update
- ✅ Service role has full access
- ✅ Admin authentication required for UI

**API Protection:**
- API endpoints are public (no auth) but logged
- Actual data access requires Supabase auth
- Admin UI checks authentication on mount

---

## 📈 Future Enhancements

**Planned Features:**
- [ ] Direct import button (skip CSV export)
- [ ] Website verification (check if URL is active)
- [ ] AI enrichment of discovered startups
- [ ] Duplicate detection with existing startups
- [ ] Filter by funding stage, investor, source
- [ ] Schedule automatic discovery (cron job)
- [ ] Email notifications for new discoveries

---

## 📝 Example Output

**Console Output:**
```
🚀 HOT MONEY HONEY - Startup Discovery Tool
═══════════════════════════════════════════

📡 Found 12 active RSS sources

📰 Processing: TechCrunch Funding
   📅 15 recent articles
   ✅ Found 8 startups

📰 Processing: Crunchbase News
   📅 18 recent articles
   ✅ Found 12 startups

✨ Total startups discovered: 47

💾 Saving 47 discovered startups to database...
✅ Saved: 39 | Skipped (duplicates): 8

✨ DISCOVERY COMPLETE!
```

---

## 🎯 Success Metrics

**After Running Discovery:**
- Check `/admin/discovered-startups` for count
- Should see 30-100 new startups per week
- 60-70% should be unique (not duplicates)
- 80%+ should have valid websites
- 40-50% should have funding details

---

## 🤝 Integration with Existing Features

**Works with:**
- ✅ RSS Manager (`/admin/rss-manager`)
- ✅ Bulk Upload (`/admin/bulk-upload`)
- ✅ Startup Database (`startups` table)
- ✅ Admin Dashboard (`/admin/dashboard`)

**Data Flow:**
```
RSS Feeds → Discovery → discovered_startups → CSV Export → Bulk Upload → startups table
```

---

## 📞 Support

**Issues?**
1. Check console logs during discovery
2. Verify Supabase connection
3. Confirm OpenAI API key is valid
4. Check RLS policies in Supabase
5. Review table structure matches migration

---

*Last Updated: December 10, 2025*
*Feature Status: ✅ Production Ready*
