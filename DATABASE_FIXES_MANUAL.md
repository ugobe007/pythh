# 🔧 Apply Database Fixes - Manual Steps

## ✅ Already Fixed (No Action Needed)
1. ✅ `/api/scan` endpoint - Fixed `getSupabaseClient` error
2. ✅ Frontend queries - Already using 2-step fetch (no relationship embedding)
3. ✅ `DiscoveryResultsPage` - Already uses `PageShell` correctly
4. ✅ Frontend built and API server restarted

## 🎯 One Step Remaining: Add Foreign Key Constraints

**Why**: Ensures data integrity and enables PostgREST relationship queries (optional feature).

**How**: Copy-paste this SQL into your Supabase SQL Editor (Dashboard → SQL Editor → New Query):

```sql
-- Ensure foreign keys exist for startup_investor_matches
-- This enables PostgREST relationship embedding and prevents orphaned records

-- Add FK from matches to startup_uploads (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'startup_investor_matches_startup_id_fkey'
  ) THEN
    ALTER TABLE public.startup_investor_matches
      ADD CONSTRAINT startup_investor_matches_startup_id_fkey
      FOREIGN KEY (startup_id) 
      REFERENCES public.startup_uploads(id)
      ON DELETE CASCADE;
    
    RAISE NOTICE 'Added FK: startup_investor_matches.startup_id -> startup_uploads.id';
  ELSE
    RAISE NOTICE 'FK startup_investor_matches_startup_id_fkey already exists';
  END IF;
END $$;

-- Add FK from matches to investors (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'startup_investor_matches_investor_id_fkey'
  ) THEN
    ALTER TABLE public.startup_investor_matches
      ADD CONSTRAINT startup_investor_matches_investor_id_fkey
      FOREIGN KEY (investor_id) 
      REFERENCES public.investors(id)
      ON DELETE CASCADE;
    
    RAISE NOTICE 'Added FK: startup_investor_matches.investor_id -> investors.id';
  ELSE
    RAISE NOTICE 'FK startup_investor_matches_investor_id_fkey already exists';
  END IF;
END $$;

-- Force PostgREST to reload schema cache
-- This makes embedded relationships (.select('*, investors(*)')) work
NOTIFY pgrst, 'reload schema';

SELECT 'Foreign keys verified and PostgREST schema reloaded successfully!' AS status;
```

**Expected Output**:
```
NOTICE:  Added FK: startup_investor_matches.startup_id -> startup_uploads.id
NOTICE:  Added FK: startup_investor_matches.investor_id -> investors.id
status: "Foreign keys verified and PostgREST schema reloaded successfully!"
```

If you see "FK ... already exists", that's fine - it means the constraints are already there.

---

## 🧪 Test the Complete Flow

After running the SQL (or skipping if FKs already exist):

1. **Hard refresh browser**: `Cmd+Shift+R` (macOS) or `Ctrl+Shift+F5` (Windows)

2. **Submit a test URL**: Go to http://localhost:5173/ and submit any company URL
   - Example: `stripe.com` or `notion.so`

3. **Check console logs**:
   ```
   [FindMyInvestors] Calling /api/scan for: stripe.com
   [FindMyInvestors] Scan success: { startup_id: "...", match_count: 1000 }
   [PYTHH] Resolved startup ID: ...
   [PYTHH] matchRes: { dataLen: 50, error: null }
   ```

4. **Verify matches display**:
   - Should see investor cards with full data
   - Each card shows: confidence level, reasoning, "Why you match" bullets
   - No "Could not resolve startup" errors
   - No 400/409 errors in console

---

## 🎯 Expected System State

| Component | Status |
|-----------|--------|
| /api/scan endpoint | ✅ Working (tested with curl) |
| Frontend build | ✅ Built successfully |
| API server | ✅ Running (PM2 online) |
| Database migrations | ⏳ **Run FK SQL above** |
| 2-step fetch pattern | ✅ Already implemented |
| PageShell design | ✅ Already using correctly |

---

## 🚨 If Errors Occur

**"Could not resolve startup from URL"**:
- Check: Is /api/scan endpoint responding?
- Test: `curl -X POST http://localhost:3002/api/scan -H "Content-Type: application/json" -d '{"url":"example.com"}'`
- Should return: `{"startup_id":"...", "match_count":...}`

**"Could not find relationship ... in schema cache"**:
- This should NOT happen anymore (we use 2-step fetch)
- If it does: Run the FK SQL above
- Verify: Check `PythhMatchingEngine.tsx` lines 390-408 (should NOT use embedded `.select('*, investors(*)')`)

**Matches still showing "Scanning..." placeholders**:
- This is expected if matches haven't been generated yet
- Wait 60 seconds (queue processor runs every minute)
- Or check: `pm2 logs match-queue-processor --lines 20`

**409 Duplicate Key errors**:
- Should NOT happen anymore (unique constraint on `website` column added)
- If it does: Check duplicate entries in `startup_uploads` table

---

## 📊 Monitoring

**Check PM2 processes**:
```bash
pm2 status
pm2 logs api-server --lines 20
pm2 logs match-queue-processor --lines 20
```

**Check database**:
```sql
-- Verify FK constraints exist
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE conname LIKE 'startup_investor_matches%fkey';

-- Should show:
-- startup_investor_matches_startup_id_fkey | startup_investor_matches | startup_uploads
-- startup_investor_matches_investor_id_fkey | startup_investor_matches | investors
```

---

**Questions?** Check console logs first, then review the errors in this guide.
