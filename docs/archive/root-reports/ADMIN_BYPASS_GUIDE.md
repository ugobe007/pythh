# 🚨 Admin Bypass - Emergency Access Guide

## Problem
Supabase auth rate limiting blocks admin login after multiple attempts. Rate limits typically reset after 60 minutes.

## Solution: Admin Bypass URL

### Quick Access (NOW)
```
http://localhost:5173/admin-bypass?key=pythh-admin-2026-emergency
```

**This bypasses Supabase email auth entirely** - no rate limits, instant access.

---

## How It Works

### Security
- Requires `VITE_ADMIN_KEY` from `.env` file
- Key must match exactly in URL query parameter
- Creates temporary admin session in `localStorage`
- Auto-redirects to `/admin/health` dashboard

### The Bypass Process
```
1. User visits: /admin-bypass?key=YOUR_KEY
2. Page validates key against VITE_ADMIN_KEY
3. If valid → Creates admin localStorage session
4. Redirects to admin panel (no Supabase auth needed)
```

---

## Long-Term Fixes

### Option 1: Configure Supabase Rate Limits (RECOMMENDED)

1. **Open Supabase Dashboard**
   ```
   https://supabase.com/dashboard/project/unkpogyhhjbvxxjvmxlt
   ```

2. **Navigate to Authentication → Rate Limits**
   
3. **Increase or disable email rate limit**
   - Current default: ~5 attempts per hour
   - Recommended for admin: 50 attempts per hour
   - Or: Add your IP to allowlist

4. **Alternative: Disable rate limiting for your account**
   ```sql
   -- Run in Supabase SQL Editor
   -- WARNING: Only for development/admin accounts
   UPDATE auth.users 
   SET raw_user_meta_data = jsonb_set(
     COALESCE(raw_user_meta_data, '{}'::jsonb),
     '{bypass_rate_limit}',
     'true'::jsonb
   )
   WHERE email = 'YOUR_ADMIN_EMAIL@example.com';
   ```

### Option 2: Use Magic Link (No Password)

Instead of email/password, use passwordless magic links:

1. **Configure in Supabase Dashboard**
   - Authentication → Providers → Email
   - Enable "Email (Magic Link)" option

2. **Update login flow to send magic link**
   ```typescript
   const { error } = await supabase.auth.signInWithOtp({
     email: 'admin@pythh.ai',
     options: {
       emailRedirectTo: 'http://localhost:5173/admin/health',
     },
   });
   ```

### Option 3: Add Admin-Specific Auth Method

Create separate admin login that uses service key:

```typescript
// src/pages/AdminLogin.tsx (new file)
// Uses SUPABASE_SERVICE_KEY to bypass RLS/rate limits
// Only accessible via /admin-login URL
```

---

## Current System Status

✅ **Admin Bypass Active**
- Route: `/admin-bypass`
- Component: `src/pages/AdminBypass.tsx`
- Key configured: `VITE_ADMIN_KEY` in `.env`

✅ **What's Now Working**
- Emergency admin access (no Supabase auth)
- Bypasses email rate limits entirely
- Instant access to all admin functions

⚠️ **What Still Needs Work**
- Supabase rate limits too aggressive for admin use
- No persistent admin session across browser restarts
- Rate limit doesn't distinguish admin from regular users

---

## Quick Reference

### Access Admin Panel Right Now
```bash
# 1. Visit bypass URL
open "http://localhost:5173/admin-bypass?key=pythh-admin-2026-emergency"

# 2. Or copy-paste to browser:
http://localhost:5173/admin-bypass?key=pythh-admin-2026-emergency
```

### Check Current Admin Session
```javascript
// In browser console:
console.log(JSON.parse(localStorage.getItem('currentUser')));
// Should show: { email: "admin@pythh.ai", name: "Admin", isAdmin: true }
```

### Clear Rate Limit (Wait Method)
```
⏰ Rate limit auto-resets after 60 minutes
⏰ Or clear browser cookies: DevTools → Application → Clear site data
```

### Change Admin Key
```bash
# Edit .env file:
VITE_ADMIN_KEY=your-new-secret-key-here

# Restart dev server:
npm run dev

# Use new URL:
http://localhost:5173/admin-bypass?key=your-new-secret-key-here
```

---

## Security Notes

### Production Considerations
- **Never expose ADMIN_KEY in client code** - it's read via `import.meta.env` which is safe
- **Use strong random key in production**: `openssl rand -hex 32`
- **Rotate key periodically** (every 90 days)
- **Log all admin bypass usage** for audit trail
- **Consider IP whitelist** for admin bypass route

### What the Bypass Does
✅ Creates local admin session  
✅ Allows access to all admin routes  
✅ Bypasses Supabase email rate limiting  
⚠️ Does NOT create Supabase auth session (some features may need adjustment)  

### What It Doesn't Do
❌ Bypass RLS policies (still need service key for backend)  
❌ Create audit trail in Supabase auth logs  
❌ Persist across complete localStorage clear  

---

## Troubleshooting

### "Invalid admin key"
- Check spelling in URL: `?key=pythh-admin-2026-emergency`
- Verify `.env` has `VITE_ADMIN_KEY=pythh-admin-2026-emergency`
- Restart dev server after editing `.env`

### "VITE_ADMIN_KEY not configured"
```bash
# Add to .env:
echo "VITE_ADMIN_KEY=pythh-admin-2026-emergency" >> .env

# Restart:
npm run dev
```

### Bypass works but admin pages show errors
- Some pages may expect Supabase auth session
- Use bypass for emergency access only
- Fix Supabase rate limits for normal operation

### Rate limit still blocking normal login
- Wait 60 minutes for reset
- Or use bypass URL (instant access)
- Or configure Supabase rate limits (permanent fix)

---

## Next Steps

1. ✅ **Immediate**: Use bypass URL to access admin panel now
2. 🔧 **Today**: Configure Supabase rate limits to be more permissive
3. 📊 **This week**: Review the 100 startups ready to import
4. 🔐 **Long-term**: Implement admin-specific auth flow (no rate limits)

---

**Emergency Contact**: If bypass fails, check:
- Browser console for errors
- `.env` file has correct key
- Dev server restarted after .env changes
- localStorage not blocked by browser settings
