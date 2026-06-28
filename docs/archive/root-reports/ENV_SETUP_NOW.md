# ✅ Quick Fix - Run This Command

## One-Line Fix

**In your terminal, run:**

```bash
cat > /Users/leguplabs/Desktop/hot-honey/.env << 'ENVEOF'
VITE_SUPABASE_URL=https://unkpogyhhjbvxxjvmxlt.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVua3BvZ3loaGpidnh4anZteGx0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE1OTAzNSwiZXhwIjoyMDc2NzM1MDM1fQ.MYfYe8wDL1MYac1NHq2WkjFH27-eFUDi3Xn1hD5rLFA
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVua3BvZ3loaGpidnh4anZteGx0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE1OTAzNSwiZXhwIjoyMDc2NzM1MDM1fQ.MYfYe8wDL1MYac1NHq2WkjFH27-eFUDi3Xn1hD5rLFA
ENVEOF
```

**Or use the script:**
```bash
./ADD_TO_ENV.sh
```

## ⚠️ Important Note

The key you provided is a `service_role` key. For `VITE_SUPABASE_ANON_KEY`, you might need the **anon/public key** instead. 

If you get connection errors after restarting:
1. Go to: https://supabase.com/dashboard/project/unkpogyhhjbvxxjvmxlt/settings/api
2. Copy the **"anon public"** key (first key, shorter)
3. Update `.env` file: replace the `VITE_SUPABASE_ANON_KEY` value with the anon key

## Then Restart

```bash
npm run dev
```

The app should load now! 🎉

