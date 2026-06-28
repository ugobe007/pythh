# 🎛️ ADMIN DASHBOARD GUIDE

## **How to Access Everything**

### **Main Dashboard**
**URL:** `/admin`

**Quick Stats (Top Row):**
- Startups count
- Investors count
- Total matches
- Average GOD score
- New matches (24h)
- New scores (24h)
- Error count

---

## **VITAL Section (Red Badge)**

### **1. Workflow Dashboard**
**Click:** "Workflow Dashboard" panel  
**Shows:**
- Real-time pipeline status
- Script execution logs
- Process health
- Error alerts

**What You Can Do:**
- See what scripts are running
- View recent activity
- Identify bottlenecks
- Fix errors

---

### **2. ML Agent**
**Click:** "ML Agent" panel  
**Or go to:** `/admin/ml-dashboard`

**Shows:**
- Pending ML recommendations
- Training status
- ML metrics
- Settings

**What You Can Do:**
- View recommendations
- Apply recommendations
- Run training cycles
- Adjust ML settings

---

### **3. GOD Agent**
**Click:** "GOD Agent" panel  
**Or go to:** `/admin/god-settings`

**Shows:**
- Score deviations (big changes)
- Current algorithm weights
- Score distribution

**What You Can Do:**
- Adjust GOD algorithm weights
- View score history
- Monitor deviations
- Reset to defaults

---

### **4. Data Scrapers**
**Click:** "Data Scrapers" panel  
**Or go to:** `/admin/scrapers`

**Shows:**
- All scraper status
- Last run times
- Success/error counts

**What You Can Do:**
- Enable/disable scrapers
- Run scrapers manually
- Configure settings
- View logs

---

## **IMPORTANT Section (Orange Badge)**

### **5. GOD Scores**
**Click:** "GOD Scores" panel  
**Or go to:** `/admin/god-scores`

**Shows:**
- All startup GOD scores
- Score breakdown (Team, Traction, Market, Product, Vision)
- Industry scores
- Score distribution

**What You Can Do:**
- View individual scores
- Filter by status
- Sort by score
- Export data

---

### **6. GOD Score Benchmarks**
**Click:** "GOD Score Benchmarks" panel  
**Or go to:** `/admin/benchmarks`

**Shows:**
- Industry benchmarks
- Score comparisons
- Performance metrics

---

### **7. Performance Analytics**
**Click:** "Performance Analytics" panel  
**Or go to:** `/admin/analytics`

**Shows:**
- Match analytics
- Data quality metrics
- System performance
- User engagement

---

## **ROUTINE Section (Blue Badge)**

### **8. Discovered Startups**
**Click:** "Discovered Startups" panel  
**Or go to:** `/admin/discovered-startups`

**Shows:**
- Startups discovered from RSS
- Import status
- Pending imports

---

### **9. Investors**
**Click:** "Investors" panel  
**Or go to:** `/admin/investors`

**Shows:**
- All investors
- Profile completeness
- Investment preferences

---

### **10. Matches**
**Click:** "Matches" panel  
**Shows:**
- Total matches
- Match quality distribution
- Recent matches

---

## **NEEDS FIXING Section (Red Badge)**

### **11. Error Logs**
**Shows:**
- Recent errors
- Failed processes
- System warnings

---

## **Quick Navigation**

**From Admin Dashboard:**
- Click any panel to navigate
- Use refresh button (top right) to update
- Check status badges (green/yellow/red)

**Direct URLs:**
- `/admin` - Main dashboard
- `/admin/ml-dashboard` - ML Agent
- `/admin/god-scores` - GOD Scores
- `/admin/god-settings` - GOD Settings
- `/admin/scrapers` - Scraper Management
- `/admin/analytics` - Analytics
- `/admin/benchmarks` - Benchmarks
- `/admin/discovered-startups` - Discovered Startups
- `/admin/investors` - Investors

---

## **Status Indicators**

**Green Badge:** Healthy, running normally  
**Yellow Badge:** Warning, needs attention  
**Red Badge:** Error, needs fixing  
**Gray Badge:** Unknown/not checked

---

## **Real-Time Updates**

The dashboard auto-refreshes every 30 seconds.  
Click "Refresh" button for immediate update.

---

## **Troubleshooting**

**Can't see admin panels?**
- Check if you're logged in as admin
- Verify admin email in `AuthContext.tsx`

**Scripts not showing?**
- Check PM2: `pm2 list`
- View logs: `pm2 logs hot-match-autopilot`

**Data not updating?**
- Click refresh button
- Check browser console for errors
- Verify Supabase connection

---

**Need Help?** Check `COMPREHENSIVE_SYSTEM_STATUS.md` for full system overview.

