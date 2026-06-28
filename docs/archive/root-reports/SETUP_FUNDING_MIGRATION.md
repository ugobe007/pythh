# Setup Funding Data Migration 🔧

## Issue: Missing Supabase Credentials

The scripts need Supabase credentials to connect to your database.

## Solution: Add to .env File

Add these variables to your `.env` file:

```bash
# Supabase URL (use one of these)
VITE_SUPABASE_URL=https://your-project.supabase.co
# OR
SUPABASE_URL=https://your-project.supabase.co

# Supabase Service Key (use one of these)
SUPABASE_SERVICE_KEY=your-service-role-key-here
# OR
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## Where to Find These Values

1. **Supabase URL:**
   - Go to your Supabase project dashboard
   - Settings → API
   - Copy the "Project URL"

2. **Service Role Key:**
   - Same page (Settings → API)
   - Copy the "service_role" key (NOT the anon key)
   - ⚠️ This key has admin privileges - keep it secret!

## After Adding Credentials

1. **Check what funding data exists:**
   ```bash
   node check-funding-data.js
   ```

2. **Migrate funding data:**
   ```bash
   node migrate-funding-data-to-rounds.js
   ```

## Alternative: Run SQL Directly

If you prefer to check the data manually in Supabase SQL Editor:

```sql
-- Check funding_data table
SELECT COUNT(*) FROM funding_data;
SELECT * FROM funding_data LIMIT 5;

-- Check funding_rounds table
SELECT COUNT(*) FROM funding_rounds;
```

Then you can manually migrate or use the script once credentials are set up.





