# ✅ Database Setup Complete!

## 🎉 **Your `scraper_selectors` table is ready!**

---

## 🧪 **Step 1: Verify Database Connection**

Run this test script to verify everything is working:

```bash
node scripts/test-scraper-database.js
```

**Expected output:**
```
✅ Table exists and is accessible!
📊 Current records: 0
✅ All tests passed! Database is ready.
```

---

## 🚀 **Step 2: Test the Scraper (Populate the Table)**

Run a scrape - this will automatically save selectors to your database:

```bash
node scripts/scrapers/resilient-scraper.js https://ycombinator.com/companies/airbnb startup
```

**What happens:**
1. ✅ Scraper fetches the page
2. ✅ Tries CSS selectors (like `h1`, `.name`, etc.)
3. ✅ Finds "Airbnb" using selector `h1`
4. ✅ **Saves selector to database automatically!**
5. ✅ Quality score: 88/100

---

## 📊 **Step 3: Check the Database**

After running the scrape:

1. **Go to Supabase Dashboard**
   - Click "Table Editor"
   - Open `scraper_selectors` table

2. **You should see new rows:**
   ```
   domain: "ycombinator.com"
   data_type: "startup"
   field: "name"
   selector: "h1"
   strategy: "css"
   success_rate: 100
   usage_count: 1
   active: true
   ```

---

## 🎯 **What Happens Next**

As you run more scrapes, the database will:

✅ **Save successful selectors** - Track what works  
✅ **Track success rates** - Learn which selectors are reliable  
✅ **Auto-learn** - Get better over time  
✅ **Auto-deactivate failing selectors** - Remove selectors with <30% success  

---

## 📋 **Quick Reference**

### **Test Database:**
```bash
node scripts/test-scraper-database.js
```

### **Run Scraper:**
```bash
# Basic scrape
node scripts/scrapers/resilient-scraper.js <url> <dataType>

# Examples:
node scripts/scrapers/resilient-scraper.js https://ycombinator.com/companies/airbnb startup
node scripts/scrapers/resilient-scraper.js https://ycombinator.com/companies/stripe startup --useAI
```

### **View Database:**
- Supabase Dashboard → Table Editor → `scraper_selectors`

---

## ✅ **You're All Set!**

The database is ready to:
- Store selector knowledge
- Track success rates
- Enable auto-learning
- Make your scraper smarter over time

**Run a scrape and watch it populate!** 🚀

