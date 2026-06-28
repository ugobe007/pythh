# Scraper API Endpoints

## Base URL
```
http://localhost:3002
```

---

## 📡 RSS Scraper Endpoints

### 1. Refresh RSS Feeds
**Endpoint:** `POST /api/rss/refresh`

**Description:** Triggers RSS scraper to refresh all RSS feeds

**Request:**
```bash
curl -X POST http://localhost:3002/api/rss/refresh
```

**Response:**
```json
{
  "success": true,
  "message": "RSS scraper started. Check server logs for progress.",
  "timestamp": "2026-01-11T..."
}
```

**Script Called:** `run-rss-scraper.js`

---

### 2. Discover Startups from RSS
**Endpoint:** `POST /api/rss/discover-startups`

**Description:** Triggers startup discovery script that extracts startups from RSS articles using AI

**Request:**
```bash
curl -X POST http://localhost:3002/api/rss/discover-startups
```

**Response:**
```json
{
  "success": true,
  "message": "Startup discovery started. Check server logs for progress.",
  "timestamp": "2026-01-11T..."
}
```

**Script Called:** `discover-startups-from-rss.js`

**What it does:**
- Fetches articles from all active RSS sources
- Uses AI (GPT-4o-mini) to extract startup mentions
- Saves discovered startups to `discovered_startups` table

---

## 💼 Investor Scraper Endpoints

### 3. Scrape Investors
**Endpoint:** `POST /api/investors/scrape`

**Description:** Triggers investor scraper to find and scrape investor data

**Request:**
```bash
curl -X POST http://localhost:3002/api/investors/scrape
```

**Response:**
```json
{
  "success": true,
  "message": "Investor scraper started. Check server logs for progress.",
  "timestamp": "2026-01-11T..."
}
```

**Script Called:** `investor-mega-scraper.js`

---

## ⚡ GOD Score Calculation

### 4. Calculate GOD Scores
**Endpoint:** `POST /api/god-scores/calculate`

**Description:** Triggers GOD score calculation for startups

**Request:**
```bash
curl -X POST http://localhost:3002/api/god-scores/calculate
```

**Response:**
```json
{
  "success": true,
  "message": "GOD score calculation started. Check server logs for progress.",
  "timestamp": "2026-01-11T..."
}
```

**Script Called:** `calculate-component-scores.js`

---

## 🔄 Generic Scraper Endpoint

### 5. Run Any Scraper Script
**Endpoint:** `POST /api/scrapers/run`

**Description:** Generic endpoint to run any scraper script by name

**Request Body:**
```json
{
  "scriptName": "simple-rss-scraper.js",
  "description": "Simple RSS Scraper"
}
```

**Example:**
```bash
curl -X POST http://localhost:3002/api/scrapers/run \
  -H "Content-Type: application/json" \
  -d '{
    "scriptName": "simple-rss-scraper.js",
    "description": "Simple RSS Scraper"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Simple RSS Scraper started. Check server logs for progress.",
  "timestamp": "2026-01-11T..."
}
```

**Available Scripts:**
- `simple-rss-scraper.js` - Basic RSS scraper
- `discover-startups-from-rss.js` - AI-powered startup discovery
- `investor-mega-scraper.js` - Investor data scraper
- `calculate-component-scores.js` - GOD score calculator
- `queue-processor-v16.js` - Matching queue processor
- `unified-scraper-orchestrator.js` - Orchestrates all scrapers

---

## 🏥 Health Check

### 6. API Health Check
**Endpoint:** `GET /api/health`

**Description:** Check if API server is running

**Request:**
```bash
curl http://localhost:3002/api/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-11T...",
  "supabase": "connected"
}
```

---

### 7. API Info
**Endpoint:** `GET /api`

**Description:** List all available API endpoints

**Request:**
```bash
curl http://localhost:3002/api
```

**Response:**
```json
{
  "name": "pyth ai API",
  "version": "0.1.0",
  "endpoints": [
    "GET /api/health",
    "POST /api/rss/refresh",
    "POST /api/rss/discover-startups",
    "POST /api/investors/scrape",
    "POST /api/god-scores/calculate",
    "POST /api/scrapers/run",
    ...
  ]
}
```

---

## 📝 Implementation Details

### How Scripts Are Executed

All scraper endpoints use the `spawnAutomationScript()` function which:
1. Spawns a child process to run the Node.js script
2. Logs output to the console
3. Returns immediately (scripts run in background)
4. Scripts are located in the `scripts/` directory

### Script Location
```
scripts/
  ├── core/
  │   ├── simple-rss-scraper.js
  │   ├── queue-processor-v16.js
  │   └── unified-scraper-orchestrator.js
  ├── discover-startups-from-rss.js
  └── investor-mega-scraper.js
```

---

## 🔍 Monitoring

### Check Server Logs
```bash
# View server logs
tail -f server/logs/*.log

# Or check PM2 logs if running with PM2
pm2 logs
```

### Check Scraper Status
```bash
# Check if scrapers are running
pm2 list | grep -E "scraper|rss|orchestrator"

# View scraper logs
pm2 logs rss-scraper
pm2 logs scraper
pm2 logs orchestrator
```

---

## ⚠️ Notes

1. All endpoints return immediately - scripts run asynchronously in background
2. Check server logs or PM2 logs to see actual progress
3. Scripts may take several minutes to hours depending on data volume
4. Some scripts require environment variables (Supabase credentials, API keys)
5. Multiple scrapers can run simultaneously, but may impact performance

---

## 🚀 Common Workflows

### Daily Scraper Run
```bash
# 1. Refresh RSS feeds
curl -X POST http://localhost:3002/api/rss/refresh

# 2. Discover startups from RSS
curl -X POST http://localhost:3002/api/rss/discover-startups

# 3. Calculate GOD scores for new startups
curl -X POST http://localhost:3002/api/god-scores/calculate
```

### Full Pipeline
```bash
# Run orchestrator (handles all scrapers)
curl -X POST http://localhost:3002/api/scrapers/run \
  -H "Content-Type: application/json" \
  -d '{
    "scriptName": "unified-scraper-orchestrator.js",
    "description": "Unified Scraper Orchestrator"
  }'
```
