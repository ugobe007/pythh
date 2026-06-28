# 🔄 Quick Restart Guide - Fix Hanging Scraper

## ✅ **Fix Applied**

The scraper now has:
- ✅ **30-second timeout per feed** - won't hang on slow feeds
- ✅ **Better error handling** - continues even if feeds fail
- ✅ **Timeout protection on DB updates** - won't hang on database

---

## 🚀 **Restart Steps**

### **1. Stop the Hanging Process**
```bash
pm2 stop hot-match-autopilot
```

### **2. Restart with Fix**
```bash
pm2 restart hot-match-autopilot
```

### **3. Watch Logs**
```bash
pm2 logs hot-match-autopilot --lines 100
```

**Expected**: Should see feeds processing quickly and completing in 10-20 minutes.

---

## 📊 **What You Should See**

After restart, logs should show:
- ✅ Each feed name appearing
- ✅ "Found X items" messages
- ✅ Feeds completing in < 5 seconds each
- ✅ "⏱️ Timeout" messages for any slow feeds (if any)
- ✅ "📊 SUMMARY" at the end
- ✅ Scraper completing successfully

---

## ⚠️ **If Still Hanging**

If it still hangs, check which feed:
1. Look at logs: `pm2 logs hot-match-autopilot`
2. Find the last feed name shown
3. That feed might need to be deactivated:
   ```bash
   # Check feed status
   node scripts/check-rss-sources.js
   
   # Deactivate if needed (update in Supabase)
   ```

---

## ✅ **Success Indicators**

After restart, you should see:
- ✅ Scraper completes in 10-20 minutes
- ✅ Processes all 84 active feeds
- ✅ Finds new startups
- ✅ No infinite hanging

---

**Restart now**: `pm2 restart hot-match-autopilot` 🚀

