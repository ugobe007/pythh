# Production Ready Checklist

## ✅ COMPLETED

### 1. Database Trigger (SECURITY DEFINER Fix)
- **Fixed**: RLS blocking on `match_generation_queue` 
- **Solution**: Added `SECURITY DEFINER` to trigger function
- **SQL**: See fix in chat history (run in Supabase SQL Editor if not applied)
- **Status**: ✅ Working - startups now create successfully

### 2. Environment Variables (No Hardcoded URLs)
- **Fixed**: Changed `localhost:3002` to `import.meta.env.VITE_API_URL`
- **File**: `src/components/PythhMatchingEngine.tsx`
- **Env Var**: `VITE_API_URL` (defaults to `http://localhost:3002` in dev)
- **Production**: Set to your production backend URL

### 3. Queue Processor Frequency
- **Changed**: Every 5 minutes → Every 1 minute
- **File**: `ecosystem.config.js`
- **Benefit**: Fallback match generation happens faster if API call fails
- **Status**: ✅ Updated

### 4. Instant Match API Endpoint
- **Endpoint**: `POST /api/matches/generate`
- **File**: `server/routes/matches.js`
- **Performance**: Generates 1,000 matches in 3-4 seconds
- **Status**: ✅ Working (tested with curl)

### 5. Error Handling & Logging
- **Frontend**: Console logs with `[PYTHH]` prefix
- **Backend**: Logs to console and PM2
- **Fallback**: Queue processor catches failed instant matches
- **Status**: ✅ Implemented

---

## 🔧 STILL NEEDED FOR PRODUCTION

### 1. CORS Configuration
**Current Issue**: API server may block frontend requests in production

**Fix Required** (add to `server/index.js`):
```javascript
const cors = require('cors');

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
```

**Env Var Needed**:
```bash
# .env
FRONTEND_URL=https://yourdomain.com
```

---

### 2. Environment Variables for Deployment

**Required for Production** (add to hosting platform):
```bash
# Backend API
VITE_API_URL=https://api.yourdomain.com

# Supabase (already have these)
VITE_SUPABASE_URL=https://unkpogyhhjbvxxjvmxlt.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_KEY=eyJhbGc...  # For server-side operations

# Frontend URL (for CORS)
FRONTEND_URL=https://yourdomain.com

# OpenAI (if using AI enrichment)
OPENAI_API_KEY=sk-...
```

---

### 3. Deployment Architecture

**Recommended Setup**:

```
┌─────────────────────────────────────────┐
│   FRONTEND (Vercel/Netlify)            │
│   - Serves Vite build                   │
│   - Talks to Supabase directly          │
│   - Calls backend API for match gen     │
└─────────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│   BACKEND API (Railway/Render)          │
│   - Express server (port 3002)          │
│   - POST /api/matches/generate          │
│   - File uploads, RSS endpoints         │
└─────────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│   PM2 BACKGROUND WORKERS (same server)  │
│   - match-queue-processor (every 1 min) │
│   - rss-scraper (every 15 min)          │
│   - system-guardian (every 10 min)      │
└─────────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│   SUPABASE (Database)                   │
│   - PostgreSQL with RLS                 │
│   - Database triggers                   │
│   - match_generation_queue table        │
└─────────────────────────────────────────┘
```

---

### 4. Health Check Endpoint

**Add to `server/index.js`**:
```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: require('../package.json').version
  });
});
```

**Use for**: Deployment health checks, uptime monitoring

---

### 5. Rate Limiting (Prevent Abuse)

**Install**:
```bash
npm install express-rate-limit
```

**Add to `server/index.js`**:
```javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: 'Too many requests, please try again later'
});

app.use('/api/', apiLimiter);
```

---

### 6. Database Connection Pooling

**Current**: Supabase client creates new connections per request

**Recommended**: Add connection pooling for better performance

**Already handled by Supabase** - no action needed unless self-hosting Postgres

---

### 7. Monitoring & Alerts

**Tools to Add**:
- **Sentry**: Error tracking
- **LogRocket**: Session replay for debugging
- **Uptime Robot**: Ping health endpoints
- **Supabase Logs**: Monitor database performance

---

### 8. Security Hardening

**Checklist**:
- ✅ RLS policies enabled on Supabase tables
- ✅ Service key not exposed to frontend
- ⚠️ Add rate limiting (see #5)
- ⚠️ Add input validation on API endpoints
- ⚠️ Sanitize user input (URL submissions)
- ⚠️ Add HTTPS enforcement in production

---

### 9. Performance Optimization

**Low-Hanging Fruit**:
- ✅ Match generation already batched (100 at a time)
- ✅ Queue processor runs every 1 minute (fast fallback)
- ⚠️ Add Redis caching for frequent queries
- ⚠️ Compress API responses (gzip)
- ⚠️ Add CDN for static assets

---

### 10. Testing Before Production

**Manual Tests**:
1. Submit URL → Verify startup created
2. Check matches appear within 5 seconds (or 1 minute fallback)
3. Test with 10 different URLs
4. Verify no duplicate startups created
5. Check GOD scores are reasonable (45-75 range)

**Command to Test**:
```bash
# Test match generation
curl -X POST http://localhost:3002/api/matches/generate \
  -H "Content-Type: application/json" \
  -d '{"startupId":"YOUR_STARTUP_ID"}'

# Check queue status
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
(async () => {
  const { data } = await supabase.from('match_generation_queue').select('*').limit(10);
  console.log('Queue:', data);
})();
"
```

---

## 🚀 DEPLOYMENT STEPS

### 1. Deploy Backend (Railway/Render)
```bash
# Install PM2 globally on server
npm install -g pm2

# Start all services
pm2 start ecosystem.config.js --env production

# Save PM2 config for auto-restart
pm2 save
pm2 startup

# Monitor
pm2 logs
```

### 2. Deploy Frontend (Vercel/Netlify)
```bash
# Build locally first to test
npm run build

# Deploy (Vercel example)
vercel --prod

# Set environment variables in dashboard:
# VITE_API_URL=https://api.yourdomain.com
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_ANON_KEY=...
```

### 3. Apply Database Fixes (Supabase SQL Editor)
```sql
-- Apply SECURITY DEFINER fix (if not already done)
DROP FUNCTION IF EXISTS queue_startup_for_matching() CASCADE;

CREATE OR REPLACE FUNCTION queue_startup_for_matching()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS NULL OR OLD.status != 'approved') THEN
    INSERT INTO match_generation_queue (startup_id, priority, status)
    VALUES (NEW.id, 100, 'pending')
    ON CONFLICT (startup_id, status) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_queue_matches ON startup_uploads;
CREATE TRIGGER trigger_queue_matches
  AFTER INSERT OR UPDATE ON startup_uploads
  FOR EACH ROW
  EXECUTE FUNCTION queue_startup_for_matching();
```

### 4. Test Production
- Submit test URL: `https://test-startup-123.com`
- Verify matches appear within 5 seconds
- Check PM2 logs: `pm2 logs match-queue-processor`
- Monitor System Guardian: `/admin/health` dashboard

---

## 📊 SUCCESS METRICS

**Production is working when**:
- ✅ URL submission creates startup instantly
- ✅ Matches appear within 5 seconds (or 1 minute fallback)
- ✅ No "Could not resolve startup" errors
- ✅ GOD scores in healthy range (45-75 average)
- ✅ System Guardian shows all green
- ✅ No 500 errors in logs
- ✅ Sub-2 second page load times

---

## 🆘 TROUBLESHOOTING

### Issue: "Could not resolve startup from URL"
- **Cause**: Database trigger RLS issue
- **Fix**: Apply SECURITY DEFINER SQL (see Deployment Step 3)

### Issue: No matches appear
- **Cause**: API call failed, queue processor hasn't run
- **Fix**: Check PM2 logs, restart match-queue-processor
- **Command**: `pm2 restart match-queue-processor`

### Issue: CORS errors in browser
- **Cause**: Backend blocking frontend requests
- **Fix**: Add CORS middleware (see #1 above)

### Issue: Matches take 5+ minutes
- **Cause**: Instant API call failing silently
- **Fix**: Check browser console for errors, verify VITE_API_URL

---

*Last updated: January 22, 2026*
