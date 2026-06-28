# 🗄️ Database Setup Instructions

## ✅ **Quick Setup (Recommended)**

### **Option 1: Supabase Dashboard (Easiest - 2 minutes)**

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run Migration**
   - Open `migrations/create_scraper_selectors_table.sql` in your editor
   - Copy the entire contents
   - Paste into Supabase SQL Editor
   - Click "Run" (or press Cmd/Ctrl + Enter)

4. **Verify**
   - You should see "Success. No rows returned"
   - The table is now created! ✅

---

### **Option 2: Automated Script (Alternative)**

```bash
# Run the setup script
node scripts/setup-scraper-database.js
```

**Note**: This may require manual execution if Supabase doesn't support direct SQL execution via API.

---

## 📋 **What Gets Created**

### **Table: `scraper_selectors`**

Stores:
- ✅ CSS selectors per website/pattern
- ✅ Success rates (0-100%)
- ✅ Usage counts and failure counts
- ✅ Last success/failure timestamps
- ✅ Metadata (JSON)

**Columns:**
- `id` - UUID primary key
- `domain` - Website domain (e.g., "ycombinator.com")
- `data_type` - Type of data ("startup", "investor", "article")
- `field` - Field name ("name", "description", "funding")
- `selector` - CSS selector or strategy
- `strategy` - Parsing strategy ("css", "ai", "pattern", "browser")
- `success_rate` - 0-100 percentage
- `usage_count` - How many times used
- `failure_count` - How many times failed
- `active` - Whether selector is active
- `metadata` - Additional JSON data

---

## ✅ **Verify Setup**

After running the migration, test:

```bash
node scripts/scrapers/resilient-scraper.js https://ycombinator.com/companies/airbnb startup
```

**Expected**: No database warnings, selectors being saved automatically.

---

## 🔍 **Check Table Exists**

In Supabase Dashboard:
1. Go to "Table Editor"
2. Look for `scraper_selectors` table
3. Should see the table with all columns

Or run in SQL Editor:
```sql
SELECT COUNT(*) FROM scraper_selectors;
-- Should return 0 (empty table, but exists)
```

---

## 🚀 **After Setup**

Once the table is created:
- ✅ Selectors are automatically saved
- ✅ Success rates are tracked
- ✅ Failed selectors are deactivated (<30% success)
- ✅ Scraper learns and improves over time

---

## 📝 **Migration File Location**

`migrations/create_scraper_selectors_table.sql`

---

**Ready to set up?** Use Option 1 (Supabase Dashboard) - it's the fastest! 🚀

