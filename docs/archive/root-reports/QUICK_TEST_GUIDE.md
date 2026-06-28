# Quick Test Guide for Match Search 🧪

## Step 1: Start the Servers

### Terminal 1: Backend Server
```bash
cd /Users/leguplabs/Desktop/hot-honey
node server/index.js
```

You should see:
```
Server running on port 3002
```

### Terminal 2: Frontend Dev Server
```bash
cd /Users/leguplabs/Desktop/hot-honey
npm run dev
```

You should see:
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

---

## Step 2: Get Test IDs

### Option A: Use Admin Dashboard
1. Go to `http://localhost:5173/admin/edit-startups`
2. Find an approved startup
3. Copy the startup ID from the URL or table
4. Go to `http://localhost:5173/investors`
5. Find an investor
6. Copy the investor ID

### Option B: Use Database Query
```sql
-- Get a startup with matches
SELECT id, name 
FROM startup_uploads 
WHERE status = 'approved' 
AND id IN (SELECT DISTINCT startup_id FROM startup_investor_matches)
LIMIT 1;

-- Get an investor with matches
SELECT id, name 
FROM investors 
WHERE id IN (SELECT DISTINCT investor_id FROM startup_investor_matches)
LIMIT 1;
```

---

## Step 3: Test Startup Match Search

1. Navigate to: `http://localhost:5173/startup/{startupId}/matches`
   - Replace `{startupId}` with your test startup ID

2. **What to Check:**
   - ✅ Page loads without errors
   - ✅ Stats cards show numbers
   - ✅ Match cards appear (if matches exist)
   - ✅ Search bar works
   - ✅ Filters work
   - ✅ Click a match card → modal opens
   - ✅ Export button works

3. **Test Smart Filtering:**
   - Look for the blue notice banner
   - Click "Show all matches" if it appears
   - Verify filtered count vs total count

---

## Step 4: Test Investor Match Search

1. Navigate to: `http://localhost:5173/investor/{investorId}/matches`
   - Replace `{investorId}` with your test investor ID

2. **What to Check:**
   - ✅ Page loads without errors
   - ✅ Stats cards show numbers
   - ✅ Match cards appear (if matches exist)
   - ✅ Search bar works
   - ✅ Filters work (especially GOD score range)
   - ✅ Click a match card → modal opens
   - ✅ Export button works

---

## Step 5: Test API Directly (Optional)

### Test Startup Matches API
```bash
# Replace {startupId} with actual ID
curl "http://localhost:3002/api/matches/startup/{startupId}?limit=5"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "matches": [...],
    "total": 50,
    "filtered_total": 12,
    "limit_applied": true
  }
}
```

### Test Startup Stats API
```bash
curl "http://localhost:3002/api/matches/startup/{startupId}/stats"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "total": 50,
    "highConfidence": 5,
    "mediumConfidence": 30,
    "lowConfidence": 15,
    "averageScore": 55.5,
    "topSectors": [...],
    "topInvestorTiers": [...]
  }
}
```

---

## Common Issues & Quick Fixes

### ❌ "Cannot connect to API"
**Fix:** Make sure backend server is running on port 3002

### ❌ "supabaseUrl is required"
**Fix:** Check `.env` file has `VITE_SUPABASE_URL` set

### ❌ "No matches found" but matches exist
**Fix:** 
- Check startup/investor ID is correct
- Try `showAll=true` in URL: `/startup/{id}/matches?showAll=true`
- Check database has matches for that ID

### ❌ Page shows blank/error
**Fix:**
- Check browser console for errors
- Check network tab for failed API calls
- Verify API_BASE is correct in `src/lib/apiConfig.ts`

### ❌ "Module not found" errors
**Fix:**
- Run `npm install` to ensure dependencies are installed
- Check that TypeScript services are compiled (if needed)

---

## Quick Verification Checklist

- [ ] Backend server running (port 3002)
- [ ] Frontend server running (port 5173)
- [ ] No console errors in browser
- [ ] API endpoints return data
- [ ] Match search pages load
- [ ] Filters work
- [ ] Search works
- [ ] Export works
- [ ] Error handling works (test with invalid ID)

---

## Next: Report Issues

If you find any issues:
1. Note the exact error message
2. Check browser console
3. Check network tab
4. Note which test case failed
5. Report with steps to reproduce

---

Ready to test! 🚀





