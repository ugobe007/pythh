# ⚙️ Environment Variables Setup

## **Problem**

Your `.env` file exists but is empty or missing required variables. This causes all scripts to fail with `Error: supabaseUrl is required.`

---

## **Solution: Add These Variables to `.env`**

Create or edit `.env` in the project root with:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here

# Optional (if using different variable names)
# SUPABASE_URL=https://your-project-id.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## **How to Find Your Supabase Credentials**

1. **Go to Supabase Dashboard:** https://app.supabase.com
2. **Select your project**
3. **Go to Settings → API**
4. **Copy:**
   - **Project URL** → Use as `VITE_SUPABASE_URL`
   - **service_role key** (secret) → Use as `SUPABASE_SERVICE_KEY`

---

## **Verify Setup**

After adding variables, test:

```bash
# Quick test
node -e "require('dotenv').config(); const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY; console.log('URL:', url ? '✅' : '❌'); console.log('KEY:', key ? '✅' : '❌');"
```

You should see:
```
✅ ✅
```

---

## **Example `.env` File**

```bash
# Supabase
VITE_SUPABASE_URL=https://unkpogyhhjbvxxjvmxlt.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional: Other services
GETLATE_API_KEY=sk_...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

---

## **After Setup**

Once `.env` is configured, all commands will work:

```bash
# Test social signals
node scripts/enrichment/social-signals-scraper.js 1

# Run pipeline
npm run pipeline

# Individual scripts
npm run scrape
npm run score
npm run match
npm run enrich
```

---

## **Security Note**

⚠️ **NEVER commit `.env` to git!** It should be in `.gitignore`.

Your `.env` file contains sensitive credentials - keep it private.

