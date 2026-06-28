# ✅ Check Autopilot Status

## 🔍 **Verify It's Working**

### **1. Check Logs**
```bash
pm2 logs hot-match-autopilot --lines 50
```

**Look for**:
- ✅ "Starting autopilot in daemon mode..."
- ✅ "Running simple RSS scraper..."
- ✅ Feed names appearing
- ✅ "Found X items" messages
- ✅ No hanging (should see progress)

---

### **2. Check Recent Activity**
```bash
# See if RSS scraper is making progress
pm2 logs hot-match-autopilot --lines 100 | grep -E "📰|Found|Added|SUMMARY"
```

---

### **3. Check RSS Sources Status**
```bash
node scripts/check-rss-sources.js
```

**Look for**:
- ✅ Recent "Last Scraped" timestamps
- ✅ Sources being updated

---

## ⚡ **Quick Status Check**

### **PM2 Status:**
```bash
pm2 status
```

**hot-match-autopilot should show**:
- Status: `online`
- CPU: Low (< 5%)
- Memory: Reasonable (< 100MB)

---

### **Live Logs (Watch Progress):**
```bash
pm2 logs hot-match-autopilot
```

**Press `Ctrl+C` to exit when done watching**

---

## ✅ **Success Indicators**

After a few minutes, you should see:
- ✅ Feeds processing (feed names appearing)
- ✅ "Found X items" for each feed
- ✅ No infinite hanging
- ✅ Progress moving forward
- ✅ Eventually: "📊 SUMMARY" with results

---

## ⏱️ **Expected Timeline**

- **Start**: ~30 seconds to begin processing
- **Per Feed**: < 5 seconds (or timeout after 30s)
- **Total Time**: 10-20 minutes for 84 feeds
- **Completion**: Should see "📊 SUMMARY" at end

---

**Watch the logs to verify it's working!** 🚀

