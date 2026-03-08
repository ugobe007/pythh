# CORS Configuration Fix Required

## Issue
The production site `https://pythh.ai` is receiving CORS errors when making requests to Supabase:

```
Origin https://pythh.ai is not allowed by Access-Control-Allow-Origin. Status code: 520/522
```

## Root Cause
Supabase CORS settings need to include `https://pythh.ai` as an allowed origin.

## Fix Required (Supabase Dashboard)

1. Go to Supabase Dashboard → Project Settings → API
2. Under "CORS Settings" or "Allowed Origins", add:
   - `https://pythh.ai`
   - `https://www.pythh.ai` (if using www subdomain)
3. Save changes

## Alternative: Environment Variable Check

If using environment variables for CORS, ensure:
- `VITE_SUPABASE_URL` is correctly set
- Supabase project has the correct allowed origins configured

## Impact
- All Supabase REST API calls are failing
- RPC functions (`resolve_startup_by_url`, `get_platform_stats`, etc.) are blocked
- Frontend cannot fetch data from database
- Startup creation and matching are failing

## Status
**URGENT** - This is blocking all database operations on production.
