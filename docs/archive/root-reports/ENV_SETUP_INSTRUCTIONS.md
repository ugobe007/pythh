# Environment Variables Setup Guide

## Quick Fix for Blank Page Error

The app is showing a blank page because `VITE_SUPABASE_ANON_KEY` is missing.

## Step 1: Check Your .env File

Make sure you have a `.env` file in the project root (`/Users/leguplabs/Desktop/hot-honey/.env`)

## Step 2: Add Missing Variables

Your `.env` file should contain:

```bash
# Required - Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Optional - OpenAI (for AI research features)
VITE_OPENAI_API_KEY=your-openai-api-key-here

# Optional - Server-side (for Node.js scripts)
SUPABASE_SERVICE_KEY=your-service-role-key-here
```

## Step 3: Get Your Supabase Credentials

1. Go to your Supabase project dashboard
2. Click on **Settings** → **API**
3. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`
   - **service_role key** (for server scripts) → `SUPABASE_SERVICE_KEY`

## Step 4: Restart Dev Server

After updating `.env`:
```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

## Verification

After restarting, check the browser console. You should see:
- ✅ No "Missing Supabase" errors
- ✅ App loads normally

If you still see errors:
1. Verify `.env` file is in the project root (not in a subdirectory)
2. Make sure variable names start with `VITE_` (required for Vite)
3. No quotes around the values
4. No spaces around the `=` sign

## Format Example

**✅ CORRECT:**
```bash
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**❌ WRONG:**
```bash
VITE_SUPABASE_URL = "https://abcdefgh.supabase.co"  # Spaces and quotes
VITE_SUPABASE_ANON_KEY = "eyJ..."  # Spaces and quotes
```

## Troubleshooting

### Still Blank Page?
- Check browser console for specific errors
- Verify `.env` file exists in project root
- Restart the dev server completely
- Clear browser cache

### "Module not found" errors?
- Run `npm install` to ensure all dependencies are installed

### OpenAI errors (optional)?
- OpenAI key is optional - app should work without it
- Only needed for AI research features

