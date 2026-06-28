# 🔐 Admin Account Setup Guide

## Quick Start: Create Your Admin Account

### Step 1: Create Supabase Account

1. **Go to admin login page**
   ```
   http://localhost:5173/admin-login
   ```

2. **Choose an admin email** - Must contain "admin" or "ugobe":
   ```
   ✅ admin@pythh.ai
   ✅ admin@yourcompany.com
   ✅ robert@ugobeconsulting.com
   ✅ adminuser@gmail.com
   
   ❌ regular@pythh.ai (won't work - needs "admin" in email)
   ```

3. **Create account in Supabase**:
   - Open Supabase dashboard: https://supabase.com/dashboard/project/unkpogyhhjbvxxjvmxlt
   - Go to: **Authentication → Users**
   - Click: **Add User** → **Create new user**
   - Enter your admin email and password
   - Click: **Create User**

### Step 2: Verify Admin Account

1. **Go back to admin login**: `http://localhost:5173/admin-login`
2. **Enter your credentials**:
   - Email: admin@pythh.ai
   - Password: [your password]
3. **Sign In**

✅ **You're in!** You'll be redirected to `/admin/health`

---

## Alternative: Use Emergency Bypass

If you don't want to set up Supabase auth right now:

1. **Go to admin login**: `http://localhost:5173/admin-login`
2. **Click**: "Emergency Bypass (if rate limited)"
3. **Enter bypass key**: `pythh-admin-2026-emergency`
4. **Click**: "Use Bypass Key"

This gives you immediate access while you set up proper Supabase auth.

---

## Finding Admin Login Link

The admin login link is discreetly placed at the bottom of all public pages:

- **Main page** (`/`): Scroll to footer → "admin"
- **About page** (`/about`): Bottom footer → "admin"
- **Support page** (`/support`): Bottom footer → "admin"

Or directly visit: `http://localhost:5173/admin-login`

---

## Admin Email Rules

Your Supabase account email **must contain** one of these:
- `admin` (e.g., admin@pythh.ai, adminuser@gmail.com)
- `ugobe` (e.g., robert@ugobe.com, ugobe07@gmail.com)

**Or** be one of these specific emails:
- aabramson@comunicano.com
- ugobe07@gmail.com
- ugobe1@mac.com

The system checks this on login and rejects non-admin emails.

---

## Production Setup

### 1. Change the Bypass Key

Edit `.env`:
```bash
# Generate a strong random key
VITE_ADMIN_KEY=$(openssl rand -hex 32)
ADMIN_KEY=$(openssl rand -hex 32)
```

### 2. Configure Supabase Rate Limits

**Option A: Increase rate limits** (recommended for admin accounts)
1. Supabase Dashboard → Authentication → Rate Limits
2. Set: **50 attempts per hour** (instead of default 5)
3. Or add your IP to allowlist

**Option B: Disable rate limiting for admin** (run in Supabase SQL Editor)
```sql
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{bypass_rate_limit}',
  'true'::jsonb
)
WHERE email = 'admin@pythh.ai';
```

### 3. Enable Email Confirmations (Optional)

If you want email verification:
1. Supabase Dashboard → Authentication → Email Templates
2. Configure: Confirm signup template
3. Set redirect: `https://pythh.ai/admin/health`

---

## Troubleshooting

### "Not an admin account"
- ✅ Check email contains "admin" or "ugobe"
- ✅ Try: adminuser@pythh.ai instead of user@pythh.ai

### "Email rate limit exceeded"
- Wait 60 minutes for reset
- **OR** Use emergency bypass (click link on login page)
- **OR** Clear browser cookies: DevTools → Application → Clear site data
- **OR** Configure Supabase rate limits (see above)

### "Invalid bypass key"
- Check `.env` has: `VITE_ADMIN_KEY=pythh-admin-2026-emergency`
- Restart dev server: `npm run dev`
- Make sure no typos in key

### Can't find admin login link
- Direct URL: `http://localhost:5173/admin-login`
- Or scroll to bottom of main page → "admin"

### Bypass works but regular login doesn't
- Create Supabase account with admin email first
- Go to: Supabase Dashboard → Authentication → Users → Add User
- Use exact email that contains "admin" or "ugobe"

---

## What You Get

Once logged in as admin, you have access to:

✅ **System Health Dashboard** (`/admin/health`)
- Monitor scraper status, GOD scores, matches
- View system health metrics
- Check data freshness

✅ **Discovered Startups** (`/admin/discovered-startups`)
- Review 100 startups ready to import
- AI enrichment workflow
- GOD score calculation

✅ **GOD Score Management** (`/admin/god-scores`)
- View score distribution
- Adjust calibration settings
- Industry rankings

✅ **AI Intelligence** (`/admin/ai-intelligence`)
- Claude API usage
- Extraction quality metrics
- ML pipeline status

✅ **Control Center** (`/admin/control`)
- System overview
- Quick actions
- Health checks

✅ **All Admin Tools**
- Edit startups, bulk upload, RSS manager
- Scraper management, database diagnostics
- AI logs, settings, and more

---

## Security Notes

### Development
- ✅ Bypass key in `.env` is safe (not exposed to client)
- ✅ Works on localhost only
- ⚠️ Admin links are discreet but not hidden

### Production
- 🔒 Use strong random bypass key: `openssl rand -hex 32`
- 🔒 Rotate key every 90 days
- 🔒 Enable Supabase RLS policies
- 🔒 Add IP whitelist for admin routes
- 🔒 Use HTTPS only
- 🔒 Enable 2FA on Supabase accounts

---

## Quick Reference

| Method | URL | When to Use |
|--------|-----|-------------|
| **Regular Login** | `/admin-login` | Normal admin access |
| **Emergency Bypass** | `/admin-login` → "Emergency Bypass" | Rate limited or testing |
| **Direct Bypass** | `/admin-bypass?key=...` | Automated access |

**Current Bypass Key**: `pythh-admin-2026-emergency`

**Admin Test Accounts**:
- admin@pythh.ai
- adminuser@pythh.ai
- [your-name]admin@pythh.ai

---

## Next Steps

1. ✅ **Create admin account** in Supabase (email must contain "admin")
2. ✅ **Test login** at http://localhost:5173/admin-login
3. 📊 **Review 100 startups** ready to import
4. 🎯 **Apply score tracking migration** (20260213_add_score_tracking.sql)
5. 🔧 **Configure Supabase rate limits** (optional but recommended)

You're all set! 🚀
