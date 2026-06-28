# DEBUG: Dashboard Showing 350,800 Matches But Table is Empty

## Current Situation
- `startup_investor_matches` table: **0 bytes** (data deleted/truncated)
- Indexes: **71 MB** (orphaned indexes from deleted data)
- Dashboard shows: **350,800 matches**
- User reports: **4.5M matches** exist

## Critical: Check Browser Console

**Open browser DevTools and run this in Console on the Matching Engine Admin page:**

```javascript
// 1. Check what Supabase URL the dashboard is using
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);

// 2. Check what the actual API returns
const { data, count, error } = await supabase
  .from('startup_investor_matches')
  .select('*', { count: 'exact', head: true });
console.log('Dashboard API Response:', { count, error, data });

// 3. Check if there's cached data
console.log('localStorage:', Object.keys(localStorage));
console.log('sessionStorage:', Object.keys(sessionStorage));

// 4. Try to fetch actual rows
const { data: rows, error: rowError } = await supabase
  .from('startup_investor_matches')
  .select('id, startup_id, investor_id, match_score')
  .limit(10);
console.log('Sample rows:', rows);
console.log('Row error:', rowError);
```

## Check Environment Variables

```bash
# Check .env file
cat .env | grep SUPABASE

# Should show:
# VITE_SUPABASE_URL=https://unkpogyhhjbvxxjvmxlt.supabase.co
# VITE_SUPABASE_ANON_KEY=...
```

## Possible Explanations

1. **Dashboard connected to different Supabase project**
   - Check `.env` file matches the project you're querying
   - Dashboard might be using production, SQL is using staging (or vice versa)

2. **Supabase API cache**
   - PostgREST might be returning cached count
   - Try: Hard refresh dashboard, check Network tab for actual API response

3. **Data in different location**
   - Check for materialized views
   - Check for partitions
   - Check different schema

4. **Table was recently truncated**
   - Check table history (deletes vs inserts)
   - Check if data needs to be restored from backup

## Immediate Actions

1. **Run browser console checks above** - This will show what dashboard actually sees
2. **Verify .env file** - Ensure dashboard connects to correct project
3. **Check Supabase project** - Confirm you're querying the same project URL
4. **Run comprehensive search** - Use `find_where_4_5m_matches_really_are.sql` to search all locations
