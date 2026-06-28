# 🎣 Scraper Commands - Quick Reference

## 🚀 Quick Start (Run All)

```bash
cd ~/Desktop/hot-honey
./RUN_SCRAPERS.sh
```

Or run individually:

---

## 📋 Individual Scripts (Priority Order)

### 1. **Clean Up Garbage** (First!)
```bash
node -e "
require('dotenv').config();
const {createClient} = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const garbage = ['New', 'Legacy', 'Why', 'Four', 'Six', 'Three', 'Gentle', 'Jakub', 'Reflections', 'GPT-4o', 'November', 'October', 'Talking', 'I\'ve', 'Empire', 'Open', 'How', 'Dear', 'Big', 'Rules', 'Quirky', 'Nvidia\'s', 'Even', 'College', 'Every', 'Our', 'Obsidian\'s', 'Millions', 'Competing', 'Almost', 'VCs', 'India', 'Investors', 'What\'s', 'Equity\'s', 'HLTH', 'Partnerships', 'Abundance', 'Demo', 'Congratulations', 'BillionToOne', 'Meet', 'Ankit', 'Dalton', 'Welcoming', 'Tyler', 'Abundant', 'Rapidly', 'Turning', 'Race', 'Highlights', 'Electroflow', 'We\'re', 'Lithuanian Repsense', 'Estonian MyDello', 'Danish EvodiaBio', 'Sweden\'s', 'Estonian'];
supabase.from('discovered_startups').delete().in('name', garbage).then(r => console.log('✅ Deleted', garbage.length, 'garbage entries'));
"
```

---

### 2. **RSS Scraper** ⚡ FAST (No AI, 5 min)
```bash
node simple-rss-scraper.js
```
**Expected:** 20-50+ startups from RSS feeds  
**Time:** ~5 minutes  
**Cost:** Free (no AI)

---

### 3. **Wellfound Scraper** ⭐ BEST SOURCE (10 min)
```bash
node intelligent-scraper.js "https://wellfound.com/discover/startups?stage=seed" startups
```
**Expected:** 20-30 startups  
**Time:** ~10 minutes  
**Cost:** Uses Anthropic API

**More Wellfound URLs:**
```bash
# Series A stage
node intelligent-scraper.js "https://wellfound.com/discover/startups?stage=series-a" startups

# AI sector
node intelligent-scraper.js "https://wellfound.com/discover/startups?sectors[]=artificial-intelligence" startups
```

---

### 4. **Speedrun Scraper** 🎯 HIGH QUALITY (5 min)
```bash
node speedrun-full.mjs --save
```
**Expected:** 0-10 new (most already in DB)  
**Time:** ~5 minutes  
**Cost:** Uses Anthropic API

---

### 5. **Multi-Source Discovery** 🚀 BULK (30 min)
```bash
node discover-more-startups.js
```
**Expected:** 30-50+ startups from multiple sources  
**Time:** ~30 minutes  
**Cost:** Uses Anthropic API

---

### 6. **YC Scraper** ⚠️ CURRENTLY BROKEN
```bash
node speedrun-yc-scraper.mjs yc
```
**Status:** Finding 0 startups (needs fix)  
**Note:** Skip for now, focus on working scrapers

---

## 📊 Check Results

```bash
# Count discovered startups
node -e "
require('dotenv').config();
const {createClient} = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
Promise.all([
  supabase.from('discovered_startups').select('id', {count: 'exact', head: true}),
  supabase.from('startup_uploads').select('id', {count: 'exact', head: true}).eq('status', 'approved')
]).then(([discovered, approved]) => {
  console.log('📊 DATABASE STATUS:');
  console.log('Discovered (pending):', discovered.count);
  console.log('Approved startups:', approved.count);
});
"

# See recent discoveries
node -e "
require('dotenv').config();
const {createClient} = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
supabase.from('discovered_startups').select('name, rss_source, created_at').order('created_at', {ascending: false}).limit(20).then(r => {
  console.log('🆕 RECENT DISCOVERIES:');
  r.data?.forEach((s, i) => console.log(\`  \${i+1}. \${s.name} (from \${s.rss_source || 'unknown'})\`));
});
"
```

---

## 🔄 Import Discovered Startups

After scraping, import to main table:

```bash
# Check if import script exists
ls import-discovered-startups.js

# If it exists, run it
node import-discovered-startups.js --auto
```

---

## ⚡ Recommended Daily Workflow

```bash
# 1. Clean garbage (if any)
# (run cleanup command above)

# 2. Run RSS scraper (fast, free)
node simple-rss-scraper.js

# 3. Run Wellfound (best source)
node intelligent-scraper.js "https://wellfound.com/discover/startups?stage=seed" startups

# 4. Check results
# (run check command above)

# 5. Import discovered startups
node import-discovered-startups.js --auto 2>/dev/null || echo "Import script not found"
```

**Expected daily yield:** 50-100+ new startups

---

## 🎯 Priority Order

1. ✅ **RSS Scraper** - Fast, free, reliable
2. ✅ **Wellfound** - Best quality, 20-30 per run
3. ✅ **Speedrun** - High quality (but mostly duplicates)
4. ⚠️ **YC** - Currently broken, skip for now
5. ✅ **Multi-source** - Good for bulk when you have time


