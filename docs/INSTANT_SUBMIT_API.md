# 🚀 Instant Submit API & Pythh Health Monitor

**Deployed:** February 4, 2026  
**Commit:** `04963649`  
**Fly.io App:** [hot-honey.fly.dev](https://hot-honey.fly.dev/)

---

## Overview

This release introduces a **fast-path URL submission system** that replaces the slow polling-based discovery pipeline with instant synchronous processing. It also adds a **health monitoring agent** that auto-heals the system when issues are detected.

---

## 🔥 Instant Submit API

### Endpoint

```
POST /api/instant/submit
```

### Purpose

Accept a startup URL, process it immediately, and return matches within milliseconds (cached) or seconds (new URLs).

### Performance

| Scenario | Response Time | Previous System |
|----------|---------------|-----------------|
| **Cached URL** | 339-420ms ⚡ | 30+ seconds |
| **New URL** | 2-4 seconds ⚡ | 30+ seconds |

### Request

```json
{
  "url": "https://example-startup.com"
}
```

### Response (Success)

```json
{
  "success": true,
  "startup": {
    "id": "uuid",
    "name": "Example Startup",
    "url": "https://example-startup.com",
    "total_god_score": 72,
    "isNew": false
  },
  "matches": [
    {
      "investor_id": "uuid",
      "investor_name": "Sequoia Capital",
      "match_score": 85,
      "sectors": ["SaaS", "Enterprise"],
      "stage": "Series A"
    }
  ],
  "matchCount": 150,
  "processingTimeMs": 420
}
```

### Response (Error)

```json
{
  "success": false,
  "error": "Invalid URL format"
}
```

### How It Works

1. **URL Normalization**: Strips protocols, www, trailing slashes
2. **Cache Check**: Looks for existing startup with normalized URL
3. **Investor Fetch**: Gets all active investors with their criteria
4. **Match Generation**: Calculates compatibility scores instantly
5. **Background Insert**: Asynchronously saves matches (500ms timeout)
6. **Return Results**: Sends top 50 matches immediately

### File Location

[server/routes/instantSubmit.js](../server/routes/instantSubmit.js)

---

## 🛡️ Pythh URL Monitor

### Purpose

Health monitoring agent that runs every 5 minutes via PM2 to check system health and auto-heal when issues are detected.

### Health Checks

| Check | What It Monitors | Thresholds |
|-------|------------------|------------|
| **Instant API Health** | Response time, investor count | Max 5000ms, Min 100 investors |
| **Match Coverage** | Total matches, avg per startup | Min 50 matches per startup |
| **Queue Health** | Stuck jobs, queue backlog | Max 100 queued jobs |
| **Error Rates** | Errors in ai_logs (last hour) | Max 10% error rate |

### Auto-Healing Actions

When issues are detected, the monitor automatically:

1. **Restarts discovery-job-processor** if jobs are stuck
2. **Triggers match-regenerator.js** if match count is low
3. **Logs all actions** to `ai_logs` table for audit trail

### Configuration

```javascript
const THRESHOLDS = {
  INSTANT_API_MAX_MS: 5000,      // Max API response time
  MIN_INVESTORS_ACTIVE: 100,     // Min active investors
  MIN_MATCHES_PER_STARTUP: 50,   // Min matches per startup
  MAX_QUEUED_JOBS: 100,          // Max pending jobs
  MAX_ERROR_RATE: 0.1,           // 10% max error rate
};
```

### PM2 Process

```bash
# Check status
pm2 status pythh-url-monitor

# View logs
pm2 logs pythh-url-monitor --lines 50

# Manual run
node scripts/pythh-url-monitor.js
```

### File Location

[scripts/pythh-url-monitor.js](../scripts/pythh-url-monitor.js)

---

## 📁 Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `server/routes/instantSubmit.js` | **NEW** | Instant URL submission endpoint |
| `scripts/pythh-url-monitor.js` | **NEW** | Health monitoring agent |
| `ecosystem.config.js` | Modified | Added pythh-url-monitor process |
| `server/index.js` | Modified | Registered `/api/instant` route |

---

## 🔧 Deployment

### Fly.io

```bash
# Deploy
fly deploy

# Check status
fly status

# View logs
fly logs
```

### PM2 (Local/Server)

```bash
# Start monitor
pm2 start ecosystem.config.js --only pythh-url-monitor

# Restart all processes with new env
pm2 reload ecosystem.config.js --update-env
```

---

## 🧪 Testing

### Test Instant API

```bash
# Cached URL (should be ~400ms)
curl -X POST http://localhost:3002/api/instant/submit \
  -H "Content-Type: application/json" \
  -d '{"url": "https://stripe.com"}' | jq '.processingTimeMs'

# Health check
curl http://localhost:3002/api/instant/health | jq .
```

### Test Monitor

```bash
# Run manually
node scripts/pythh-url-monitor.js

# Expected output:
# ╔════════════════════════════════════════════════════╗
# ║     🔍 PYTHH URL MONITOR - Health Check            ║
# ╚════════════════════════════════════════════════════╝
# 
# ✅ Instant API Health: OK (582ms, 3717 investors)
# ✅ Match Coverage: OK (649,948 matches, avg 105/startup)
# ✅ Queue Health: OK (0 stuck, 100 queued)
# ✅ Error Rate: OK (0.0%)
# 
# ═══════════════════════════════════════════════════════
# Overall Status: ✅ OK
```

---

## 📊 Database Impact

### Tables Used

- `startup_uploads` - Startup records
- `investors` - Investor profiles
- `startup_investor_matches` - Match records
- `discovery_jobs` - Queue jobs
- `ai_logs` - System logs

### Indexes Utilized

The instant API benefits from existing indexes:
- `startup_uploads(normalized_url)`
- `investors(status)`
- `startup_investor_matches(startup_id, investor_id)`

---

## 🔄 Migration from Old System

The old discovery pipeline (`/api/discovery/submit`) used a polling-based approach:

```
Old: URL → queued → building → scoring → matching → ready (30+ seconds)
New: URL → instant matches (339ms - 4 seconds)
```

**The old endpoint still works** for backwards compatibility. The new `/api/instant/submit` is recommended for all new integrations.

---

## 📝 Future Improvements

1. **Caching Layer**: Add Redis for even faster cached responses
2. **Batch Processing**: Support multiple URLs in single request
3. **Webhook Notifications**: Notify on new high-score matches
4. **Rate Limiting**: Add per-key rate limits for API abuse prevention

---

## 🔗 Related Documentation

- [SYSTEM_GUARDIAN.md](../SYSTEM_GUARDIAN.md) - System Guardian health checks
- [copilot-instructions.md](../.github/copilot-instructions.md) - AI coding guidelines
- [ecosystem.config.js](../ecosystem.config.js) - PM2 process configuration

---

*Last updated: February 4, 2026*
