# 🚨 Production Site Down - Troubleshooting Guide

## Immediate Checks

### 1. **Check Environment Variables**
Production deployments need these environment variables set:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Where to set (depends on hosting):**
- **Vercel**: Settings → Environment Variables
- **Netlify**: Site settings → Environment variables
- **Fly.io**: `fly secrets set VITE_SUPABASE_URL=...`
- **Railway/Heroku**: Environment Variables section

### 2. **Check Build Logs**
Look at your deployment logs for:
- ❌ Build errors
- ❌ Missing dependencies
- ❌ TypeScript errors
- ❌ Environment variable warnings

### 3. **Check Browser Console**
Open the site and check Console (F12):
- JavaScript errors?
- Network errors (failed API calls)?
- Missing chunks/assets?

### 4. **Common Issues**

#### Issue: White Screen / Blank Page
**Cause**: JavaScript error preventing React from rendering

**Fix**:
1. Check browser console for errors
2. Verify all environment variables are set
3. Check if `main.tsx` is loading correctly

#### Issue: 500 Internal Server Error
**Cause**: Build failed or server configuration issue

**Fix**:
1. Check deployment platform logs
2. Verify build completed successfully
3. Check server configuration (if using SSR)

#### Issue: "Cannot read property of undefined"
**Cause**: Missing environment variables or data

**Fix**:
1. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
2. Check if Supabase project is accessible
3. Verify database connections

---

## Quick Fixes

### If Environment Variables Missing:

**Vercel/Netlify:**
1. Go to project settings
2. Add environment variables
3. Redeploy

**Fly.io:**
```bash
fly secrets set VITE_SUPABASE_URL=https://your-project.supabase.co
fly secrets set VITE_SUPABASE_ANON_KEY=your-key
fly deploy
```

### If Build Failing:

```bash
# Test build locally first
npm run build

# If build succeeds, check deployment platform logs
# Common issues:
# - Missing dependencies in package.json
# - TypeScript errors
# - Memory limits
```

### If Runtime Errors:

1. **Check browser console** - Look for red errors
2. **Check Network tab** - Are assets loading?
3. **Verify Supabase connection** - Is database accessible?

---

## Emergency Rollback

If site is completely down:

1. **Revert to last working commit:**
```bash
git log --oneline -10  # Find last working commit
git revert HEAD~1      # Or checkout specific commit
git push origin main
```

2. **Or redeploy previous version** (via hosting platform UI)

---

## Verify Production Build

```bash
# Build locally to test
npm run build

# Check dist/ folder was created
ls -la dist/

# Test the build locally
npm run preview  # Serve built files
```

---

## Next Steps

1. **Check deployment platform logs** - Most important!
2. **Check browser console** - See actual errors
3. **Verify environment variables** - They're usually the culprit
4. **Test build locally** - `npm run build` should work

---

## Need More Help?

Share:
1. **Deployment platform** (Vercel, Netlify, Fly.io, etc.)
2. **Browser console errors** (F12 → Console)
3. **Build logs** from deployment platform
4. **What you see** (blank page, error message, 500, etc.)

