# .env File Setup 🔧

## Issue

The script can't find Supabase credentials. The `.env` file is loading but showing 0 variables.

## Solution

Make sure your `.env` file is in the project root (`/Users/leguplabs/Desktop/hot-honey/.env`) and has this format:

```bash
# Supabase (use one of these formats)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here

# OR alternative names
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# OpenAI (required for AI extraction)
OPENAI_API_KEY=sk-your-openai-key-here
```

## Important Notes

1. **No quotes** - Don't use quotes around values:
   - ✅ `VITE_SUPABASE_URL=https://...`
   - ❌ `VITE_SUPABASE_URL="https://..."`

2. **No spaces** around the `=` sign:
   - ✅ `KEY=value`
   - ❌ `KEY = value`

3. **Service Key, not Anon Key** - Use the `service_role` key, not the `anon` key

4. **File location** - Must be in project root, named exactly `.env`

## Quick Check

Run this to see if variables are loading:
```bash
node -e "require('dotenv').config(); console.log('URL:', process.env.VITE_SUPABASE_URL ? 'Found' : 'Missing'); console.log('Key:', process.env.SUPABASE_SERVICE_KEY ? 'Found' : 'Missing');"
```

## Alternative: Use SQL Directly

If you prefer, you can check what RSS articles exist first using SQL:

Run `check-rss-articles.sql` in Supabase SQL Editor to see:
- How many funding articles you have
- Sample articles
- Whether we have data to extract from

Then we can decide on the best approach! 🚀





