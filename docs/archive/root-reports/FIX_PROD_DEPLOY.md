# Fix Production Deployment - Missing Changes

## The Problem
Many changes didn't appear in production. This is likely because:

1. **Wrong Dockerfile**: The current `Dockerfile` just copies `dist/` folder (expects pre-built)
2. **Build not running**: Fly.io might not be building the app
3. **Cache issues**: Old build artifacts being reused

## Solution

### Option 1: Use the Multi-Stage Build Dockerfile (RECOMMENDED)

The `Dockerfile.build` actually builds the app. We need to update `fly.toml` to use it:

1. **Rename Dockerfiles**:
```bash
mv Dockerfile Dockerfile.old
mv Dockerfile.build Dockerfile
```

2. **Update fly.toml** (if needed):
```toml
[build]
  dockerfile = 'Dockerfile'
```

3. **Deploy with --no-cache**:
```bash
flyctl deploy --no-cache --remote-only
```

### Option 2: Build Locally and Deploy

If Option 1 doesn't work, build locally first:

```bash
# 1. Clean previous build
rm -rf dist node_modules/.vite

# 2. Build with environment variables
export VITE_SUPABASE_URL="your_url"
export VITE_SUPABASE_ANON_KEY="your_key"
npm run build

# 3. Verify build includes changes
ls -la dist/assets/ | head -10
grep -r "pyth" dist/assets/*.js | head -5  # Check if rebrand is there

# 4. Deploy
flyctl deploy --remote-only
```

### Option 3: Force Rebuild Everything

```bash
# Clear all caches
rm -rf dist node_modules/.vite .vite

# Rebuild
npm run build

# Deploy with no cache
flyctl deploy --no-cache --remote-only
```

## Verification Steps

After deployment, check:

1. **View source code**:
   - Right-click on production site → "View Page Source"
   - Search for "[pyth] ai" - should find it
   - Search for "oracle of matches" - should find new tagline

2. **Check specific pages**:
   - `/` - Should show "[pyth] ai, oracle of matches" tagline
   - `/get-matched` - Should show new toolkit buttons (no Smart Matching)
   - `/services` - Should say "Founder Toolkit"
   - `/admin/dashboard` - Should load admin panel

3. **Check browser console**:
   - Open DevTools → Console
   - Look for any build/loading errors

## Quick Fix Command

Run this to force a clean rebuild and deploy:

```bash
# Clean everything
rm -rf dist node_modules/.vite

# Build fresh
npm run build

# Verify build
grep -r "pyth" dist/assets/*.js 2>/dev/null | head -3

# Deploy with no cache
flyctl deploy --no-cache --remote-only
```

## If Still Not Working

1. **Check which Dockerfile is being used**:
   ```bash
   cat fly.toml | grep dockerfile
   ```

2. **Check Fly.io build logs**:
   ```bash
   flyctl logs | grep -i "build\|error\|warning"
   ```

3. **Verify files are in repo**:
   ```bash
   git ls-files | grep -E "(MatchingEngine|GetMatchedPage|ServicesPage)" | head -10
   ```

4. **Check if changes were committed**:
   ```bash
   git log --oneline -5
   git show HEAD --name-only | head -20
   ```

## Common Issues

### Issue: Changes not in dist/
**Fix**: The build didn't run. Use `Dockerfile.build` or build locally first.

### Issue: Old JavaScript being served
**Fix**: Browser cache. Hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows).

### Issue: Some pages work, others don't
**Fix**: Router issue. Check `nginx.conf` has proper rewrite rules for SPA.

### Issue: Assets not loading
**Fix**: Check `vite.config.ts` build configuration and asset paths.
