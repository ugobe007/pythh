# Create .env File - Quick Instructions

## ⚠️ Important: Use the ANON Key, Not Service Role

The key you provided is a `service_role` key. For the frontend, you need the **anon/public key**.

## Step 1: Get Your Anon Key

1. Go to: https://supabase.com/dashboard/project/unkpogyhhjbvxxjvmxlt/settings/api
2. Find the **"anon"** or **"public"** key (NOT the service_role key)
3. Copy that key

## Step 2: Create .env File

Run this command in your terminal:

```bash
cat > /Users/leguplabs/Desktop/hot-honey/.env << 'ENVEOF'
VITE_SUPABASE_URL=https://unkpogyhhjbvxxjvmxlt.supabase.co
VITE_SUPABASE_ANON_KEY=<PASTE-ANON-KEY-HERE>

# Server-side (for Node.js scripts):
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVua3BvZ3loaGpidnh4anZteGx0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE1OTAzNSwiZXhwIjoyMDc2NzM1MDM1fQ.MYfYe8wDL1MYac1NHq2WkjFH27-eFUDi3Xn1hD5rLFA

# Optional (for AI features):
# VITE_OPENAI_API_KEY=your-openai-key-here
ENVEOF
```

**Or manually create the file:**

1. In your project root (`/Users/leguplabs/Desktop/hot-honey/`)
2. Create a file named `.env` (with the dot at the start)
3. Add these lines (replace `<PASTE-ANON-KEY-HERE>` with your anon key):

```
VITE_SUPABASE_URL=https://unkpogyhhjbvxxjvmxlt.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key-from-supabase-dashboard>

SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVua3BvZ3loaGpidnh4anZteGx0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE1OTAzNSwiZXhwIjoyMDc2NzM1MDM1fQ.MYfYe8wDL1MYac1NHq2WkjFH27-eFUDi3Xn1hD5rLFA
```

## Step 3: Restart Dev Server

```bash
# Stop current server (Ctrl+C)
npm run dev
```

## Where to Find the Anon Key

1. Go to: https://supabase.com/dashboard/project/unkpogyhhjbvxxjvmxlt/settings/api
2. Look for **"Project API keys"**
3. Copy the **"anon public"** key (it's the first one, usually shorter)
4. **DO NOT** use the "service_role" key for `VITE_SUPABASE_ANON_KEY`

The service_role key should only be used for `SUPABASE_SERVICE_KEY` (server-side scripts).

