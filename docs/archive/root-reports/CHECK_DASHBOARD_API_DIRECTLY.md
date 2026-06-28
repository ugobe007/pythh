# Check Dashboard API Response Directly

## Browser Console Method (Correct Syntax)

The `supabase` client isn't globally available. Use this instead:

**1. Open Matching Engine Admin page in browser**
**2. Open DevTools Console (F12)**
**3. Paste this code:**

```javascript
// Import supabase client from the page
// First, let's see what's available
console.log('Checking window objects...');
console.log('Window keys:', Object.keys(window).filter(k => k.includes('supabase') || k.includes('Supabase')));

// Try to access supabase from React component
// The page should expose it via window for debugging, or we can check localStorage/cache
```

**Better approach - Check Network Tab:**
1. Open DevTools → **Network** tab
2. Filter by: `startup_investor_matches`
3. Reload Matching Engine Admin page
4. Look for the API request to `/rest/v1/startup_investor_matches`
5. Check the **Response** - what does `count` show?
6. Check the **Request Headers** - what Supabase URL is it hitting?

## Or Check localStorage/SessionStorage

```javascript
// Check for cached counts
console.log('localStorage:', {...localStorage});
console.log('sessionStorage:', {...sessionStorage});

// Look for any keys containing "match" or "count" or "350800"
Object.keys(localStorage).forEach(k => {
  if (k.toLowerCase().includes('match') || k.toLowerCase().includes('count')) {
    console.log(k, ':', localStorage.getItem(k));
  }
});
```

## Most Likely Scenario

The dashboard is showing **cached data** because:
- Table is **0 rows** (confirmed by exhaustive search)
- Dashboard shows **350,800** (must be cached/stale)
- Indexes are **71 MB** (proves data existed before)

## Action Required

**The 4.5M matches need to be regenerated!** The data was deleted. Options:

1. **Restore from backup** (if you have one)
2. **Re-run queue processor** - It will regenerate matches:
   ```bash
   node scripts/core/queue-processor-v16.js
   ```
3. **Check Supabase backups** - Go to Supabase dashboard → Backups
4. **Clear dashboard cache** - Hard refresh (Cmd+Shift+R) or clear browser cache
