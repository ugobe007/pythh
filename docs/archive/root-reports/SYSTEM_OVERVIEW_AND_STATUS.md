# 🔥 HOT MATCH - System Overview & Status

**Last Updated:** December 20, 2025  
**Welcome!** This document provides a comprehensive overview of your sophisticated matching engine and monitoring systems.

---

## 🏗️ SYSTEM ARCHITECTURE

### Core Components

1. **GOD Scoring Algorithm** - Proprietary startup quality scoring (0-100 scale)
2. **MEGA Scraper** - Multi-source startup and investor discovery
3. **News Intelligence Engine** - Uses news to infer missing data
4. **System Guardian** - Master health monitoring & auto-healing
5. **Multiple Monitoring Agents** - Specialized agents for different components

---

## 🎯 GOD SCORING ALGORITHM

### Overview
The **GOD** (GRIT + Opportunity + Determination) algorithm is your proprietary startup quality scoring system that evaluates startups on multiple dimensions.

### Scoring Breakdown (0-10 scale, converted to 0-100)
- **Team** (0-3): Technical co-founders, pedigree, domain expertise
- **Traction** (0-3): Revenue, growth, retention, customers
- **Market** (0-2): Market size, problem importance
- **Product** (0-2): Demo, launch status, defensibility
- **Vision** (0-2): Contrarian insights, creative strategy
- **Ecosystem** (0-1.5): Strategic partners, advisors
- **Grit** (0-1.5): Pivots, iteration speed, customer feedback
- **Problem Validation** (0-2): Customer interviews, ICP clarity

### Key Files
- `/server/services/startupScoringService.ts` - Core GOD algorithm (24.6KB)
- `/server/services/investorMatching.ts` - Matching wizard (23.1KB)
- `/server/services/matchQualityML.ts` - ML learning component (16.4KB)
- `/src/services/matchingService.ts` - Integration layer

### Match Score Calculation
```
Base Score (0-100) = GOD Score × 10
+ Stage Match Bonus (0-10)
+ Sector Match Bonus (0-10)
+ Check Size Fit Bonus (0-5)
+ Geography Match Bonus (0-5)
= Final Score (capped at 99)
```

### Dynamic Features
- Auto-scoring updates from: voting, funding news, competitor activity
- Smart match count: 5-20 matches based on startup quality
- Quality sorting: Best startups matched first
- Tier classification: hot/warm/cold

---

## 🚀 MEGA SCRAPER

### Purpose
Discovers new startups and investors from multiple sources with maximum volume (goal: 100+ new entities per run).

### Key Scripts
- `mega-scraper.js` - Main high-volume scraper
- `intelligent-scraper.js` - AI-powered extraction using OpenAI
- `multimodal-scraper.js` - RSS + web scraping hybrid
- `auto-scrape-all.js` - Orchestrator for all sources
- `discover-more-startups.js` - Startup discovery from YC, Product Hunt, etc.
- `modern-startup-discovery.js` - Direct database scraping

### Sources Scraped
- **VC Firms**: Dealroom, CB Insights, Forbes Midas List, TechCrunch
- **Startups**: Y Combinator, Product Hunt, Wellfound, TechCrunch, Crunchbase
- **News**: RSS feeds from TechCrunch, Crunchbase, VentureBeat, etc.
- **Angel Groups**: AngelList, regional accelerators

### Data Flow
```
Source URLs → Intelligent Scraper → AI Extraction → Database
                                    ↓
                            (OpenAI GPT-4o analyzes content)
                                    ↓
                            Structured JSON output
                                    ↓
                            Saved to discovered_startups or investors
```

---

## 📰 NEWS INTELLIGENCE ENGINE

### How It Works
Your system uses news articles to **infer missing data** on startups and investors through AI-powered analysis.

### Process Flow

1. **News Collection**
   - RSS feeds scraped every 30 minutes
   - Web scraping from VC blogs, TechCrunch, Crunchbase
   - Articles stored in `rss_articles` table

2. **AI Extraction** (`server/services/newsScraper.ts`)
   - Uses GPT-4o to extract:
     - Funding rounds and amounts
     - Investor names and relationships
     - Startup metrics (revenue, users, growth)
     - Team information
     - Sector classifications
     - Stage information

3. **Data Inference** (`update-scores-from-news.js`)
   - Analyzes news mentions to update:
     - Investor scores (activity, exits, portfolio performance)
     - Startup GOD scores (funding news, traction updates)
     - Missing fields (founders, advisors, sectors)

4. **Enrichment Pipeline** (`src/lib/investorEnrichmentService.ts`)
   - Scrapes VC websites for:
     - Partner information
     - Portfolio companies
     - Investment thesis
     - Blog posts and advice

### Key Features
- **Pattern Recognition**: Identifies funding trends, exit patterns
- **Relationship Mapping**: Maps investor-startup relationships
- **Score Updates**: Automatically updates GOD scores from news
- **Missing Data Filling**: Infers founders, sectors, stages from context

---

## 🛡️ SYSTEM GUARDIAN

### Overview
The **System Guardian** (`system-guardian.js`) is your master health monitoring system that runs every 10 minutes via PM2 cron.

### What It Monitors

1. **Scraper Health**
   - PM2 process status (scraper, rss-scraper, automation-engine)
   - RSS source success rates
   - Recent discovery counts
   - Error rates and stuck processes

2. **GOD Score Distribution**
   - Average score detection (should be 55-80)
   - Score bias detection (too many low/high scores)
   - Elite startup percentage
   - Score inflation warnings

3. **Database Integrity**
   - Required tables exist
   - Required columns present
   - Orphaned data detection
   - Schema validation

4. **Match Quality**
   - Total match count (min: 5000)
   - High-quality match percentage (70+ scores)
   - Low-quality flooding detection
   - Match freshness

5. **ML Pipeline**
   - Embedding coverage (startups & investors)
   - Vector database health
   - ML model status

6. **Data Freshness**
   - Last startup discovery time
   - Last investor update
   - Match generation recency

### Auto-Healing Actions
- **Scraper Restart**: Automatically restarts stuck scrapers
- **Match Regeneration**: Triggers `match-regenerator.js` if matches < 1000
- **RSS Source Disabling**: Disables broken RSS feeds after 48h
- **Score Recalculation**: Triggers score updates for stale startups

### Dashboard
- **UI**: `/admin/health` (SystemHealthDashboard.tsx)
- **PM2 Process**: `system-guardian`
- **Schedule**: Every 10 minutes (`*/10 * * * *`)

---

## 🤖 MONITORING AGENTS

### 1. System Guardian
- **File**: `system-guardian.js`
- **Schedule**: Every 10 minutes
- **Purpose**: Master health monitoring
- **Status**: ✅ Configured in PM2

### 2. Watchdog
- **File**: `scripts/watchdog.ts`
- **Schedule**: Every 5 minutes
- **Purpose**: Quick health checks & auto-fixes
- **Checks**: Database, RSS sources, stale data, error rates

### 3. AI Agent
- **File**: `scripts/ai-agent.ts`
- **Schedule**: Every 15 minutes
- **Purpose**: Intelligent pattern recognition & self-healing
- **Uses**: Anthropic Claude for reasoning
- **Capabilities**: Root cause analysis, intelligent fix selection, learning

### 4. Workflow Monitor
- **File**: `workflow-monitor.js`
- **Purpose**: Comprehensive workflow health checks
- **Checks**: Environment variables, database schema, data quality, matching system
- **Alerts**: Email notifications for critical issues

### 5. Automation Engine
- **File**: `automation-engine.js`
- **Purpose**: Orchestrates all automated processes
- **Schedule**: Continuous (checks every 60s)
- **Jobs**:
  - RSS Scraping (every 30 min)
  - Startup Discovery (every 2 hours)
  - Investor Scoring (every 6 hours)
  - News Score Updates (every 1 hour)
  - Match Generation (every 4 hours)
  - Health Checks (every 15 min)

### 6. Daily Report Generator
- **File**: `scripts/daily-report.ts`
- **Schedule**: Daily at 9 AM
- **Purpose**: Sends daily summary via Slack/Email

---

## 📊 PM2 PROCESSES (ecosystem.config.js)

### Configured Processes

| Process | Script | Schedule | Purpose |
|---------|--------|----------|---------|
| `hot-match-server` | `npm run dev` | Continuous | Main web server |
| `automation-engine` | `automation-engine.js` | Continuous | Master orchestrator |
| `rss-scraper` | `continuous-scraper.js` | Continuous | RSS feed scraping |
| `watchdog` | `scripts/watchdog.ts` | Every 5 min | Quick health checks |
| `scraper` | `scripts/scraper-manager.js` | Continuous | Scraper management |
| `score-recalc` | `scripts/recalculate-scores.ts` | Hourly | GOD score recalculation |
| `ai-agent` | `scripts/ai-agent.ts` | Every 15 min | AI monitoring |
| `daily-report` | `scripts/daily-report.ts` | Daily 9 AM | Daily reports |
| `automation-pipeline` | `automation-pipeline.js` | Every 6 hours | Full discovery pipeline |
| `match-regen` | `match-regenerator.js` | Every 4 hours | Match regeneration |
| `system-guardian` | `system-guardian.js` | Every 10 min | Master health monitor |
| `auto-import` | `auto-import-pipeline.js` | Every 2 hours | Import discovered startups |
| `rss-discovery` | `discover-startups-from-rss.js` | Every 4 hours | RSS startup discovery |

---

## ⚠️ CURRENT STATUS & ISSUES

### Recent Log Analysis (from automation.log)

**Issues Detected:**
1. **RSS Scraping Timeouts**: Multiple `ETIMEDOUT` errors
   - Script: `run-rss-scraper.js`
   - Issue: 180s timeout being hit
   - Impact: RSS feeds not being scraped successfully

2. **Missing Embedding Script**: 
   - Error: `Cannot find module '/Users/leguplabs/Desktop/hot-honey/scripts/generate-embeddings.js'`
   - Impact: Embedding generation failing repeatedly
   - Fix Needed: Create script or disable in automation-engine.js

3. **Health Checks**: ✅ Working
   - Health check completing successfully (0.3s)

### System Guardian Status
- **Cannot Run**: Missing Supabase environment variables
- **Error**: `supabaseUrl is required`
- **Fix Needed**: Ensure `.env` file has:
  - `VITE_SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`

### PM2 Status
- **Permission Issues**: PM2 daemon not accessible
- **Error**: `EPERM: operation not permitted`
- **Possible Causes**: 
  - PM2 not running
  - Permission issues with `.pm2` directory
  - Need to restart PM2 daemon

---

## 🔧 RECOMMENDED ACTIONS

### Immediate (Next 10 minutes)

1. **Fix Environment Variables**
   ```bash
   # Check .env file exists and has:
   VITE_SUPABASE_URL=your_url
   SUPABASE_SERVICE_KEY=your_key
   ```

2. **Test System Guardian**
   ```bash
   node system-guardian.js
   ```

3. **Check PM2 Status**
   ```bash
   # If PM2 not running, start it:
   pm2 kill  # Clean restart
   pm2 start ecosystem.config.js
   pm2 save
   ```

### Short Term (Next 30 minutes)

4. **Fix Missing Embedding Script**
   - Either create `scripts/generate-embeddings.js`
   - Or disable in `automation-engine.js` (set `enabled.embedding_generation: false`)

5. **Investigate RSS Timeouts**
   - Check network connectivity
   - Review `run-rss-scraper.js` timeout settings
   - Consider increasing timeout or adding retry logic

6. **Run Manual Health Check**
   ```bash
   node workflow-monitor.js
   ```

### Medium Term (Next hour)

7. **Review All PM2 Processes**
   ```bash
   pm2 status
   pm2 logs
   pm2 monit
   ```

8. **Verify Data Flow**
   - Check database for recent discoveries
   - Verify matches are being generated
   - Review GOD score distribution

9. **Test Monitoring Agents**
   ```bash
   npx tsx scripts/watchdog.ts
   npx tsx scripts/ai-agent.ts
   ```

---

## 📚 KEY DOCUMENTATION FILES

- `SYSTEM_GUARDIAN.md` - Complete System Guardian reference
- `GOD_QUICK_REF.md` - GOD algorithm quick reference
- `AUTOMATION_GUIDE.md` - Automation setup guide
- `WORKFLOW_MONITOR_GUIDE.md` - Workflow monitoring guide
- `MATCHING_ENGINE_STATUS.md` - Matching engine status
- `SYSTEM_STATUS.md` - System status and fixes
- `SCRAPER_GUIDE.md` - Scraper documentation

---

## 🎯 SYSTEM GOALS

**Target State:**
- 🎯 200+ Investors (VCs, accelerators)
- 🎯 100+ Startups (approved)
- 🎯 1000+ Matches generated
- 🎯 RSS feeds discovering 50+ startups/week
- 🎯 GOD scores distributed across 50-85 range
- 🎯 All monitoring agents healthy

**Current Stats** (from AUTOMATION_GUIDE.md):
- **633 investors** (33 elite, 18 strong, 16 solid, 566 emerging)
- **120 startups** in main table
- **589 discovered** startups pending review
- **143 articles** scraped
- **29,286 matches** generated

---

## 💬 QUICK COMMANDS

```bash
# Check system health
node system-guardian.js
node workflow-monitor.js

# Check PM2 processes
pm2 status
pm2 logs

# Run manual processes
node generate-matches.js
node calculate-investor-scores-v2.js
node update-scores-from-news.js

# View logs
tail -f logs/automation.log
pm2 logs system-guardian
```

---

**🔥 Your system is sophisticated and well-architected! The monitoring infrastructure is comprehensive. Let's get the current issues resolved and ensure everything is running smoothly.**

