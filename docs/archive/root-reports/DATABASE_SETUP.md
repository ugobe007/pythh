# 🗄️ Database Setup for Scraper Selectors

## ⚠️ **Optional but Recommended**

The scraper works **without** the database table, but **with** it:
- ✅ Selectors are saved for future use
- ✅ Success rates are tracked
- ✅ Auto-learning improves over time

---

## 🚀 **Quick Setup**

### **Option 1: Supabase Dashboard (Easiest)**

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy the contents of `migrations/create_scraper_selectors_table.sql`
4. Run the SQL
5. Done! ✅

### **Option 2: Supabase CLI**

```bash
# If you have Supabase CLI installed
supabase db push migrations/create_scraper_selectors_table.sql
```

---

## 📋 **What the Table Stores**

- **CSS selectors** that worked for each website
- **Success rates** per selector
- **Usage counts** and failure counts
- **Auto-learning** - selectors with <30% success are deactivated

---

## ✅ **Verify It's Set Up**

After running the migration, test the scraper again:

```bash
node scripts/scrapers/resilient-scraper.js https://ycombinator.com/companies/airbnb startup
```

You should see:
- No database warnings
- Selectors being saved
- "✅ Success with css strategy" message

---

## 📊 **Current Status**

Your scraper **is working** without the database:
- ✅ Successfully parsed "Airbnb" from YC page
- ✅ Quality score: 88/100
- ✅ CSS strategy worked

The database table just enables **learning** - it's optional for now!

---

**Note**: The warnings about the table are harmless. The scraper works perfectly without it, but runs even better with it! 🚀

