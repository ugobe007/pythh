# RSS Anti-Blocking Strategy

## Overview

This document describes the anti-blocking measures implemented in the RSS scraper to handle websites that block or rate-limit scrapers.

## Implemented Features

### 1. User-Agent Rotation

The scraper rotates through 5 real browser user agents to appear as legitimate traffic:

```javascript
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ...',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ...',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) ...',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/117.0'
];
```

### 2. Adaptive Delays with Source Health Tracking

Each source has health tracking with exponential backoff:

- **Success**: Resets failure count, can use normal delay (3-8 seconds)
- **Failure**: Records error type, increases delay exponentially
- **Circuit Breaker**: After 5 consecutive failures, source is skipped for 5 minutes

```javascript
// Backoff formula
const backoffMs = Math.min(60000, 1000 * Math.pow(2, health.consecutiveFailures));
```

### 3. Domain-Specific Rate Limits

Some domains require longer delays:

```javascript
const RATE_LIMIT_CONFIG = {
  'techcrunch.com': 5000,    // 5 seconds
  'venturebeat.com': 5000,
  'fortune.com': 8000,       // 8 seconds (more aggressive blocking)
  'wsj.com': 8000,
  'bloomberg.com': 8000,
  'default': 3000            // 3 seconds for all others
};
```

### 4. Proxy Support (Optional)

For sources that completely block your IP, proxy support is available:

```bash
# Add to .env
PROXY_URL=http://user:pass@proxy.example.com:8080
```

Domains that auto-use proxy (when PROXY_URL is set):
- fortune.com
- wsj.com
- wired.co.uk
- bloomberg.com

### 5. Error Classification

Errors are classified to inform backoff strategy:

| Error Type | Backoff |
|------------|---------|
| TIMEOUT | Short (might be temporary) |
| FORBIDDEN (403) | Long (IP blocked) |
| RATE_LIMITED (429) | Medium (rate limit) |
| NOT_FOUND (404) | Source disabled |
| CONNECTION_REFUSED | Long |

---

## RSS Source Status

### Active Sources: 154
Includes 16 new scraper-friendly sources added:

**Google News RSS (6 feeds)**:
- Startups, VC Funding, Series A, YC Startups, AI Startups, Fintech

**Reddit RSS (4 feeds)**:
- r/startups, r/Entrepreneur, r/SaaS, r/venturecapital

**Others (6 feeds)**:
- Lobsters, Silicon Republic, Startupbeat, PitchBook News, ZDNet, TechRepublic

### Disabled Sources: 71
Sources returning 404, no valid feed, or permanently blocked were disabled.

---

## Monitoring

### Check Source Health
```sql
SELECT name, last_scraped, error_count, 
       CASE WHEN last_scraped < NOW() - INTERVAL '24 hours' THEN 'STALE' ELSE 'OK' END as status
FROM rss_sources 
WHERE active = true
ORDER BY last_scraped DESC NULLS LAST;
```

### Check Scraper Logs
```bash
pm2 logs rss-scraper --lines 100
```

### System Guardian
The system guardian monitors RSS health automatically every 10 minutes.

---

## Proxy Services (If Needed)

If you continue to have blocking issues, consider:

1. **ScraperAPI** - https://www.scraperapi.com/
   - Free tier: 5,000 requests/month
   - Automatic proxy rotation

2. **Bright Data** - https://brightdata.com/
   - Enterprise-grade proxies
   - Residential IPs available

3. **SmartProxy** - https://smartproxy.com/
   - Good for RSS/news sites
   - Rotating residential proxies

---

## Future Improvements

1. **Headless Browser Fallback**: For sources that require JS rendering
2. **Tor Integration**: For highly restricted sources
3. **Multiple Proxy Pool**: Rotate between multiple proxy providers
4. **Webhook Notifications**: Alert when sources fail repeatedly

---

*Last updated: $(date)*
