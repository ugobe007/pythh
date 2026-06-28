# 🔍 Check RSS Scraper Status

## **Quick Status Check**

Run these commands to verify everything is working:

### **1. Check if Autopilot is Running**
```bash
pm2 status | grep hot-match-autopilot
```

Should show: `online` status

### **2. Check Recent Logs (Last 30 lines)**
```bash
pm2 logs hot-match-autopilot --lines 30 --nostream
```

Look for:
- ✅ "RSS scrape complete" (not errors)
- ✅ "Discovered startups pending: [number]"
- ✅ "Import complete"

### **3. Count Discovered Startups**
```bash
node -e "require('dotenv').config(); const {createClient} = require('@supabase/supabase-js'); const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY); supabase.from('discovered_startups').select('id', {count: 'exact', head: true}).eq('imported_to_startups', false).then(({count}) => console.log('📦 Unimported discovered startups:', count || 0));"
```

### **4. Count Total Discovered (Last 24 Hours)**
```bash
node -e "require('dotenv').config(); const {createClient} = require('@supabase/supabase-js'); const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY); const yesterday = new Date(Date.now() - 24*60*60*1000).toISOString(); supabase.from('discovered_startups').select('id', {count: 'exact', head: true}).gte('created_at', yesterday).then(({count}) => console.log('📊 Discovered in last 24h:', count || 0));"
```

### **5. Check RSS Sources Status**
```bash
node -e "require('dotenv').config(); const {createClient} = require('@supabase/supabase-js'); const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY); supabase.from('rss_sources').select('id, name, active, last_scraped').eq('active', true).limit(10).then(({data}) => { console.log('📡 Active RSS Sources:', data?.length || 0); data?.slice(0, 5).forEach(s => console.log('  -', s.name, s.last_scraped ? '(scraped)' : '(never scraped)')); });"
```

---

## **Expected Results**

### **After 1 Hour:**
- Discovered startups: 50-200 (if running properly)
- Unimported: Should be processed and imported

### **After 24 Hours:**
- Discovered startups: 200-500+ (target range)
- Imported: Most should be imported

---

## **If Not Working**

### **Check for Errors:**
```bash
pm2 logs hot-match-autopilot --err --lines 50
```

### **Manual Test:**
```bash
# Test RSS scraper directly
npm run scrape

# Should show:
# - Processing feeds
# - Found X items
# - Added: X startups
```

---

## **Troubleshooting**

### **If "Discovered startups pending: 0"**
- RSS scraper might not be finding startups
- Check if company name extraction is working
- Check if feeds are returning articles

### **If Import Errors**
- Check auto-import-pipeline.js logs
- Verify database connection
- Check for duplicate startups

---

**Status:** Check these to verify scraper is working

