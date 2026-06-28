# 🗺️ Admin Navigation Guide - Complete Reference

## 📍 Main Entry Points

### Primary Admin Dashboard
- **`/admin/control`** - **Master Control Center** (Main Admin Panel)
  - Bento box layout with all system metrics
  - Running processes, matches, GOD scores, new entities
  - ML updates, AI operations, scraper activity, parser health
  - **Use this as your main admin landing page**

### Alternative Entry Points
- **`/admin`** - Redirects to `/admin/control`
- **`/admin/dashboard`** - Legacy workflow dashboard (still functional)
- **`/admin/operations`** - Control Center (alternative view)

---

## 🎯 Core Admin Functions

### 1. **System Monitoring & Health**

#### Master Control Center
- **Route**: `/admin/control`
- **Purpose**: Main admin dashboard with bento box layout
- **Features**:
  - Running processes status
  - Total matches (live link)
  - GOD scores with bias detection
  - New entities (24h/7d breakdown)
  - ML recommendations
  - AI operations feed
  - Live scraper activity
  - Parser health status

#### System Health Dashboard
- **Route**: `/admin/health`
- **Purpose**: Detailed system health monitoring
- **Features**:
  - Service status checks
  - Database connectivity
  - API health
  - Error logs
  - Performance metrics

#### System Analytics
- **Route**: `/admin/analytics`
- **Purpose**: Business intelligence and analytics
- **Features**:
  - User metrics
  - Match statistics
  - Growth trends
  - Revenue analytics

---

### 2. **Startup Management**

#### Discovered Startups Queue
- **Route**: `/admin/discovered-startups`
- **Purpose**: Review and approve scraped startups
- **Features**:
  - Filter by status (pending/approved/rejected)
  - Search and filter
  - Bulk actions
  - Direct edit links

#### Edit Startups
- **Route**: `/admin/edit-startups`
- **Purpose**: Edit existing startup records
- **Features**:
  - Search startups
  - Edit details
  - Update GOD scores
  - Change status

#### Bulk Upload
- **Route**: `/admin/bulk-upload`
- **Purpose**: Import multiple startups at once
- **Features**:
  - CSV/JSON import
  - Validation
  - Batch processing

#### Startup Review Queue
- **Route**: `/admin/review`
- **Purpose**: AI review queue for pending startups
- **Features**:
  - Pending approvals
  - AI recommendations
  - Quick approve/reject

---

### 3. **Investor Management**

#### Discovered Investors
- **Route**: `/admin/discovered-investors`
- **Purpose**: Review scraped investor profiles
- **Features**:
  - Filter by status
  - Search investors
  - Bulk actions

#### Investor Enrichment
- **Route**: `/admin/investor-enrichment`
- **Purpose**: Enrich investor data with AI
- **Features**:
  - Auto-enrichment
  - Manual updates
  - Portfolio analysis

#### Quick Add Investor
- **Route**: `/admin/investors/add`
- **Purpose**: Quickly add new investor
- **Features**:
  - Simple form
  - Auto-validation

---

### 4. **GOD Scoring System**

#### GOD Scores Dashboard
- **Route**: `/admin/god-scores`
- **Purpose**: View and manage startup quality scores
- **Features**:
  - Score distribution
  - Top/bottom performers
  - Score history
  - Algorithm bias detection
  - Score recalculation

---

### 5. **RSS & Discovery Pipeline**

#### RSS Manager
- **Route**: `/admin/rss-manager`
- **Purpose**: Manage RSS news sources
- **Features**:
  - Add/edit RSS sources
  - Active/inactive toggle
  - Article counts
  - Last scraped timestamps
  - **Live scraper activity feed**
  - **Parser health status**
  - **Database table matching**

---

### 6. **AI & Machine Learning**

#### AI Intelligence Dashboard
- **Route**: `/admin/ai-intelligence`
- **Purpose**: Monitor AI operations and intelligence
- **Features**:
  - AI operation logs
  - Profile updates
  - Match optimizations
  - Market trends
  - RSS feed analysis
  - All cards are clickable and link to sources

#### AI Logs
- **Route**: `/admin/ai-logs`
- **Purpose**: Detailed AI processing logs
- **Features**:
  - Filter by type
  - Search logs
  - Error tracking
  - Performance metrics

#### ML Dashboard
- **Route**: `/admin/ml-dashboard`
- **Purpose**: Machine learning recommendations
- **Features**:
  - ML model performance
  - Recommendations
  - Model training status
  - Feature importance

---

### 7. **Matching Engine**

#### Matching Engine
- **Route**: `/matching-engine` or `/matching`
- **Purpose**: View and manage startup-investor matches
- **Features**:
  - Live match feed
  - Filter by score
  - Match details
  - Save matches

---

### 8. **Diagnostics & Technical**

#### Diagnostic Page
- **Route**: `/admin/diagnostic`
- **Purpose**: System diagnostics
- **Features**:
  - Health checks
  - Configuration validation
  - Error detection

#### Database Diagnostic
- **Route**: `/admin/database-check`
- **Purpose**: Database health and validation
- **Features**:
  - Table checks
  - Schema validation
  - Data integrity
  - Query performance

#### Pipeline Monitor
- **Route**: `/admin/pipeline`
- **Purpose**: Monitor data processing pipeline
- **Features**:
  - Stage status
  - Processing times
  - Error tracking

---

### 9. **Legacy & Alternative Views**

#### Command Center
- **Route**: `/admin/command-center`
- **Purpose**: Advanced monitoring (legacy)
- **Note**: Use Master Control Center instead

#### Admin Workflow Dashboard
- **Route**: `/admin/dashboard`
- **Purpose**: Visual pipeline view (legacy)
- **Note**: Use Master Control Center instead

#### Control Center
- **Route**: `/admin/operations`
- **Purpose**: Alternative control view
- **Note**: Use Master Control Center instead

---

## 🔗 Quick Navigation Map

```
/admin/control (MAIN)
├── /admin/health (System Health)
├── /admin/analytics (Analytics)
│
├── /admin/discovered-startups (Startup Queue)
├── /admin/edit-startups (Edit Startups)
├── /admin/bulk-upload (Bulk Import)
├── /admin/review (Review Queue)
│
├── /admin/discovered-investors (Investor Queue)
├── /admin/investor-enrichment (Enrich Investors)
│
├── /admin/god-scores (GOD Scoring)
│
├── /admin/rss-manager (RSS Sources)
│
├── /admin/ai-intelligence (AI Dashboard)
├── /admin/ai-logs (AI Logs)
├── /admin/ml-dashboard (ML Dashboard)
│
├── /matching-engine (Matching)
│
└── /admin/diagnostic (Diagnostics)
    /admin/database-check (DB Check)
    /admin/pipeline (Pipeline)
```

---

## 🎯 Recommended Workflow

### Daily Admin Tasks

1. **Start at Master Control Center** (`/admin/control`)
   - Check system status
   - Review new entities (24h/7d)
   - Check GOD score changes
   - Review ML recommendations

2. **Review Discoveries**
   - `/admin/discovered-startups` - Approve/reject new startups
   - `/admin/discovered-investors` - Review investor discoveries

3. **Monitor AI Operations**
   - `/admin/ai-intelligence` - Check AI activity
   - `/admin/ai-logs` - Review detailed logs

4. **Manage RSS Sources**
   - `/admin/rss-manager` - Check scraper activity
   - Verify parser health
   - Add new sources if needed

5. **Review Matches**
   - `/matching-engine` - Check new matches
   - Review match quality

6. **System Health Check**
   - `/admin/health` - Verify all systems operational
   - `/admin/diagnostic` - Run diagnostics if issues

---

## 🚨 Important Notes

### Primary Admin Panel
- **Use `/admin/control` (Master Control Center) as your main admin landing page**
- It provides a comprehensive bento box view of all system metrics
- All widgets are clickable and link to detailed pages

### Navigation Consistency
- All admin panels include `AdminNavBar` for consistent navigation
- Quick links available in most panels
- Back buttons return to control center

### Data Sources
- **SSOT**: Supabase tables are the single source of truth
- No static fallback data
- All data fetched from database

### Route Aliases
- `/admin` → `/admin/control`
- `/matching` → `/matching-engine`
- `/admin/startups` → `/admin/discovered-startups`
- `/admin/investors` → `/admin/discovered-investors`

---

## 📱 Mobile & Responsive

All admin panels are responsive and work on:
- Desktop (full feature set)
- Tablet (optimized layout)
- Mobile (essential features)

---

## 🔐 Access Control

- Admin routes require authentication
- Admin role required for most functions
- Some routes may have additional permissions

---

## 📞 Support

If you can't find a specific admin function:
1. Check Master Control Center (`/admin/control`)
2. Review this navigation guide
3. Use the search function in Master Navigation (`/navigation`)

---

**Last Updated**: 2024
**Version**: 2.0



