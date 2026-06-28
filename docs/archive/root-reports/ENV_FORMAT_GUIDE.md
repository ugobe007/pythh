# ✅ .env File Format Guide

## **Correct Format:**

Your `.env` file should look exactly like this:

```bash
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4eHh4eHh4eHh4eHh4eHgiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjg4ODg4ODg4LCJleHAiOjE5MDQ0NjQ4ODh9.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## **Common Mistakes:**

❌ **WRONG - Spaces around equals:**
```bash
VITE_SUPABASE_URL = https://xxx.supabase.co
```

❌ **WRONG - Quotes around values:**
```bash
VITE_SUPABASE_URL="https://xxx.supabase.co"
```

❌ **WRONG - Missing one variable:**
```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
# Missing SUPABASE_SERVICE_KEY
```

✅ **CORRECT - No spaces, no quotes:**
```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## **Alternative Variable Names:**

You can also use these names:

```bash
# Option 1:
VITE_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx...

# Option 2:
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
```

## **Verify Your .env File:**

Run this command to check:
```bash
node check-env.js
```

## **Test ML Training:**

Once verified, run:
```bash
node run-ml-training.js
```

---

**Make sure:**
1. ✅ File is named `.env` (not `.env.txt`)
2. ✅ No spaces around `=`
3. ✅ No quotes around values
4. ✅ Both URL and KEY are present
5. ✅ File is in project root (`/Users/leguplabs/Desktop/hot-honey/.env`)

