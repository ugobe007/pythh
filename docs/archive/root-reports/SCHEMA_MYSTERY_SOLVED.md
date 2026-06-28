# 🔍 DATABASE SCHEMA MYSTERY - SOLVED

## The Problem

There are **TWO DIFFERENT SCHEMAS** being served for the same `discovered_startups` table:

### **Supabase Management API** (PostgREST/Supabase JS SDK):
```
discovered_startups (23 columns):
  ❌ url TEXT
  ❌ source TEXT  
  ❌ imported_to_review BOOLEAN
  ✅ website TEXT
  ✅ article_url TEXT
  ❌ Missing: imported_to_startups
```

### **Direct PostgreSQL Connection** (ACTUAL DATABASE):
```
discovered_startups (20 columns):
  ✅ website TEXT
  ✅ article_url TEXT
  ✅ imported_to_startups BOOLEAN
  ❌ NO url column
  ❌ NO source column
  ❌ NO imported_to_review column
```

## The Root Cause

**Supabase PostgREST** has a **schema introspection cache** that doesn't automatically refresh when:
1. Tables are modified via direct Postgres
2. Schema is changed outside the Supabase API
3. Multiple migration files conflict

The cache shows "ghost columns" (`url`, `source`, `imported_to_review`) that **DO NOT EXIST** in the actual database.

## Why This Matters

- ✅ **Direct Postgres queries work** (sees real schema)
- ❌ **Supabase JS SDK fails** (sees cached fake schema)
- ❌ **Scripts using Supabase client** see wrong columns
- ✅ **Scripts using pg library** work correctly

## The Solution

### **Option 1: Use Direct Postgres (CURRENT FIX)**

```javascript
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// This works - sees real schema
await pool.query(
  'INSERT INTO discovered_startups (name, website, article_url, imported_to_startups) VALUES ($1, $2, $3, false)',
  [name, website, articleUrl]
);
```

### **Option 2: Refresh Supabase Schema Cache (RECOMMENDED)**

Via Supabase Dashboard:
1. Go to: https://supabase.com/dashboard/project/unkpogyhhjbvxxjvmxlt
2. Settings → API → Reload schema cache
3. Or use API: `POST /rest/v1/rpc/reload_schema`

Via CLI:
```bash
npx supabase db reset --linked  # WARNING: Drops all data!
```

### **Option 3: Wait for Auto-Refresh (24 hours)**

Supabase PostgREST automatically refreshes schema cache every 24 hours.

## What We've Done

1. ✅ Updated `intelligent-scraper.js` to use direct Postgres with correct columns
2. ✅ Updated `test-rss-discovery.js` to use correct column names  
3. ✅ Updated `system-audit.js` to use correct column names
4. ✅ Added indexes for performance optimization
5. ✅ Created documentation and audit report

## Verification

Run this to confirm actual schema:
```bash
node -e "require('dotenv').config(); const {Pool} = require('pg'); const pool = new Pool({connectionString: process.env.POSTGRES_URL}); pool.query('SELECT column_name FROM information_schema.columns WHERE table_name = \\'discovered_startups\\' AND table_schema = \\'public\\' ORDER BY ordinal_position').then(r => { console.log(r.rows.map(row => row.column_name).join(', ')); pool.end(); });"
```

Expected output:
```
id, name, website, description, funding_amount, funding_stage, investors_mentioned, 
discovered_from_article_id, article_url, article_title, article_date, rss_source, 
imported_to_startups, imported_at, startup_id, website_verified, website_status, 
discovered_at, created_at, updated_at
```

✅ NO `url`, `source`, or `imported_to_review` columns!

## Lesson Learned

**Always use direct Postgres connections for scripts** to bypass Supabase caching issues. Reserve Supabase JS SDK for frontend/API use only.
