# Database Connection Testing Guide

## Overview
This guide helps you test database connections across all pages to ensure everything is working correctly.

## Pages to Test

### 1. SignalResultsPage (`/signals?url=...`)
**Test URLs:**
- Valid startup URL: `https://example.com` (replace with real startup URL from your database)
- Invalid URL: `https://nonexistent-startup-12345.com`
- Empty URL: `/signals` (no url param)

**Expected Behavior:**
- ✅ Valid URL: Shows 5 investor signals with real data
- ✅ Invalid URL: Shows "No signals found" message
- ✅ Loading state: Shows progress bar during fetch
- ✅ Stats banner: Shows real counts (total investors, top score, stage, avg check)

**Check:**
- [ ] Signals load from database
- [ ] Stats are calculated correctly
- [ ] Error handling works for invalid URLs
- [ ] Loading states display properly

---

### 2. Live Page (`/live`)
**Test:**
- Navigate to `/live`
- Wait for signals to load
- Check auto-refresh (should refresh every 30 seconds)

**Expected Behavior:**
- ✅ Shows real-time signals from `/api/live-signals` endpoint
- ✅ Signals update every 30 seconds
- ✅ Loading state shows while fetching
- ✅ Error state shows if API fails
- ✅ Empty state shows if no signals available

**Check:**
- [ ] Signals load from API
- [ ] Auto-refresh works
- [ ] Loading/error/empty states work
- [ ] Correlation (high/mid/low) is calculated correctly

---

### 3. SignalPlaybook (`/app/playbook`)
**Test:**
- Navigate to `/app/playbook`
- Test with startup ID in URL: `/app/playbook?startup=UUID`
- Test without startup ID (should use user's startup or show demo)

**Expected Behavior:**
- ✅ Loads matches from database
- ✅ Shows real investor data (name, firm, match score)
- ✅ Timing is calculated from investor data
- ✅ Approach strategies use real portfolio companies
- ✅ Falls back to demo data if no matches

**Check:**
- [ ] Playbooks load from database
- [ ] Investor details are real (not mock)
- [ ] Timing calculations work
- [ ] Filter (all/now/soon/later) works
- [ ] Expand/collapse works

---

### 4. FundraisingTimingMap (`/app/timing-map`)
**Test:**
- Navigate to `/app/timing-map`
- Test with startup ID: `/app/timing-map?startup=UUID`
- Test without startup ID

**Expected Behavior:**
- ✅ Loads startup data from database
- ✅ Shows real readiness metrics
- ✅ Market signals from `startup_signals` table
- ✅ Phases calculated from readiness and window
- ✅ Weekly cadence based on current phase

**Check:**
- [ ] Timing map loads from database
- [ ] Readiness metrics are real
- [ ] Market signals show real data
- [ ] Phases are calculated correctly
- [ ] Tabs (timeline/signals/readiness/cadence) work

---

### 5. PythhMain (Home Page) (`/`)
**Test:**
- Navigate to home page
- Check investor signals table
- Check sector heat

**Expected Behavior:**
- ✅ Investor signals load from database
- ✅ Falls back to static data if query fails
- ✅ Sector heat loads from `get_sector_heat` RPC
- ✅ Error logging shows detailed errors

**Check:**
- [ ] Investor signals table shows real data
- [ ] Sector heat shows real data
- [ ] Error logging works (check console)
- [ ] Fallback to static data works if needed

---

## Edge Cases to Test

### 1. No Database Connection
**Test:** Disconnect from internet or block Supabase
- [ ] Pages show appropriate error messages
- [ ] No crashes or infinite loading
- [ ] Fallback data shows where appropriate

### 2. Empty Database
**Test:** With no matches or startups
- [ ] Pages show empty states
- [ ] No errors thrown
- [ ] User-friendly messages displayed

### 3. Slow Database
**Test:** Simulate slow network (Chrome DevTools → Network → Slow 3G)
- [ ] Loading states show properly
- [ ] Timeouts handled gracefully
- [ ] No race conditions

### 4. Invalid Data
**Test:** With malformed data in database
- [ ] Pages handle null/undefined values
- [ ] Type errors don't crash pages
- [ ] Default values used where appropriate

---

## Monitoring Checklist

### Error Logging
- [ ] Check browser console for errors
- [ ] Check `ai_logs` table for database errors
- [ ] Verify error messages are descriptive

### Performance
- [ ] Page load times are reasonable (< 2s)
- [ ] Database queries complete quickly
- [ ] No N+1 query problems

### Data Accuracy
- [ ] Data matches what's in database
- [ ] Calculations are correct
- [ ] No stale data shown

---

## Quick Test Script

Run these commands to quickly test database connections:

```bash
# Test SignalResultsPage
curl "http://localhost:5173/signals?url=example.com"

# Test Live API
curl "http://localhost:3002/api/live-signals?limit=5"

# Test database connection
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);
supabase.from('startup_investor_matches').select('id').limit(1)
  .then(({ data, error }) => {
    console.log(error ? '❌ Error:' : '✅ Connected');
    if (error) console.error(error);
  });
"
```

---

## Common Issues & Solutions

### Issue: "Failed to fetch" errors
**Solution:** Check:
1. Server is running on port 3002
2. CORS is configured correctly
3. API endpoints are accessible

### Issue: "No signals found"
**Solution:** Check:
1. Database has matches for the startup
2. Match scores are >= 50 (SignalResultsPage) or >= 80 (Live)
3. Startup exists in `startup_uploads` table

### Issue: "Database connection failed"
**Solution:** Check:
1. `.env` file has correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
2. Supabase project is active
3. Network connectivity

---

## Automated Testing

To set up automated testing, you can use:

```typescript
// Example test using Playwright or Cypress
test('SignalResultsPage loads data from database', async ({ page }) => {
  await page.goto('/signals?url=example.com');
  await page.waitForSelector('[data-testid="signal-card"]', { timeout: 10000 });
  const signals = await page.$$('[data-testid="signal-card"]');
  expect(signals.length).toBeGreaterThan(0);
});
```

---

## Monitoring Dashboard

Check these regularly:
1. **Browser Console**: Look for database errors
2. **Network Tab**: Check API response times
3. **Supabase Dashboard**: Monitor query performance
4. **Error Logs**: Check `ai_logs` table for errors

---

## Last Updated
Date: 2026-01-XX
Pages Connected: SignalResultsPage, Live, SignalPlaybook, FundraisingTimingMap, PythhMain
