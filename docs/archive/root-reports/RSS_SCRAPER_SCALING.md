# 📈 RSS Scraper Scaling for 200-500 Startups/Day

## **Current Configuration**

- **RSS Sources:** 84 active sources
- **Items per feed:** 10 items
- **Sources per run:** 100 (limited)
- **Run frequency:** Every 30 minutes
- **Current output:** ~4-10 startups per run

## **To Reach 200-500 Startups/Day**

### **Option 1: Increase Items Per Feed** (Easiest)
```javascript
// In simple-rss-scraper.js, line ~462
const items = feed.items?.slice(0, 10) || [];  // Current: 10
// Change to:
const items = feed.items?.slice(0, 50) || [];  // New: 50 items per feed
```

**Impact:**
- 84 sources × 50 items = 4,200 articles per run
- With 1-2% extraction rate = 42-84 startups per run
- 48 runs/day × 50 startups = **2,400 startups/day** ✅

### **Option 2: Increase Run Frequency** (Also Easy)
```javascript
// In hot-match-autopilot.js, line ~35
DISCOVERY_INTERVAL: 30 * 60 * 1000,  // Current: 30 minutes
// Change to:
DISCOVERY_INTERVAL: 15 * 60 * 1000,  // New: 15 minutes
```

**Impact:**
- 96 runs/day instead of 48
- Same extraction rate = **2x more startups**

### **Option 3: Process More Sources** (Best)
```javascript
// In simple-rss-scraper.js, line ~443
.limit(100);  // Current: 100 sources per run
// Change to:
.limit(200);  // New: Process all 84+ sources every run
```

**Impact:**
- Process all active sources every run
- No sources left behind

### **Option 4: Combine All** (Recommended)
- ✅ 50 items per feed (instead of 10)
- ✅ 15-minute intervals (instead of 30)
- ✅ Process all sources (remove limit)

**Expected Result:**
- 84 sources × 50 items × 96 runs/day = **403,200 articles/day**
- 1% extraction rate = **4,032 startups/day** (way more than needed)
- 0.1% extraction rate = **403 startups/day** ✅ (perfect range)

---

## **Recommended Changes**

### **1. Increase Items Per Feed**
```javascript
// Line ~462 in simple-rss-scraper.js
const items = feed.items?.slice(0, 50) || [];  // 10 → 50
```

### **2. Increase Run Frequency**
```javascript
// Line ~35 in hot-match-autopilot.js
DISCOVERY_INTERVAL: 15 * 60 * 1000,  // 30 min → 15 min
```

### **3. Remove Source Limit**
```javascript
// Line ~443 in simple-rss-scraper.js
// .limit(100);  // Remove this line or set to 1000
```

---

## **Trade-offs**

### **More Items = More Processing Time**
- 10 items: ~2-5 seconds per feed
- 50 items: ~5-10 seconds per feed
- 84 feeds × 10s = ~14 minutes per run (acceptable)

### **More Frequent = More Load**
- 15-minute intervals = 96 runs/day
- Each run processes 84 feeds
- Total: 8,064 feed fetches/day

### **Recommendation**
Start with **50 items per feed** and **15-minute intervals**. This should easily hit 200-500 startups/day without overwhelming the system.

---

## **Monitoring**

After changes, monitor:
```bash
# Check discovered startups count
node -e "require('dotenv').config(); const {createClient} = require('@supabase/supabase-js'); const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY); supabase.from('discovered_startups').select('id', {count: 'exact', head: true}).then(({count}) => console.log('Discovered:', count));"

# Check import rate
pm2 logs hot-match-autopilot --lines 100 | grep "Imported"
```

