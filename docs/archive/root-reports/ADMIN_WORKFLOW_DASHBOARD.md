# Admin Workflow Dashboard - Complete Implementation Guide

## 🎯 Overview

The new **Admin Workflow Dashboard** provides a visual pipeline for managing the entire Hot Money platform, from data input through AI processing to the matching engine. It replaces the old Command Center as the main admin landing page.

## 🚀 What's New

### 1. **Admin Workflow Dashboard** (`/admin/dashboard`)
- **Visual Pipeline**: 6-stage workflow showing the entire Hot Money process
- **Live Status**: Real-time status indicators for each stage (idle/running/success/error)
- **System Summary**: Overview panel with key metrics
- **Clickable Stages**: Each stage card is clickable and navigates to the relevant page
- **Auto-refresh**: Optional 30-second auto-refresh

### 2. **Workflow Stages**

#### Stage 1: Startups 🚀
- **Link**: `/admin/edit-startups`
- **Purpose**: Add and manage startup submissions
- **Shows**: Total startups, approved count
- **Color**: Orange

#### Stage 2: Investors 💼
- **Link**: `/investors`
- **Purpose**: Manage investor directory
- **Shows**: Total investors, active profiles
- **Color**: Cyan

#### Stage 3: RSS Sources 📰
- **Link**: `/admin/rss-manager` (NEW)
- **Purpose**: Add and manage RSS news feeds
- **Shows**: Total RSS sources, articles scraped
- **Color**: Blue

#### Stage 4: AI Processing 🧠
- **Link**: `/admin/ai-logs` (NEW)
- **Purpose**: Monitor AI operations (document scanning, enrichment)
- **Shows**: Total operations, success rate, token usage
- **Color**: Purple

#### Stage 5: GOD Score ⚡
- **Link**: `/admin/god-scores` (NEW)
- **Purpose**: View startup quality scores and rankings
- **Shows**: Average score, top scores, score changes
- **Color**: Yellow

#### Stage 6: Matching Engine 🎯
- **Link**: `/matching`
- **Purpose**: View live startup-investor matches
- **Shows**: Total matches generated
- **Color**: Green

### 3. **New Admin Pages**

#### RSS Manager (`/admin/rss-manager`)
- Add RSS news sources (TechCrunch, VentureBeat, etc.)
- Manage feed URLs and categories
- Activate/deactivate sources
- Track article counts and last scrape times

#### AI Logs Page (`/admin/ai-logs`)
- View all AI operations (document scanning, enrichment)
- Monitor success/failure rates
- Track token usage (input/output)
- Filter by operation type and model

#### GOD Scores Page (`/admin/god-scores`)
- View top-rated startups
- See average and top scores
- Monitor recent score changes
- Track score deltas and reasons

## 📊 System Summary Panel

The dashboard includes a comprehensive summary showing:
- **Total Startups** (with approved count)
- **Total Investors** (active profiles)
- **Average GOD Score** (out of 100)
- **Active Matches** (generated pairs)
- **AI Operations** (total count)
- **RSS Articles** (scraped count)
- **Today's Activity** (operations in last 24h)
- **Pipeline Health** (stages with success status)

## 🎨 Design Features

### Visual Design
- **Hot Money purple gradient** background (#1a1140 → #4a2a8f)
- **Animated background orbs** for depth
- **Glassmorphic cards** with backdrop blur
- **Color-coded stages** (orange, cyan, blue, purple, yellow, green)
- **Hover animations** (scale up, border glow)
- **Custom purple scrollbars**

### Status Indicators
- 🔵 **Idle**: Gray clock icon (no data yet)
- 🔄 **Running**: Spinning blue loader (operation in progress)
- ✅ **Success**: Green checkmark (completed successfully)
- ❌ **Error**: Red alert icon (failed operation)

### Interactive Elements
- **Click any stage card** → Navigate to that stage's page
- **Auto-refresh toggle** → Enable/disable 30s refresh
- **Manual refresh button** → Reload all data on demand
- **Quick action cards** → Add Startup, Add Investor, Command Center

## 🗄️ Database Requirements

### New Table: `rss_sources`
```sql
CREATE TABLE rss_sources (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  last_scraped TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Run the migration:
```bash
# Apply the SQL migration
psql $DATABASE_URL -f supabase-rss-sources.sql
```

Or in Supabase dashboard:
1. Go to SQL Editor
2. Copy contents of `supabase-rss-sources.sql`
3. Click "Run"

### Existing Tables Used
- `startup_uploads` - Startups with status and GOD scores
- `investors` - Investor directory
- `ai_logs` - AI operation logs
- `rss_articles` - Scraped news articles
- `ml_jobs` - ML job execution logs
- `score_history` - GOD score change history

## 🔗 Route Structure

### Admin Routes
```
/admin/dashboard           → Admin Workflow Dashboard (NEW - main landing)
/admin/command-center      → Command Center (OLD - advanced monitoring)
/admin/edit-startups       → Manage startups
/admin/rss-manager         → RSS Source Manager (NEW)
/admin/ai-logs             → AI Processing Logs (NEW)
/admin/god-scores          → GOD Score Dashboard (NEW)
/admin/operations          → Admin operations menu
```

### Updated Navigation Flow
1. User visits `/admin/dashboard` (new workflow dashboard)
2. Sees 6-stage pipeline with live status
3. Clicks any stage → Navigates to detailed page
4. Can access Command Center via quick action button
5. Back button returns to workflow dashboard

## 🎯 User Workflow

### Typical Admin Session
1. **Visit Dashboard** (`/admin/dashboard`)
   - Review system summary
   - Check pipeline health (6/6 stages green)
   - See today's activity count

2. **Add Data** (Stages 1-3)
   - Click "Startups" → Add new startup submissions
   - Click "Investors" → Add investor profiles
   - Click "RSS Sources" → Add news feeds

3. **Monitor Processing** (Stages 4-5)
   - Click "AI Processing" → View document scans, token usage
   - Click "GOD Score" → See top-rated startups, score changes

4. **View Results** (Stage 6)
   - Click "Matching Engine" → See live startup-investor matches
   - Browse 20 matches per hour rotation

## 📱 Component Files

### New Files Created
```
src/components/AdminWorkflowDashboard.tsx  (Main workflow dashboard)
src/pages/RSSManager.tsx                   (RSS source management)
src/pages/AILogsPage.tsx                   (AI operation monitoring)
src/pages/GODScoresPage.tsx                (GOD score rankings)
supabase-rss-sources.sql                   (Database migration)
```

### Modified Files
```
src/App.tsx                 (Added new routes)
src/components/CommandCenter.tsx  (Moved to /admin/command-center)
```

## 🚀 Testing Checklist

### Dashboard Tests
- [ ] Visit `/admin/dashboard` - Dashboard loads
- [ ] Summary panel shows correct counts
- [ ] All 6 stages display with status indicators
- [ ] Auto-refresh toggle works
- [ ] Manual refresh button updates data

### Navigation Tests
- [ ] Click "Startups" stage → Goes to `/admin/edit-startups`
- [ ] Click "Investors" stage → Goes to `/investors`
- [ ] Click "RSS Sources" stage → Goes to `/admin/rss-manager`
- [ ] Click "AI Processing" stage → Goes to `/admin/ai-logs`
- [ ] Click "GOD Score" stage → Goes to `/admin/god-scores`
- [ ] Click "Matching Engine" stage → Goes to `/matching`
- [ ] Quick action "Command Center" → Goes to `/admin/command-center`

### RSS Manager Tests
- [ ] Add new RSS source form appears
- [ ] Submit source with name/URL/category
- [ ] Source appears in list
- [ ] Toggle active/inactive works
- [ ] Delete source works (with confirmation)
- [ ] Article counts display correctly

### AI Logs Tests
- [ ] View list of AI operations
- [ ] See token counts (input/output/total)
- [ ] Success/failed status indicators work
- [ ] Stats cards show correct totals
- [ ] Refresh button updates data

### GOD Scores Tests
- [ ] View top 10 startups by score
- [ ] See recent score changes with deltas
- [ ] Click startup → Navigate to startup detail
- [ ] Color coding based on score (green/yellow/orange/red)
- [ ] Stats show average/top/total scores

## 🎨 Color Scheme Reference

### Stage Colors
```css
Orange:  #f97316 → #f59e0b  (Startups)
Cyan:    #06b6d4 → #3b82f6  (Investors)
Blue:    #3b82f6 → #6366f1  (RSS)
Purple:  #8b5cf6 → #6366f1  (AI)
Yellow:  #eab308 → #f97316  (GOD Score)
Green:   #10b981 → #059669  (Matching)
```

### Background Gradient
```css
from: #1a1140 (deep purple)
via:  #2d1b69 (mid purple)
to:   #4a2a8f (light purple)
```

## 💡 Future Enhancements

### Short-term
- [ ] Add "Run Now" buttons to execute operations from dashboard
- [ ] Show last run timestamp for each stage
- [ ] Add progress bars for running operations
- [ ] Display error messages when stages fail

### Medium-term
- [ ] Real-time WebSocket updates (no manual refresh needed)
- [ ] Stage dependency indicators (e.g., GOD Score depends on Startups)
- [ ] Workflow automation (auto-run stages in sequence)
- [ ] Alert notifications for failures

### Long-term
- [ ] Workflow templates (preset pipelines)
- [ ] Custom stage ordering
- [ ] Multi-user collaboration (see who's working on what)
- [ ] Historical analytics (track metrics over time)

## 🐛 Troubleshooting

### Dashboard not loading
1. Check browser console for errors
2. Verify Supabase connection in Network tab
3. Ensure all routes are registered in `App.tsx`

### Empty stage counts
1. Verify database tables exist and have data
2. Check RLS policies allow public read access
3. Run test data generation from Command Center

### RSS Manager shows no sources
1. Run `supabase-rss-sources.sql` migration
2. Check `rss_sources` table exists in Supabase
3. Verify RLS policies are enabled

### Navigation not working
1. Check React Router setup in `App.tsx`
2. Verify all component imports are correct
3. Test with browser dev tools → React Components

## 📞 Support

If you encounter issues:
1. Check this document first
2. Review browser console for errors
3. Verify database schema matches requirements
4. Test with sample data from Command Center

## ✅ Summary

You now have a **complete admin workflow dashboard** that:
- ✅ Shows the entire Hot Money pipeline (6 stages)
- ✅ Provides live status monitoring
- ✅ Links to detailed pages for each stage
- ✅ Includes RSS Manager, AI Logs, GOD Scores pages
- ✅ Displays comprehensive system summary
- ✅ Features Hot Money purple gradient design
- ✅ Auto-refreshes every 30 seconds
- ✅ Allows quick navigation between stages

Navigate to `/admin/dashboard` to see your new workflow dashboard! 🎉
