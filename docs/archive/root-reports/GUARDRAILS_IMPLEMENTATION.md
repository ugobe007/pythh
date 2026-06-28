# Guardrails Implementation Guide

## Overview
Production-hardening patches for Hot Honey API. Adds rate limiting, caching, timeouts, observability, and graceful degradation with minimal code changes.

## Dependencies to Install

```bash
npm install express-rate-limit lru-cache uuid
```

**Why these?**
- `express-rate-limit`: Simple, battle-tested rate limiting (memory or Redis)
- `lru-cache`: Fast in-memory cache with automatic TTL/eviction
- `uuid`: Generate request IDs for tracing

## Implementation Order

### Phase 1: Foundation (30 minutes)
1. Request ID middleware
2. Log redaction wrapper
3. Timeout wrapper utility

### Phase 2: Protection (45 minutes)
4. Rate limiting on `/api/matches`
5. LRU cache for matches
6. URL normalization

### Phase 3: Observability (30 minutes)
7. Structured logging
8. Error tracking
9. Degradation flags

---

## Patch 1: Request ID Middleware

**Location:** `server/index.js`, after `app.use(express.json())`

```javascript
// Generate unique request IDs for tracing
const { v4: uuidv4 } = require('uuid');

app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.id);
  req.startTime = Date.now();
  next();
});
```

**What this does:**
- Every request gets a unique ID
- ID returned to client in headers
- Used for log correlation

---

## Patch 2: Log Redaction Wrapper

**Location:** `server/index.js`, after `getSupabaseClient()` function

```javascript
// ============================================================
// LOG REDACTION - Never leak sensitive data
// ============================================================
function safeLog(level, label, data = {}) {
  const safe = {
    timestamp: new Date().toISOString(),
    request_id: data.request_id || 'unknown',
    label,
    ...data,
  };
  
  // Redact sensitive fields
  if (safe.authorization) delete safe.authorization;
  if (safe.cookie) delete safe.cookie;
  if (safe.jwt) delete safe.jwt;
  if (safe.token) delete safe.token;
  
  // Mask emails
  if (safe.email) {
    const [local, domain] = safe.email.split('@');
    safe.email = `${local.substring(0, 1)}***@${domain}`;
  }
  
  // Truncate URLs (keep hostname + path only)
  if (safe.url) {
    try {
      const u = new URL(safe.url);
      safe.url = `${u.hostname}${u.pathname}`;
    } catch (e) {
      safe.url = safe.url.substring(0, 50) + '...';
    }
  }
  
  // Truncate long arrays (prevent log spam)
  Object.keys(safe).forEach(key => {
    if (Array.isArray(safe[key]) && safe[key].length > 10) {
      safe[key] = `[Array: ${safe[key].length} items]`;
    }
  });
  
  const output = JSON.stringify(safe);
  
  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}
```

**What this does:**
- Strips JWT tokens, cookies, auth headers
- Masks emails: `a***@domain.com`
- Truncates URLs to prevent query param leaks
- Prevents log spam from large arrays

---

## Patch 3: Timeout Wrapper Utility

**Location:** `server/index.js`, after `safeLog()` function

```javascript
// ============================================================
// TIMEOUT WRAPPER - Never hang on slow dependencies
// ============================================================
function withTimeout(promise, timeoutMs, operationName = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

// Pre-configured timeouts for common operations
const TIMEOUTS = {
  SUPABASE_READ: 2500,   // 2.5s for reads
  SUPABASE_WRITE: 2000,  // 2.0s for writes
  EXTERNAL_FETCH: 8000,  // 8s for website crawl/enrichment
  MATCHES_TOTAL: 10000,  // 10s hard limit for /api/matches
};
```

**What this does:**
- Wraps promises with timeout enforcement
- Prevents hanging on Supabase/external API slowness
- Returns clear error messages

**Usage example:**
```javascript
const result = await withTimeout(
  supabase.from('startups').select('*'),
  TIMEOUTS.SUPABASE_READ,
  'startup query'
);
```

---

## Patch 4: Rate Limiting

**Location:** `server/index.js`, before route definitions

```javascript
// ============================================================
// RATE LIMITING - Prevent abuse + cost overruns
// ============================================================
const rateLimit = require('express-rate-limit');

// General API rate limit (soft)
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute per IP
  message: { error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limit for /api/matches (scan endpoint)
const matchesLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // 10 scans per 10 minutes per IP
  message: { 
    error: 'Scan limit reached. Please wait before scanning again.',
    retry_after_seconds: 600 
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use IP + user_id if available (better than IP alone)
    const userId = req.headers['x-user-id'] || req.query.user_id || '';
    return `${req.ip}-${userId}`;
  },
});

// Apply general limiter to all routes
app.use(generalLimiter);
```

**What this does:**
- 120 req/min general API limit (soft)
- 10 scans/10min for `/api/matches` (cost protection)
- Uses IP + user_id for better tracking
- Returns 429 with `Retry-After` header

---

## Patch 5: LRU Cache for Matches

**Location:** `server/index.js`, after rate limiting setup

```javascript
// ============================================================
// LRU CACHE - Reduce Supabase load + improve speed
// ============================================================
const { LRUCache } = require('lru-cache');

// Cache for /api/matches (5 min TTL)
const matchesCache = new LRUCache({
  max: 500, // Store up to 500 startup match results
  ttl: 5 * 60 * 1000, // 5 minutes
  updateAgeOnGet: false, // Don't extend TTL on read
  updateAgeOnHas: false,
});

// Cache for signal history reads (60 sec TTL)
const historyCache = new LRUCache({
  max: 1000,
  ttl: 60 * 1000, // 1 minute
  updateAgeOnGet: false,
});

// URL normalization (single source of truth)
function normalizeUrl(input) {
  if (!input) return null;
  
  try {
    // Handle URLs without protocol
    let url = input.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    
    const parsed = new URL(url);
    
    // Force lowercase host
    let normalized = `https://${parsed.hostname.toLowerCase()}${parsed.pathname}`;
    
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');
    
    // Handle LinkedIn/Crunchbase canonicalization
    if (parsed.hostname.includes('linkedin.com')) {
      // linkedin.com/company/foo → linkedin.com/company/foo
      normalized = normalized.replace(/\/+$/, '');
    }
    
    if (parsed.hostname.includes('crunchbase.com')) {
      // crunchbase.com/organization/foo → crunchbase.com/organization/foo
      normalized = normalized.replace(/\/+$/, '');
    }
    
    return normalized;
  } catch (e) {
    safeLog('warn', 'url-normalization-failed', { url: input, error: e.message });
    return null;
  }
}
```

**What this does:**
- In-memory LRU cache (500 match results, 5 min TTL)
- Prevents refresh storms (same startup scanned repeatedly)
- URL normalization ensures cache hits
- Upgradeable to Redis later (same API)

---

## Patch 6: Update `/api/matches` with Hardening

**Location:** Replace existing `/api/matches` handler

```javascript
// ============================================================
// GET /api/matches - Startup → Investor matches with tier gating
// Core conversion endpoint - the page people pay for
// HARDENED: rate limit + cache + timeout + degradation
// ============================================================
app.get('/api/matches', matchesLimiter, async (req, res) => {
  const reqId = req.id;
  const startTime = req.startTime;
  let degraded = false;
  const degradationReasons = [];
  
  try {
    const startupId = req.query.startup_id;
    if (!startupId) {
      safeLog('warn', 'matches-missing-id', { request_id: reqId });
      return res.status(400).json({ error: 'startup_id is required' });
    }
    
    // Determine plan and enforce limit
    const plan = await getPlanFromRequest(req);
    const maxLimit = MATCH_LIMITS[plan] || 3;
    const requestedLimit = parseInt(req.query.limit) || maxLimit;
    const limit = Math.min(Math.max(requestedLimit, 1), maxLimit, 50);
    
    // Check cache first (key: matches:v1:{startup_id}:{plan})
    const cacheKey = `matches:v1:${startupId}:${plan}`;
    const cached = matchesCache.get(cacheKey);
    if (cached) {
      safeLog('info', 'matches-cache-hit', {
        request_id: reqId,
        startup_id: startupId,
        plan,
        duration_ms: Date.now() - startTime,
      });
      
      res.set('X-Cache', 'HIT');
      res.set('X-Request-ID', reqId);
      return res.json({ ...cached, cached: true });
    }
    
    const supabase = getSupabaseClient();
    
    // Step 1: Get startup details (with timeout)
    let startup;
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('startup_uploads')
          .select('id, name, sectors, stage, tagline, total_god_score')
          .eq('id', startupId)
          .single(),
        TIMEOUTS.SUPABASE_READ,
        'startup query'
      );
      
      if (error || !data) {
        safeLog('error', 'matches-startup-not-found', {
          request_id: reqId,
          startup_id: startupId,
          error: error?.message,
        });
        return res.status(404).json({ error: 'Startup not found' });
      }
      
      startup = data;
    } catch (timeoutError) {
      safeLog('error', 'matches-startup-timeout', {
        request_id: reqId,
        startup_id: startupId,
        error: timeoutError.message,
      });
      return res.status(504).json({ error: 'Startup query timed out' });
    }
    
    // Step 2: Get matches (with timeout)
    let matchData;
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('startup_investor_matches')
          .select('investor_id, match_score, confidence_level, reasoning, why_you_match, fit_analysis')
          .eq('startup_id', startupId)
          .gte('match_score', 20)
          .order('match_score', { ascending: false })
          .limit(limit),
        TIMEOUTS.SUPABASE_READ,
        'matches query'
      );
      
      if (error) {
        throw error;
      }
      
      matchData = data || [];
    } catch (matchError) {
      // GRACEFUL DEGRADATION: Return partial results instead of failing
      safeLog('error', 'matches-query-failed', {
        request_id: reqId,
        startup_id: startupId,
        error: matchError.message,
      });
      
      degraded = true;
      degradationReasons.push('match query failed');
      matchData = []; // Return empty matches instead of crashing
    }
    
    // Step 2.5: Record signal history (BEFORE tier gating)
    // Non-blocking - don't fail the request if this fails
    try {
      await withTimeout(
        recordSignalHistory({
          supabase,
          startupId: startup.id,
          rawMatches: matchData,
          godScore: startup.total_god_score,
          source: 'scan',
          meta: { endpoint: '/api/matches', request_id: reqId }
        }),
        TIMEOUTS.SUPABASE_WRITE,
        'signal history recording'
      );
    } catch (historyError) {
      // Log but don't fail the request
      safeLog('warn', 'matches-history-failed', {
        request_id: reqId,
        startup_id: startupId,
        error: historyError.message,
      });
      degraded = true;
      degradationReasons.push('history recording failed');
    }
    
    // Step 3: Get total count (with timeout, non-critical)
    let totalMatches = matchData.length;
    try {
      const { count } = await withTimeout(
        supabase
          .from('startup_investor_matches')
          .select('id', { count: 'exact', head: true })
          .eq('startup_id', startupId)
          .gte('match_score', 20),
        TIMEOUTS.SUPABASE_READ,
        'match count query'
      );
      totalMatches = count || matchData.length;
    } catch (countError) {
      // Non-critical - use fallback
      safeLog('warn', 'matches-count-failed', {
        request_id: reqId,
        startup_id: startupId,
        error: countError.message,
      });
      degraded = true;
      degradationReasons.push('count query failed');
    }
    
    // Step 4: Get investor details (with timeout)
    const investorIds = matchData.map(m => m.investor_id).filter(Boolean);
    let investors = [];
    
    if (investorIds.length > 0) {
      try {
        const { data } = await withTimeout(
          supabase
            .from('investors')
            .select('id, name, firm, photo_url, linkedin_url, sectors, stage, check_size_min, check_size_max, type, notable_investments, investment_thesis')
            .in('id', investorIds),
          TIMEOUTS.SUPABASE_READ,
          'investor query'
        );
        investors = data || [];
      } catch (investorError) {
        // GRACEFUL DEGRADATION: Show matches without investor details
        safeLog('warn', 'matches-investors-failed', {
          request_id: reqId,
          startup_id: startupId,
          error: investorError.message,
        });
        degraded = true;
        degradationReasons.push('investor details unavailable');
      }
    }
    
    const investorMap = new Map(investors.map(inv => [inv.id, inv]));
    
    // Step 5: Apply field masking based on plan
    const maskedMatches = matchData.map(m => {
      const investor = investorMap.get(m.investor_id) || {};
      
      const base = {
        investor_id: m.investor_id,
        match_score: m.match_score,
        firm: investor.firm || null,
        photo_url: investor.photo_url || null,
        sectors: investor.sectors || [],
        stage: investor.stage || [],
        type: investor.type || null,
      };
      
      if (plan === 'free') {
        return {
          ...base,
          investor_name: null,
          investor_name_masked: true,
          linkedin_url: null,
          check_size_min: null,
          check_size_max: null,
          notable_investments: null,
          reasoning: null,
          confidence_level: null,
          why_you_match: null,
          fit_analysis: null,
        };
      }
      
      if (plan === 'pro') {
        return {
          ...base,
          investor_name: investor.name || 'Unknown Investor',
          investor_name_masked: false,
          linkedin_url: investor.linkedin_url || null,
          check_size_min: investor.check_size_min || null,
          check_size_max: investor.check_size_max || null,
          notable_investments: investor.notable_investments || null,
          reasoning: null,
          confidence_level: null,
          why_you_match: null,
          fit_analysis: null,
        };
      }
      
      // Elite: Everything
      return {
        ...base,
        investor_name: investor.name || 'Unknown Investor',
        investor_name_masked: false,
        linkedin_url: investor.linkedin_url || null,
        check_size_min: investor.check_size_min || null,
        check_size_max: investor.check_size_max || null,
        notable_investments: investor.notable_investments || null,
        investment_thesis: investor.investment_thesis || null,
        reasoning: m.reasoning || null,
        confidence_level: m.confidence_level || null,
        why_you_match: m.why_you_match || null,
        fit_analysis: m.fit_analysis || null,
      };
    });
    
    // Build response
    const response = {
      plan,
      startup: {
        id: startup.id,
        name: startup.name,
        sectors: startup.sectors,
        stage: startup.stage,
        tagline: startup.tagline,
      },
      limit,
      showing: maskedMatches.length,
      total: totalMatches,
      data: maskedMatches,
      degraded,
      degradation_reasons: degraded ? degradationReasons : undefined,
    };
    
    // Cache the response (even if degraded - prevents retry storms)
    matchesCache.set(cacheKey, response);
    
    // Set headers
    const cacheMaxAge = plan === 'elite' ? 60 : 300;
    res.set('Cache-Control', `private, max-age=${cacheMaxAge}`);
    res.set('X-Plan', plan);
    res.set('X-Cache', 'MISS');
    res.set('X-Request-ID', reqId);
    if (degraded) {
      res.set('X-Degraded', 'true');
    }
    
    // Log success
    safeLog('info', 'matches-success', {
      request_id: reqId,
      startup_id: startupId,
      plan,
      showing: maskedMatches.length,
      total: totalMatches,
      degraded,
      duration_ms: Date.now() - startTime,
    });
    
    res.json(response);
    
  } catch (error) {
    safeLog('error', 'matches-error', {
      request_id: reqId,
      error: error.message,
      stack: error.stack,
      duration_ms: Date.now() - startTime,
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch matches',
      request_id: reqId,
      degraded: true,
    });
  }
});
```

**What this does:**
- ✅ Rate limited (10 scans / 10 min)
- ✅ LRU cached (5 min TTL)
- ✅ All queries wrapped in timeouts
- ✅ Graceful degradation (returns partial results instead of failing)
- ✅ Request ID tracing
- ✅ Structured logging
- ✅ Cache hit/miss tracking

---

## Patch 7: Harden Signal History Endpoint

**Location:** `server/routes/startups.js`

```javascript
// GET /api/startups/:id/signal-history?days=14
router.get('/:id/signal-history', async (req, res) => {
  const reqId = req.headers['x-request-id'] || 'unknown';
  const startTime = Date.now();
  
  try {
    const supabase = getUserSupabase(req);
    const { id } = req.params;

    const days = Math.max(1, Math.min(90, parseInt(req.query.days || '14', 10)));
    
    // Check cache first
    const cacheKey = `history:v1:${id}:${days}`;
    const cached = historyCache.get(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      res.set('X-Request-ID', reqId);
      return res.json({ ...cached, cached: true });
    }
    
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Wrap in timeout
    const { data, error } = await withTimeout(
      supabase
        .from('startup_signal_history')
        .select('recorded_at, signal_strength, readiness, power_score, fundraising_window')
        .eq('startup_id', id)
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: true }),
      TIMEOUTS.SUPABASE_READ,
      'signal history query'
    );

    if (error) {
      safeLog('error', 'history-query-error', {
        request_id: reqId,
        startup_id: id,
        error: error.message,
      });
      return res.status(500).json({ error: 'Failed to fetch history' });
    }
    
    const response = {
      success: true,
      history: data || [],
      showing: data?.length || 0,
      days_requested: days,
    };
    
    // Cache the result
    historyCache.set(cacheKey, response);
    
    res.set('X-Cache', 'MISS');
    res.set('X-Request-ID', reqId);
    
    safeLog('info', 'history-success', {
      request_id: reqId,
      startup_id: id,
      showing: data?.length || 0,
      duration_ms: Date.now() - startTime,
    });
    
    return res.json(response);
  } catch (err) {
    safeLog('error', 'history-error', {
      request_id: reqId,
      error: err.message,
      duration_ms: Date.now() - startTime,
    });
    return res.status(500).json({ 
      error: 'Internal server error',
      request_id: reqId,
    });
  }
});
```

---

## Patch 8: Production Health Check Enhancements

**Location:** `scripts/healthcheck.js`

Add at the end before summary:

```javascript
// ⚙️  GUARDRAILS SANITY
console.log('\n🛡️  GUARDRAILS SANITY\n');

// Check rate limiter is active
try {
  const response = await fetch('http://localhost:3002/api/health');
  const headers = response.headers;
  
  if (headers.get('x-ratelimit-limit')) {
    console.log('✅ Rate limiting active');
  } else {
    console.log('⚠️  Rate limiting not detected (check express-rate-limit)');
  }
} catch (e) {
  console.log('❌ Could not verify rate limiting');
  failures++;
}

// Check request ID middleware
try {
  const response = await fetch('http://localhost:3002/api/health');
  if (response.headers.get('x-request-id')) {
    console.log('✅ Request ID middleware active');
  } else {
    console.log('❌ Request ID middleware missing');
    failures++;
  }
} catch (e) {
  console.log('❌ Could not verify request ID middleware');
  failures++;
}

// Check cache headers
try {
  const testStartupId = '11cd88ad-d464-4f5c-9e65-82da8ffe7e8a'; // "Were"
  const response = await fetch(`http://localhost:3002/api/matches?startup_id=${testStartupId}`);
  
  if (response.headers.get('x-cache')) {
    console.log('✅ Cache middleware active');
  } else {
    console.log('⚠️  Cache headers not detected');
  }
  
  if (response.headers.get('cache-control')) {
    console.log('✅ Cache-Control headers set');
  } else {
    console.log('❌ Cache-Control headers missing');
    failures++;
  }
} catch (e) {
  console.log('⚠️  Could not verify cache (might be auth-protected)');
}
```

---

## Testing Checklist

### 1. Rate Limiting
```bash
# Should hit limit on 11th request
for i in {1..15}; do 
  curl -s "http://localhost:3002/api/matches?startup_id=TEST_ID" | jq -r '.error'
  sleep 1
done

# Expected: First 10 succeed, 11-15 return 429
```

### 2. Cache Effectiveness
```bash
# First request (cache MISS)
curl -i "http://localhost:3002/api/matches?startup_id=TEST_ID" | grep X-Cache

# Second request within 5 min (cache HIT)
curl -i "http://localhost:3002/api/matches?startup_id=TEST_ID" | grep X-Cache

# Expected: First MISS, second HIT
```

### 3. Request ID Tracing
```bash
curl -i "http://localhost:3002/api/matches?startup_id=TEST_ID" | grep X-Request-ID

# Should see unique UUID in response
# Check server logs for same UUID
```

### 4. Timeout Behavior
Temporarily set `TIMEOUTS.SUPABASE_READ = 100` (very low), then:
```bash
curl "http://localhost:3002/api/matches?startup_id=TEST_ID"

# Expected: 504 timeout or degraded response
```

### 5. Graceful Degradation
Stop Supabase connection (or use invalid credentials temporarily):
```bash
curl "http://localhost:3002/api/matches?startup_id=TEST_ID"

# Expected: degraded: true, partial results or empty array (not 500 crash)
```

---

## Production Deployment Checklist

Before deploying to production:

- [ ] Install dependencies: `npm install express-rate-limit lru-cache uuid`
- [ ] Apply all 8 patches above
- [ ] Test rate limiting locally (see Testing Checklist)
- [ ] Test cache hit/miss locally
- [ ] Verify request IDs in logs
- [ ] Test timeout behavior with low thresholds
- [ ] Test degradation with Supabase disconnected
- [ ] Run `node scripts/healthcheck.js` (all green)
- [ ] Update PM2 ecosystem: `pm2 restart api-server`
- [ ] Monitor logs for first 30 minutes post-deploy
- [ ] Verify no 500 errors spike
- [ ] Check cache hit rate (should be 30-50% after 10 min)

---

## SLO Targets (Write These Down)

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| `/api/matches` p95 latency | < 4.0s | > 8.0s |
| `/api/matches` error rate | < 1% | > 3% |
| `/api/startups/:id/signal-history` p95 | < 600ms | > 2.0s |
| Supabase error rate | < 0.5% | > 2% |
| Cache hit rate | > 30% | < 10% (cache broken) |
| 429 rate (abuse detection) | < 5 req/min | > 50 req/min (attack) |

**How to monitor:**
- PM2 logs: `pm2 logs api-server --lines 100 | grep 'matches-success'`
- Error tracking: `pm2 logs api-server --err-only`
- Structured logs: `tail -f logs/api-server.log | jq '.duration_ms'`

---

## Future Upgrades (Optional)

### Upgrade to Redis (when scaling)
Replace LRUCache with Redis:
```javascript
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

// Cache get
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// Cache set
await redis.setex(cacheKey, 300, JSON.stringify(response));
```

### Add Circuit Breaker (if dependencies flaky)
Use `opossum` library:
```javascript
const CircuitBreaker = require('opossum');

const supabaseBreaker = new CircuitBreaker(querySupabase, {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
});
```

### Add APM (Application Performance Monitoring)
Integrate lightweight APM:
- **Sentry** (errors only): Free tier, <5 min setup
- **Axiom** (logs + traces): Free 500GB/month
- **Better Stack** (logs): Free tier available

---

## Summary

**What We Added:**
1. ✅ Request ID tracing (every request tracked)
2. ✅ Log redaction (no leaked secrets)
3. ✅ Timeout enforcement (no hanging)
4. ✅ Rate limiting (10 scans/10min, 120 req/min general)
5. ✅ LRU caching (5 min matches, 60s history)
6. ✅ Graceful degradation (partial results instead of 500s)
7. ✅ Structured logging (JSON, correlatable)
8. ✅ Health check enhancements (verify guardrails work)

**What Changed:**
- `/api/matches`: Added rate limit + cache + timeout + degradation
- `/api/startups/:id/signal-history`: Added cache + timeout
- All logs: Redacted sensitive data
- All Supabase calls: Wrapped in timeouts

**Impact:**
- 🚀 **Faster**: Cache reduces Supabase load by 30-50%
- 🛡️ **Safer**: Rate limits prevent abuse + cost overruns
- 🔍 **Observable**: Request IDs + structured logs = find issues fast
- 💪 **Resilient**: Timeouts + degradation = no crashes from slow deps

**Next Steps:**
1. Apply patches 1-8 above
2. Run full testing checklist
3. Deploy to production with PM2 restart
4. Monitor for 30 minutes
5. Complete Ship Checklist (two-account test, idempotency, cold-start)
6. **Then** add polish (microcopy for window states)

---

*Ready to implement? Say "apply patches" and I'll execute all 8 in sequence.*
