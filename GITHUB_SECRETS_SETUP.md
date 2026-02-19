# GitHub Secrets Setup Guide

Go to: **https://github.com/ugobe007/pythh/settings/secrets/actions**

**CRITICAL:** The secret **Names** must match EXACTLY (case-sensitive, no typos):
- `SUPABASE_URL` (NOT ~~VITE_SUPABASE_URL~~)
- `SUPABASE_SERVICE_KEY`
- `SUPABASE_ANON_KEY` (NOT ~~VITE_SUPABASE_ANON_KEY~~)
- `OPENAI_API_KEY`

Click **"New repository secret"** and add each of these **4 secrets** exactly as shown below:

---

## Secret 1: SUPABASE_URL

**Name:**
```
SUPABASE_URL
```

**Value:**
```
https://unkpogyhhjbvxxjvmxlt.supabase.co
```

---

## Secret 2: SUPABASE_SERVICE_KEY

**Name:**
```
SUPABASE_SERVICE_KEY
```

**Value:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVua3BvZ3loaGpidnh4anZteGx0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE1OTAzNSwiZXhwIjoyMDc2NzM1MDM1fQ.MYfYe8wDL1MYac1NHq2WkjFH27-eFUDi3Xn1hD5rLFA
```

---

## Secret 3: SUPABASE_ANON_KEY

**Name:**
```
SUPABASE_ANON_KEY
```

**Value:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVua3BvZ3loaGpidnh4anZteGx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNTkwMzUsImV4cCI6MjA3NjczNTAzNX0.DdtBUf-liELSfKs2akrrHMcmlX4vHEkTuytWnvAYpJ8
```

---

## Secret 4: OPENAI_API_KEY

**Name:**
```
OPENAI_API_KEY
```

**Value:**
```
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
```

---

## Important Notes:

1. **Copy the entire value** - no spaces, no line breaks
2. **Name must match exactly** (case-sensitive)
3. **Don't include quotes** around the values
4. After adding all 4 secrets, re-run the workflow at:
   https://github.com/ugobe007/pythh/actions/workflows/god-score-recalculation.yml

## Verification:

After adding all 4 secrets, you should see **exactly these 4 items** listed (alphabetically):
- `OPENAI_API_KEY`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `SUPABASE_URL`

**Double-check the names match EXACTLY** - even one typo will cause the workflow to fail!

Then:
1. Go to: https://github.com/ugobe007/pythh/actions/workflows/god-score-recalculation.yml
2. Click **"Run workflow"** dropdown (top right, green button)
3. Select branch: **main**
4. Click **"Run workflow"** button
5. Watch the **"Verify Secrets"** step in the logs - it should show:
   ```
   ✅ All required secrets present
   ```
   If you see `❌ Required secrets are missing!`, check your secret names for typos.
