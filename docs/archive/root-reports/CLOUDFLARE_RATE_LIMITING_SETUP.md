# Cloudflare Edge Rate Limiting Setup

## Overview

**Goal:** Prevent investor observatory abuse (scraping, quota exhaustion) at the edge before requests hit Supabase.

**Target endpoints:**
- `/rest/v1/*` (Supabase REST API)
- `/auth/v1/*` (Supabase Auth API)

**Rate limits:**
- **10 requests/minute per authenticated user**
- **Burst allowance:** 20 requests in first 10 seconds (for page load)
- **Anonymous users:** 5 requests/minute (guest browsing)

---

## Implementation Steps

### 1. Add Cloudflare to Your Domain

**Prerequisites:**
- Observatory deployed at `https://hot-honey.fly.dev`
- Custom domain (e.g., `observatory.hotmatch.ai`) pointed to Fly.io
- Cloudflare account

**Steps:**
1. Add domain to Cloudflare
2. Update nameservers at domain registrar
3. Set SSL/TLS mode to "Full (strict)"
4. Wait for SSL certificate provisioning (5-10 minutes)

---

### 2. Configure Rate Limiting Rule

**Navigate to:** Cloudflare Dashboard → Security → WAF → Rate limiting rules

**Create New Rule:**

**Rule Name:** `Observatory Supabase Rate Limit`

**Match Expression:**
```
(http.request.uri.path contains "/rest/v1/" or 
 http.request.uri.path contains "/auth/v1/") and 
http.request.headers["origin"] contains "hot-honey.fly.dev"
```

**Characteristics:**
- **Counting expression:** `http.request.headers["authorization"][0]`
  - This counts requests by JWT token (authenticated users)
  - For anonymous: Fall back to IP address

**Rate Limiting Settings:**
- **Requests:** 10
- **Period:** 1 minute (60 seconds)
- **Mitigation action:** Block
- **Duration:** 60 seconds

**Advanced Settings:**
- ✅ Enable "Burst allowance"
  - **Burst requests:** 20
  - **Burst period:** 10 seconds
  - Allows fast page load, then throttles

---

### 3. Anonymous User Rate Limit (Stricter)

**Create Second Rule:**

**Rule Name:** `Observatory Anonymous Rate Limit`

**Match Expression:**
```
(http.request.uri.path contains "/rest/v1/" or 
 http.request.uri.path contains "/auth/v1/") and 
http.request.headers["origin"] contains "hot-honey.fly.dev" and
not http.request.headers["authorization"]
```

**Characteristics:**
- **Counting expression:** `ip.src` (count by IP address)

**Rate Limiting Settings:**
- **Requests:** 5
- **Period:** 1 minute
- **Mitigation action:** Block
- **Duration:** 60 seconds

---

### 4. Custom Challenge Page (Optional)

When rate limit is hit, show a friendly message:

**Navigate to:** Cloudflare Dashboard → Security → Custom rules → Custom error responses

**Error Code:** 429 (Too Many Requests)

**Custom HTML:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Rate Limit Reached</title>
  <style>
    body { 
      font-family: system-ui; 
      background: #0a0a0a; 
      color: #e5e7eb; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      height: 100vh;
      margin: 0;
    }
    .container {
      text-align: center;
      max-width: 500px;
      padding: 2rem;
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 12px;
    }
    h1 { color: #f59e0b; margin-bottom: 1rem; }
    p { color: #9ca3af; line-height: 1.6; }
    .code { 
      background: #111827; 
      padding: 0.5rem 1rem; 
      border-radius: 6px; 
      font-family: monospace;
      color: #60a5fa;
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>⏸️ Observatory Rate Limit</h1>
    <p>
      You've reached the request limit for the Investor Observatory.
    </p>
    <p>
      <strong>Limit:</strong> 10 requests/minute (authenticated)<br>
      <strong>Reset:</strong> Try again in 60 seconds
    </p>
    <div class="code">
      This is an observatory, not a marketplace.<br>
      No scraping. No data extraction.
    </div>
  </div>
</body>
</html>
```

---

## Monitoring & Alerts

### View Rate Limit Activity

**Navigate to:** Cloudflare Dashboard → Analytics → Security → Rate limiting

**Metrics tracked:**
- Number of blocked requests
- Top blocked IPs
- Top blocked user agents
- Time series graph

### Set Up Alerts

**Navigate to:** Cloudflare Dashboard → Notifications → Add

**Alert Type:** Rate Limiting

**Trigger:** When rate limit rule blocks > 100 requests in 5 minutes

**Notification methods:**
- Email
- Webhook (Slack/Discord)
- PagerDuty

---

## Testing Rate Limits

### Test Script (Node.js)

```javascript
// test-rate-limit.js
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

async function testRateLimit() {
  console.log('Testing rate limit (should fail after 10 requests)...\n');
  
  for (let i = 1; i <= 15; i++) {
    const start = Date.now();
    
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/investor_discovery_flow_public`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Origin': 'https://hot-honey.fly.dev'
        }
      });
      
      const elapsed = Date.now() - start;
      
      if (response.ok) {
        console.log(`✅ Request ${i}: Success (${elapsed}ms)`);
      } else if (response.status === 429) {
        console.log(`🚫 Request ${i}: RATE LIMITED (${response.status})`);
      } else {
        console.log(`❌ Request ${i}: Error ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Request ${i}: ${error.message}`);
    }
    
    // Small delay to simulate real usage
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

testRateLimit();
```

**Run:**
```bash
node test-rate-limit.js
```

**Expected output:**
```
✅ Request 1: Success (120ms)
✅ Request 2: Success (95ms)
...
✅ Request 10: Success (110ms)
🚫 Request 11: RATE LIMITED (429)
🚫 Request 12: RATE LIMITED (429)
```

---

## Exemptions (If Needed)

### Allow Admin IPs

If you need to bypass rate limits for admin debugging:

**Navigate to:** Cloudflare Dashboard → Security → WAF → Tools

**Create IP Access Rule:**
- **IP Address:** `YOUR_ADMIN_IP`
- **Action:** Allow
- **Zone:** `observatory.hotmatch.ai`

### Allow Specific User Agents

For automated monitoring (e.g., uptime checks):

**Add to rate limit rule exception:**
```
not http.user_agent contains "UptimeRobot"
```

---

## Cost

**Cloudflare Rate Limiting Pricing:**
- **Free plan:** ❌ Not available
- **Pro plan ($20/month):** ✅ 10 rules included
- **Business plan ($200/month):** ✅ 25 rules included
- **Enterprise:** Unlimited

**Recommendation:** Start with Pro plan ($20/month) for Phase 5 launch.

---

## Alternative: Supabase Edge Functions (Free)

If Cloudflare is not in budget, implement rate limiting in a Supabase Edge Function:

**File:** `supabase/functions/rate-limit-proxy/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const rateLimit = new Map<string, { count: number; resetAt: number }>();

serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  const userId = authHeader ? extractUserId(authHeader) : req.headers.get('x-forwarded-for');
  
  const now = Date.now();
  const key = userId || 'anonymous';
  
  // Get or create rate limit entry
  let entry = rateLimit.get(key);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + 60000 }; // 1 minute window
    rateLimit.set(key, entry);
  }
  
  // Check limit
  if (entry.count >= 10) {
    return new Response('Rate limit exceeded', { status: 429 });
  }
  
  // Increment and proxy request
  entry.count++;
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  // Proxy to Supabase REST API
  const response = await fetch(req.url.replace('/rate-limit-proxy', '/rest'), {
    method: req.method,
    headers: req.headers,
    body: req.body
  });
  
  return response;
});

function extractUserId(authHeader: string): string | null {
  // Parse JWT and extract user ID
  const token = authHeader.replace('Bearer ', '');
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub;
  } catch {
    return null;
  }
}
```

**Trade-off:** More latency (extra hop), but free.

---

## Verification Checklist

- [ ] Rate limiting rule created in Cloudflare
- [ ] Test script confirms 429 after 10 requests
- [ ] Custom error page shows friendly message
- [ ] Monitoring dashboard shows blocked requests
- [ ] Alert set up for > 100 blocks in 5 min
- [ ] Admin IPs exempted (if needed)
- [ ] Documented in runbook

---

## Rollback Plan

If rate limiting causes issues:

1. **Temporarily disable rule:**
   - Cloudflare Dashboard → Security → WAF → Rate limiting rules
   - Toggle rule to "Disabled"

2. **Increase limits:**
   - Change from 10 req/min to 20 req/min
   - Monitor for 24 hours

3. **Remove rule entirely:**
   - Delete rule from Cloudflare
   - Document decision in `OBSERVATORY_SECURITY_LOG.md`

---

**Status:** Configuration-only change (no code deployment)  
**Estimated setup time:** 15 minutes  
**Cost:** $20/month (Cloudflare Pro) or free (Supabase Edge Function alternative)

*Last updated: December 18, 2025*
