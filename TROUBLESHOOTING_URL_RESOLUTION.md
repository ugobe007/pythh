# 🔍 Troubleshooting "Could not resolve startup from URL"

## Quick Diagnostic Checklist

### 1. Check Backend Server Status
```bash
pm2 status
```

**Expected:** `api-server` should be **online**

**If stopped:**
```bash
pm2 restart api-server
```

---

### 2. Test AI Enrichment Endpoint Directly

```bash
curl -X POST http://localhost:3002/api/startup/enrich-url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://spatial-ai.com"}'
```

**Expected Response:**
```json
{
  "godScore": 65,
  "tier": "strong",
  "inference": {
    "sectors": ["AI/ML", "SaaS"],
    "has_revenue": true,
    ...
  }
}
```

**If it fails:**
- Check API server logs: `pm2 logs api-server --lines 50`
- Check OpenAI API key in .env: `OPENAI_API_KEY`
- Restart server: `pm2 restart api-server`

---

### 3. Check Frontend Build

```bash
npm run build
```

**Expected:** Should complete without errors

**If build fails:** Fix any TypeScript/ESLint errors

---

### 4. Check Browser Console

Open DevTools → Console tab and submit a URL.

**Look for:**
```
[startupResolver] Resolving URL: https://example.com
[startupResolver] Backend URL: http://localhost:3002
[startupResolver] Running inference engine FIRST for: https://example.com
```

**Common errors and fixes:**

| Error | Cause | Fix |
|-------|-------|-----|
| `Backend URL: undefined` | VITE_BACKEND_URL not set | Add to .env: `VITE_BACKEND_URL=http://localhost:3002` |
| `Failed to fetch` | Backend not running | `pm2 restart api-server` |
| `500 Internal Server Error` | AI enrichment failed | Check OpenAI API key |
| `404 Not Found` | Route doesn't exist | Check server/routes/startup.js has /enrich-url |

---

### 5. Test Complete Flow

**In browser:**
1. Navigate to: http://localhost:5175/ (or your dev server port)
2. Go to "Find My Investors" page
3. Submit URL: `https://spatial-ai.com`
4. Open DevTools Console
5. Watch for logs starting with `[startupResolver]` and `[DiscoveryResults]`

**Expected flow:**
```
[startupResolver] Resolving URL: https://spatial-ai.com
[startupResolver] Backend URL: http://localhost:3002
[startupResolver] Step 1: Trying LinkedIn exact match
[startupResolver] Step 2: Trying Crunchbase exact match
[startupResolver] Step 3: Trying domain match for: spatial-ai.com
[startupResolver] Step 4: Trying legacy website matching
[startupResolver] Running inference engine FIRST
[startupResolver] ✅ Inference complete: 65 (Tier strong)
[startupResolver] Created startup with GOD score: 65
[startupResolver] Triggering INSTANT match generation
[DiscoveryResults] Resolved startup: 697d7775-... Confidence: exact_domain
```

---

### 6. Common Issues & Solutions

#### Issue: "Could not analyze this URL"

**Cause 1:** Backend server not running
```bash
pm2 restart api-server
```

**Cause 2:** Invalid URL format
- Try with `https://` prefix
- Check domain is accessible (not localhost, not private)

**Cause 3:** AI enrichment endpoint failing
```bash
# Check logs
pm2 logs api-server --lines 100 | grep enrich

# Test directly
curl http://localhost:3002/api/startup/enrich-url \
  -d '{"url":"https://example.com"}'
```

#### Issue: "URL resolves but no matches appear"

**Check match generation:**
```bash
# Check instant matching logs
pm2 logs api-server --lines 50 | grep "INSTANT MATCH"

# Test instant matching
curl -X POST http://localhost:3002/api/matches/generate \
  -H "Content-Type: application/json" \
  -d '{"startupId":"<your-startup-id>"}'
```

#### Issue: "Matches take 5+ minutes to appear"

**This means instant matching isn't firing.** Check:
1. startupResolver.ts is calling `/api/matches/generate`
2. Backend route exists: `server/routes/matches.js` POST /generate
3. Frontend was rebuilt after changes: `npm run build`

---

### 7. Enable Debug Mode

Add this to your `.env`:
```bash
VITE_DEBUG=true
```

Rebuild:
```bash
npm run build
```

This will show ALL console.log statements in the browser.

---

### 8. Check Database

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
supabase.from('startup_uploads').select('id,name,website,total_god_score').eq('website','https://spatial-ai.com').then(r => console.log(r.data));
"
```

**Expected:** Should show spatial-ai startup

---

### 9. Full System Test

```bash
# 1. Stop all PM2 processes
pm2 stop all

# 2. Restart API server
pm2 start ecosystem.config.js --only api-server

# 3. Check status
pm2 status

# 4. Rebuild frontend
npm run build

# 5. Start dev server
npm run dev

# 6. Test in browser
# Navigate to: http://localhost:5173/find-my-investors
# Submit URL and watch console
```

---

## What to Send for Support

If issue persists, provide:

1. **PM2 Status:**
   ```bash
   pm2 status
   ```

2. **API Server Logs:**
   ```bash
   pm2 logs api-server --lines 100
   ```

3. **Browser Console Screenshot:**
   - DevTools → Console
   - Submit a URL
   - Screenshot the entire console output

4. **Test Results:**
   ```bash
   # Test AI enrichment
   curl -X POST http://localhost:3002/api/startup/enrich-url \
     -H "Content-Type: application/json" \
     -d '{"url":"https://spatial-ai.com"}' | jq .
   
   # Test instant matching
   curl -X POST http://localhost:3002/api/matches/generate \
     -H "Content-Type: application/json" \
     -d '{"startupId":"697d7775-8c3c-43a9-9b3b-927cf99d88cb"}' | jq .
   ```

5. **Environment Check:**
   ```bash
   grep VITE_BACKEND_URL .env
   grep OPENAI_API_KEY .env | head -c 40
   ```

---

## Most Common Fix

**90% of the time, the issue is:**

1. Backend server not running → `pm2 restart api-server`
2. Frontend not rebuilt → `npm run build`
3. Wrong port (dev server moved to 5175) → Check browser URL

**Quick fix:**
```bash
pm2 restart api-server && npm run build && echo "✅ Fixed!"
```
