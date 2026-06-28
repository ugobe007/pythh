# 📋 Daily Scripts & Automation Reference for Hot Match

Complete reference for daily checks, maintenance scripts, and automation opportunities.

---

## 🔍 **DAILY CHECK SCRIPTS**

### Quick Health Dashboard
Run these every morning to get a full system overview:

| **Command** | **Purpose** | **Time** | **Output** |
|-------------|-------------|----------|------------|
| `node scripts/check-god-scores.js` | GOD Score Analysis | ~30s | Score distribution, averages, top performers |
| `node scripts/check-startup-data-quality.js` | Data Completeness | ~15s | % of startups with ARR, MRR, customers, team size |
| `node scripts/check-recent-deletions.js` | Deletion Audit | ~10s | Recently deleted startups/investors (last 7 days) |
| `npm run db:cleanup:audit` | Cleanup Preview | ~20s | What would be deleted (safe, no action) |

**Quick Daily Check (All-in-One):**
```bash
# Create a quick check script
cat > daily-health-check.sh << 'EOF'
#!/bin/bash
echo "🔍 Daily Health Check - $(date)"
echo "================================="
echo ""
echo "📊 GOD Scores:"
node scripts/check-god-scores.js | head -30
echo ""
echo "📋 Data Quality:"
node scripts/check-startup-data-quality.js
echo ""
echo "🗑️ Recent Deletions:"
node scripts/check-recent-deletions.js
echo ""
echo "✅ Health check complete!"
EOF

chmod +x daily-health-check.sh
./daily-health-check.sh
```

---

## 📈 **DATA PIPELINE SCRIPTS**

### Core Automation (Main Pipeline)
| **Command** | **Purpose** | **Frequency** | **Duration** |
|-------------|-------------|---------------|--------------|
| `npm run pipeline` | Full pipeline (RSS → Enrich → Score → Match) | Every 4 hours | ~30-60 min |
| `npm run pipeline:daemon` | Continuous automation (background) | Continuous | Always running |
| `npm run scrape` | Discover new startups from RSS | Every 30 min | ~10-15 min |
| `npm run enrich` | Enrich missing data (inference) | Every hour | ~20-30 min |
| `npm run score` | Calculate GOD scores | Every 2 hours | ~15-20 min |
| `npm run match` | Generate startup-investor matches | Every 4 hours | ~10-15 min |

### Individual Scripts (Manual Override)
| **Command** | **Script** | **When to Use** |
|-------------|------------|-----------------|
| `node scripts/core/simple-rss-scraper.js` | RSS Scraper | Manual discovery check |
| `node scripts/core/god-score-formula.js` | GOD Scoring | Recalculate scores |
| `node scripts/core/god-score-formula.js --limit 100` | GOD Scoring (Limited) | Test before full run |
| `node scripts/core/queue-processor-v16.js` | Match Generator | Manual match generation |
| `node scripts/core/enrichment-orchestrator.js` | Enrichment | Manual data enrichment |

---

## 🧹 **MAINTENANCE SCRIPTS**

### Weekly Maintenance (Sundays)
| **Command** | **Purpose** | **Risk Level** |
|-------------|-------------|----------------|
| `npm run db:cleanup:audit` | Preview deletions | ✅ Safe (read-only) |
| `npm run db:cleanup:execute` | Execute cleanup | ⚠️ Medium (deletes data) |
| `node scripts/enrichment/social-signals-scraper.js` | Collect social signals | ✅ Safe |
| `node scripts/core/god-score-formula.js` | Full score recalculation | ✅ Safe |

### Monthly Maintenance (First of Month)
| **Command** | **Purpose** | **Risk Level** |
|-------------|-------------|----------------|
| `node scripts/list-all-sectors.js` | Review all industries | ✅ Safe |
| Database backup via Supabase | Full database backup | ✅ Safe |

---

## 🎯 **SPECIFIC CHECK SCRIPTS**

### GOD Score Analysis
| **Command** | **Purpose** |
|-------------|-------------|
| `node scripts/check-god-scores.js` | Overall score distribution & stats |
| `node scripts/core/god-score-formula.js --limit 10` | Test scoring on 10 startups |

### Data Quality Checks
| **Command** | **Purpose** |
|-------------|-------------|
| `node scripts/check-startup-data-quality.js` | Data completeness (% with ARR, MRR, etc.) |
| `node scripts/list-all-sectors.js` | List all unique industries/sectors |

### Database Health
| **Command** | **Purpose** |
|-------------|-------------|
| `npm run db:cleanup:audit` | Preview what cleanup would remove |
| `node scripts/check-recent-deletions.js` | Audit recent deletions |

### Social Signals
| **Command** | **Purpose** |
|-------------|-------------|
| `node scripts/enrichment/social-signals-scraper.js 5` | Test with 5 startups |
| `node scripts/enrichment/social-signals-scraper.js` | Run for all startups |

---

## 🤖 **AUTOMATION OPPORTUNITIES**

### ✅ **Already Automated (via `hot-match-autopilot.js`)**

1. **RSS Scraping** (Every 30 min)
   - ✅ Discovers new startups from feeds
   - ✅ Runs automatically via daemon mode

2. **Data Enrichment** (Every hour)
   - ✅ Infers missing data (team size, stage, sectors)
   - ✅ Runs automatically via daemon mode

3. **GOD Scoring** (Every 2 hours)
   - ✅ Calculates overall + industry GOD scores
   - ✅ Runs automatically via daemon mode

4. **Match Generation** (Every 4 hours)
   - ✅ Generates startup-investor matches
   - ✅ Runs automatically via daemon mode

### 🚀 **CAN BE AUTOMATED** (Recommended)

#### 1. **Daily Health Checks** (Priority: HIGH)
**Current**: Manual  
**Automation**: Cron job or scheduled task

```bash
# Create daily-health-report.js
# Runs every morning at 9 AM
# Sends summary to email/Slack/webhook
```

**What to automate:**
- GOD score distribution
- Data quality metrics
- Match count trends
- Error rate monitoring
- System health status

**Implementation:**
- Use `node-cron` (already installed) in `server/index.js`
- Or use system cron: `0 9 * * * node scripts/daily-health-report.js`

#### 2. **Social Signals Collection** (Priority: MEDIUM)
**Current**: Manual  
**Automation**: Weekly batch job

```javascript
// Add to hot-match-autopilot.js
SOCIAL_SIGNALS_INTERVAL: 7 * 24 * 60 * 60 * 1000, // Weekly
```

**Implementation:**
- Add to `CONFIG` in `hot-match-autopilot.js`
- Run `social-signals-scraper.js` weekly

#### 3. **Database Cleanup** (Priority: LOW - Keep Manual)
**Current**: Manual  
**Recommendation**: Keep manual (too risky to automate)

**Why keep manual:**
- Review before deletion
- Prevents accidental data loss
- Audit log required

#### 4. **GOD Score Recalculation** (Priority: MEDIUM)
**Current**: Manual when needed  
**Automation**: Weekly full recalculation

```javascript
// Add to hot-match-autopilot.js
FULL_SCORE_RECALC_INTERVAL: 7 * 24 * 60 * 60 * 1000, // Weekly
```

#### 5. **Industry Sector Audit** (Priority: LOW)
**Current**: Manual  
**Automation**: Monthly check

```javascript
// Monthly: List all sectors to catch new industries
MONTHLY_SECTOR_AUDIT: 30 * 24 * 60 * 60 * 1000,
```

---

## 📅 **RECOMMENDED DAILY SCHEDULE**

### Morning (9:00 AM)
```bash
# 1. Quick health check (5 min)
./daily-health-check.sh

# 2. Check pipeline status (if using PM2)
pm2 status

# 3. Review any errors from overnight
pm2 logs autopilot --lines 50
```

### Midday (12:00 PM)
```bash
# Optional: Manual scrape if needed
npm run scrape
```

### Evening (6:00 PM)
```bash
# Check match count and quality
node scripts/check-god-scores.js | grep "Distribution"
```

---

## 🔄 **AUTOMATION IMPLEMENTATION PLAN**

### Phase 1: Daily Health Report (1-2 hours)
**File**: `scripts/daily-health-report.js`

**Features:**
- Runs all health check scripts
- Aggregates results into summary
- Sends to email/Slack/webhook (optional)
- Stores daily metrics in database

**Schedule**: 9:00 AM daily

### Phase 2: Weekly Social Signals (30 min)
**File**: Modify `scripts/core/hot-match-autopilot.js`

**Changes:**
```javascript
SOCIAL_SIGNALS_INTERVAL: 7 * 24 * 60 * 60 * 1000, // Weekly
```

**Schedule**: Sunday 2:00 AM (low traffic)

### Phase 3: Weekly Full Recalculation (30 min)
**File**: Modify `scripts/core/hot-match-autopilot.js`

**Changes:**
```javascript
FULL_SCORE_RECALC_INTERVAL: 7 * 24 * 60 * 60 * 1000, // Weekly
```

**Schedule**: Sunday 3:00 AM (after social signals)

### Phase 4: Alert System (2-3 hours)
**File**: `scripts/alert-system.js`

**Features:**
- Monitor for critical errors
- Alert on low match count
- Alert on scoring failures
- Alert on database connection issues

**Channels**: Email, Slack, Dashboard notification

---

## 📊 **METRICS TO TRACK DAILY**

| **Metric** | **Check Command** | **Healthy Range** |
|------------|-------------------|-------------------|
| Total Startups | `check-god-scores.js` | Increasing |
| Scored Startups | `check-god-scores.js` | 100% of approved |
| Average GOD Score | `check-god-scores.js` | 30-50 (early stage OK) |
| Data Completeness | `check-startup-data-quality.js` | >50% with ARR/MRR |
| Match Count | Check database | Increasing |
| Recent Deletions | `check-recent-deletions.js` | Review manually |

---

## 🛠️ **QUICK REFERENCE TABLE**

### Most Used Commands

| **Use Case** | **Command** |
|--------------|-------------|
| **Full health check** | `./daily-health-check.sh` |
| **Check GOD scores** | `node scripts/check-god-scores.js` |
| **Check data quality** | `node scripts/check-startup-data-quality.js` |
| **Start automation** | `npm run pipeline:daemon` |
| **Manual scrape** | `npm run scrape` |
| **Recalculate scores** | `node scripts/core/god-score-formula.js --limit 100` |
| **Preview cleanup** | `npm run db:cleanup:audit` |
| **Check pipeline status** | `pm2 status` |

---

## 🚨 **TROUBLESHOOTING**

### Script Not Found
```bash
# Make sure you're in project root
cd /Users/leguplabs/Desktop/hot-honey

# Check if script exists
ls -la scripts/check-god-scores.js
```

### Environment Variables Missing
```bash
# Check .env file
cat .env | grep SUPABASE
```

### Script Hanging
```bash
# Kill stuck processes
pkill -f "node scripts"

# Or find and kill specific process
ps aux | grep "god-score-formula"
kill <PID>
```

---

## 📝 **NEXT STEPS**

1. ✅ **Review this document** - Understand what's available
2. 🚀 **Set up daily health check script** - Automate morning checks
3. 🤖 **Enable automation daemon** - `npm run pipeline:daemon`
4. 📊 **Set up daily metrics** - Track trends over time
5. 🔔 **Configure alerts** - Get notified of issues

---

**Last Updated**: 2025-01-07  
**Maintained By**: Hot Match Team

