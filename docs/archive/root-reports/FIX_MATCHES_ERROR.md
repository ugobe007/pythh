# Fixed "Failed to load matches" Error

## What I Changed

Improved error handling in `MatchingEngine.tsx` to provide more specific error messages:

1. **Supabase Credential Check**: Now checks if credentials are configured before attempting queries
2. **Better Error Messages**: 
   - JWT/auth errors → "Authentication error. Check your Supabase credentials"
   - Missing table → "Database table not found. Please ensure migrations are run"
   - Permission errors → "Permission denied. Check Supabase Row Level Security"
   - No matches → Checks total match count and provides helpful guidance

3. **Diagnostic Information**: When no matches are found, it now checks if ANY matches exist (with any status) to help diagnose the issue

## Most Likely Causes

Based on the error message you see, here's what to check:

### 1. **"Supabase credentials not configured"**
   - **Fix**: Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your `.env` file
   - **Restart**: Restart your dev server after adding credentials

### 2. **"Authentication error"**
   - **Fix**: The anon key might be wrong. Get the **anon/public** key from Supabase Dashboard (not service_role)
   - **Location**: https://supabase.com/dashboard/project/unkpogyhhjbvxxjvmxlt/settings/api

### 3. **"No matches found in database"**
   - **Fix**: The queue processor needs to run to generate matches
   - **Check**: Go to `/admin/dashboard` and check queue processor status
   - **Run**: You may need to manually trigger match generation

### 4. **"Permission denied"**
   - **Fix**: Check Supabase Row Level Security (RLS) policies
   - **Tables**: Ensure `startup_investor_matches`, `startup_uploads`, and `investors` tables have proper RLS policies

## Quick Diagnostic

Open your browser console (F12) and look for:
- `❌ Error fetching match IDs:` - Shows the actual Supabase error
- `⚠️ No matches found` - Indicates matches don't exist
- `✅ Loaded X pre-calculated matches` - Success!

## Next Steps

1. **Check the console** for the specific error message
2. **Verify .env file** has correct credentials (especially the anon key)
3. **Restart dev server** after updating .env
4. **Check if matches exist** in Supabase Dashboard → Table Editor → `startup_investor_matches`

The improved error messages should now tell you exactly what's wrong!

