# CORS Configuration Fix Required

## Issue
The production site `https://pythh.ai` is receiving CORS errors when making requests to Supabase:

```
Origin https://pythh.ai is not allowed by Access-Control-Allow-Origin. Status code: 520/522
```

## Root Cause
Supabase automatically allows CORS for the **Site URL** configured in Authentication settings. The Site URL must match your production domain.

## Fix Required (Supabase Dashboard)

### Step 1: Configure Site URL
1. Go to Supabase Dashboard → **Authentication** → **URL Configuration**
2. Under **Site URL**, set:
   - `https://pythh.ai`
3. Under **Redirect URLs**, add (if not already present):
   - `https://pythh.ai/**`
   - `https://www.pythh.ai/**` (if using www subdomain)
   - `https://pythh.ai/*` (wildcard pattern)
4. Click **Save**

### Step 2: Verify API Settings
1. Go to **Project Settings** → **API**
2. Verify your **Project URL** matches: `https://unkpogyhhjbvxxjvmxlt.supabase.co`
3. Check that **anon/public key** is correctly set in your environment variables

### Step 3: Check RLS Policies (if still failing)
If CORS errors persist after setting Site URL, check Row Level Security:
1. Go to **Authentication** → **Policies**
2. Ensure policies allow public access where needed (or use service role key for server-side)

## Alternative: Check Network/Proxy Issues

The 520/522 errors might also indicate:
- **520**: Cloudflare "Unknown Error" - Supabase instance might be down
- **522**: Cloudflare "Connection Timed Out" - Network issue between Cloudflare and Supabase

If these persist, check:
- Supabase project status page
- Network connectivity
- Cloudflare proxy settings (if using Cloudflare)

## Impact
- All Supabase REST API calls are failing
- RPC functions (`resolve_startup_by_url`, `get_platform_stats`, etc.) are blocked
- Frontend cannot fetch data from database
- Startup creation and matching are failing

## Status
**URGENT** - This is blocking all database operations on production.

## Verification
After updating Site URL, test by:
1. Opening browser console on `https://pythh.ai`
2. Run: `fetch('https://unkpogyhhjbvxxjvmxlt.supabase.co/rest/v1/startup_uploads?select=id&limit=1', { headers: { 'apikey': 'YOUR_ANON_KEY' } })`
3. Should return data without CORS error
